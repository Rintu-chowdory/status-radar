import { create } from 'zustand';
import { SERVICES } from '../lib/services';
import { fetchIncidents, fetchSummary, severityOf } from '../lib/statuspage';
import type { ServiceState, SpIncident, SpSummary } from '../lib/types';

const SNAPSHOT_KEY = 'statusradar:v1:snapshot';
const HISTORY_LEN = 40;

export type SortMode = 'severity' | 'name' | 'latency';

export interface Filter {
  query: string;
  category: string | null;
  problemsOnly: boolean;
  sort: SortMode;
}

interface IncidentCache {
  items: SpIncident[];
  fetchedAt: number;
  loading: boolean;
  error: string | null;
}

interface BoardState {
  services: Record<string, ServiceState>;
  incidents: Record<string, IncidentCache>;
  refreshedAt: number;
  refreshing: boolean;
  filter: Filter;
  setFilter: (patch: Partial<Filter>) => void;
  refreshAll: (opts?: { silent?: boolean }) => Promise<void>;
  refreshOne: (id: string) => Promise<void>;
  loadIncidents: (id: string, force?: boolean) => Promise<void>;
  hydrate: () => void;
}

function initialState(): Record<string, ServiceState> {
  const map: Record<string, ServiceState> = {};
  for (const def of SERVICES) {
    map[def.id] = {
      def,
      severity: 'unknown',
      description: 'Loading…',
      summary: null,
      history: [],
      checkedAt: 0,
      error: null,
      loading: true,
    };
  }
  return map;
}

function persist(services: Record<string, ServiceState>, refreshedAt: number) {
  try {
    const slim: Record<string, unknown> = {};
    for (const [id, s] of Object.entries(services)) {
      slim[id] = {
        summary: s.summary,
        severity: s.severity,
        description: s.description,
        checkedAt: s.checkedAt,
        history: s.history.slice(-HISTORY_LEN),
      };
    }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: Date.now(), refreshedAt, services: slim }));
  } catch {
    /* cache is a nicety, not a requirement */
  }
}

export const useBoard = create<BoardState>((set, get) => ({
  services: initialState(),
  incidents: {},
  refreshedAt: 0,
  refreshing: false,
  filter: { query: '', category: null, problemsOnly: false, sort: 'severity' },

  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),

  hydrate: () => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        refreshedAt: number;
        services: Record<string, { summary: SpSummary | null; severity: ServiceState['severity']; description: string; checkedAt: number; history: number[] }>;
      };
      const services = { ...get().services };
      for (const [id, saved] of Object.entries(parsed.services ?? {})) {
        if (!services[id]) continue;
        services[id] = {
          ...services[id],
          summary: saved.summary,
          severity: saved.severity,
          description: saved.description,
          checkedAt: saved.checkedAt,
          history: saved.history ?? [],
          loading: false,
        };
      }
      set({ services, refreshedAt: parsed.refreshedAt ?? 0 });
    } catch {
      /* ignore a corrupt snapshot */
    }
  },

  refreshOne: async (id) => {
    const def = SERVICES.find((s) => s.id === id);
    if (!def) return;

    set((s) => ({ services: { ...s.services, [id]: { ...s.services[id], loading: true } } }));

    try {
      const { summary, latencyMs } = await fetchSummary(def.base);
      set((s) => {
        const prev = s.services[id];
        const history = [...prev.history, Math.round(latencyMs)].slice(-HISTORY_LEN);
        return {
          services: {
            ...s.services,
            [id]: {
              ...prev,
              summary,
              severity: severityOf(summary),
              description: summary.status?.description ?? 'Operational',
              history,
              checkedAt: Date.now(),
              error: null,
              loading: false,
            },
          },
        };
      });
    } catch (err) {
      set((s) => ({
        services: {
          ...s.services,
          [id]: {
            ...s.services[id],
            loading: false,
            error:
              err instanceof Error
                ? err.name === 'AbortError'
                  ? 'timeout'
                  : err.message
                : 'fetch failed',
          },
        },
      }));
    }
  },

  refreshAll: async (opts) => {
    if (get().refreshing) return;
    if (!opts?.silent) set({ refreshing: true });
    await Promise.all(SERVICES.map((s) => get().refreshOne(s.id)));
    const refreshedAt = Date.now();
    set({ refreshedAt, refreshing: false });
    persist(get().services, refreshedAt);
  },

  loadIncidents: async (id, force) => {
    const def = SERVICES.find((s) => s.id === id);
    if (!def) return;
    const cached = get().incidents[id];
    if (!force && cached && Date.now() - cached.fetchedAt < 5 * 60_000) return;

    set((s) => ({
      incidents: { ...s.incidents, [id]: { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? 0, loading: true, error: null } },
    }));

    try {
      const items = await fetchIncidents(def.base);
      set((s) => ({ incidents: { ...s.incidents, [id]: { items, fetchedAt: Date.now(), loading: false, error: null } } }));
    } catch (err) {
      set((s) => ({
        incidents: {
          ...s.incidents,
          [id]: { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? 0, loading: false, error: err instanceof Error ? err.message : 'failed' },
        },
      }));
    }
  },
}));
