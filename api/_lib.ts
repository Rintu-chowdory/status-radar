import { SERVICES } from '../src/lib/services.js';
import type { DetailPayload, ServiceDef, SpIncident, SpSummary, StatusEntry } from '../src/lib/types.js';
import { severityFromIndicator, severityOf } from '../src/lib/statuspage.js';

/**
 * Shared cache for the status proxy. Vercel keeps a module alive between invocations,
 * so this map and the CDN layer (s-maxage on the response) are two independent brakes
 * on upstream traffic. The key rule here: a failed fetch must never read as healthy.
 */

const BOARD_TTL_MS = 45_000;
const DETAIL_TTL_MS = 60_000;
const STALE_AFTER_MS = 5 * 60_000;
const TIMEOUT_MS = 5_000;

interface BoardEntry {
  severity: StatusEntry['severity'];
  description: string;
  fetchedAt: number;
  checkedAt: number;
  latencyMs: number;
  error: string | null;
  stale: boolean;
}

const boardCache = new Map<string, BoardEntry>();
let lastRun = 0;
let inflight: Promise<void> | null = null;

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'Timed out';
    if (err.message.startsWith('HTTP ')) return err.message;
    return err.message || 'Fetch failed';
  }
  return 'Fetch failed';
}

async function fetchJson<T>(url: string): Promise<{ data: T; latencyMs: number }> {
  const started = Date.now();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as T;
  return { data, latencyMs };
}

async function checkService(def: ServiceDef): Promise<BoardEntry> {
  const started = Date.now();
  const previous = boardCache.get(def.id);

  try {
    const { data, latencyMs } = await fetchJson<{ status?: { indicator?: string; description?: string } }>(
      `${def.base}/api/v2/status.json`,
    );
    const indicator = data?.status?.indicator;
    if (typeof indicator !== 'string') throw new Error('Unexpected response shape');

    return {
      severity: severityFromIndicator(indicator),
      description: data.status?.description ?? 'Operational',
      fetchedAt: started,
      checkedAt: started,
      latencyMs,
      error: null,
      stale: false,
    };
  } catch (err) {
    const now = Date.now();
    // Keep recent data rather than blanking the card, but drop to "unknown" once it is
    // old enough that presenting it as current would be a lie.
    const tooOld = !previous || now - previous.fetchedAt > STALE_AFTER_MS;

    return {
      severity: tooOld ? 'unknown' : previous.severity,
      description: tooOld ? 'Status unavailable' : previous.description,
      fetchedAt: previous?.fetchedAt ?? 0,
      checkedAt: now,
      latencyMs: 0,
      error: describeError(err),
      stale: true,
    };
  }
}

export interface BoardResult {
  generatedAt: number;
  servedFrom: 'cache' | 'refreshed';
  services: StatusEntry[];
}

export async function boardStatuses(): Promise<BoardResult> {
  const fresh = Date.now() - lastRun <= BOARD_TTL_MS && boardCache.size === SERVICES.length;

  if (!fresh) {
    if (!inflight) {
      inflight = (async () => {
        const results = await Promise.all(SERVICES.map(checkService));
        SERVICES.forEach((def, index) => boardCache.set(def.id, results[index]));
        lastRun = Date.now();
      })().finally(() => {
        inflight = null;
      });
    }
    await inflight;
  }

  const services = SERVICES.map((def) => {
    const entry = boardCache.get(def.id);
    return {
      id: def.id,
      name: def.name,
      category: def.category,
      severity: entry?.severity ?? 'unknown',
      description: entry?.description ?? 'Status unavailable',
      fetchedAt: entry?.fetchedAt ?? 0,
      checkedAt: entry?.checkedAt ?? 0,
      latencyMs: entry?.latencyMs ?? 0,
      error: entry?.error ?? null,
      stale: entry?.stale ?? true,
    } satisfies StatusEntry;
  });

  return { generatedAt: lastRun, servedFrom: fresh ? 'cache' : 'refreshed', services };
}

/* ---------------------------------- detail --------------------------------- */

interface DetailEntry {
  summary: SpSummary;
  incidents: SpIncident[];
  severity: DetailPayload['severity'];
  fetchedAt: number;
  error: string | null;
}

const detailCache = new Map<string, DetailEntry>();

export async function serviceDetail(id: string): Promise<DetailPayload | null> {
  const def = SERVICES.find((s) => s.id === id);
  if (!def) return null;

  const cached = detailCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < DETAIL_TTL_MS) {
    return { id: def.id, name: def.name, ...cached, stale: false };
  }

  try {
    const [summary, incidents] = await Promise.all([
      fetchJson<SpSummary>(`${def.base}/api/v2/summary.json`),
      // Incident history is optional: a page that does not serve it must not break the panel.
      fetchJson<{ incidents?: SpIncident[] }>(`${def.base}/api/v2/incidents.json`).catch(() => null),
    ]);

    const entry: DetailEntry = {
      summary: summary.data,
      incidents: incidents?.data.incidents ?? [],
      severity: severityOf(summary.data),
      fetchedAt: Date.now(),
      error: null,
    };
    detailCache.set(id, entry);
    return { id: def.id, name: def.name, ...entry, stale: false };
  } catch (err) {
    if (cached) {
      return { id: def.id, name: def.name, ...cached, error: describeError(err), stale: true };
    }
    return {
      id: def.id,
      name: def.name,
      summary: null,
      incidents: [],
      severity: 'unknown',
      fetchedAt: 0,
      error: describeError(err),
      stale: true,
    };
  }
}
