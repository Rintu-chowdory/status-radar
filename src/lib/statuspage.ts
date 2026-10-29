import type { IncidentDay, Severity, SpIncident, SpSummary } from './types';

const TIMEOUT_MS = 12_000;

export interface SummaryResult {
  summary: SpSummary;
  latencyMs: number;
}

/**
 * Statuspage summary. Latency is measured around the fetch, so it describes the path
 * between this browser and the provider's status API, not the health of the service
 * itself. The UI says so explicitly.
 */
export async function fetchSummary(base: string): Promise<SummaryResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const res = await fetch(`${base}/api/v2/summary.json`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const latencyMs = performance.now() - started;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const summary = (await res.json()) as SpSummary;
    if (!summary?.status) throw new Error('unexpected payload');
    return { summary, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchIncidents(base: string): Promise<SpIncident[]> {
  const res = await fetch(`${base}/api/v2/incidents.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { incidents?: SpIncident[] };
  return data.incidents ?? [];
}

const INDICATOR_SEVERITY: Record<string, Severity> = {
  none: 'operational',
  minor: 'degraded',
  major: 'outage',
  critical: 'outage',
  maintenance: 'maintenance',
};

const COMPONENT_SEVERITY: Record<string, Severity> = {
  operational: 'operational',
  degraded_performance: 'degraded',
  partial_outage: 'degraded',
  under_maintenance: 'maintenance',
  major_outage: 'outage',
};

const RANK: Record<Severity, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  outage: 3,
  unknown: 0,
};

export function worst(a: Severity, b: Severity): Severity {
  return RANK[b] > RANK[a] ? b : a;
}

/**
 * The page indicator is authoritative, but a component sitting in major_outage is a
 * real outage even when the indicator lags, so the worse of the two wins.
 */
export function severityOf(summary: SpSummary): Severity {
  let severity = INDICATOR_SEVERITY[summary.status?.indicator ?? 'none'] ?? 'unknown';
  for (const component of summary.components ?? []) {
    if (component.group) continue;
    const s = COMPONENT_SEVERITY[component.status];
    if (s) severity = worst(severity, s);
  }
  return severity;
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'operational':
      return 'Operational';
    case 'degraded':
      return 'Degraded';
    case 'outage':
      return 'Outage';
    case 'maintenance':
      return 'Maintenance';
    default:
      return 'Unknown';
  }
}

export function activeIncidents(summary: SpSummary | null): SpIncident[] {
  return summary?.incidents ?? [];
}

/** Groups incidents by calendar day and totals affected minutes, for the history chart. */
export function incidentDays(incidents: SpIncident[], days: number): IncidentDay[] {
  const now = new Date();
  const buckets = new Map<string, IncidentDay>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, minutes: 0, count: 0, worst: 'none' });
  }

  const impactRank: Record<string, number> = { none: 0, minor: 1, major: 2, critical: 3 };

  for (const incident of incidents) {
    if (incident.impact === 'none') continue;
    const start = new Date(incident.created_at).getTime();
    const end = incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now();
    if (!Number.isFinite(start)) continue;

    const dayCount = Math.ceil((end - start) / 86_400_000) + 1;
    for (let offset = 0; offset < dayCount; offset++) {
      const dayStart = new Date(start + offset * 86_400_000);
      dayStart.setHours(0, 0, 0, 0);
      const key = new Date(dayStart.getTime() + 12 * 3_600_000).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;

      const overlapStart = Math.max(start, dayStart.getTime());
      const overlapEnd = Math.min(end, dayStart.getTime() + 86_400_000);
      if (overlapEnd <= overlapStart) continue;

      bucket.minutes += Math.round((overlapEnd - overlapStart) / 60_000);
      bucket.count += 1;
      const impact = incident.impact as IncidentDay['worst'];
      if (impactRank[impact] > impactRank[bucket.worst]) bucket.worst = impact;
    }
  }

  return [...buckets.values()];
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatAgo(ts: number): string {
  if (!ts) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
