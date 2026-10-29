import { create } from 'zustand';
import { SERVICES } from '../lib/services';
import type { DetailPayload, ServiceState, StatusPayload } from '../lib/types';

const SNAPSHOT_KEY = 'statusradar:v2:snapshot';
const HISTORY_LEN = 40;

export type SortMode = 'severity' | 'name' | 'latency';

export interface Filter {
  query: string;
  category: string | null;
  problemsOnly: boolean;
  sort: SortMode;
}

interface DetailState {
  payload: DetailPayload | null;
  loading: boolean;
}

interface BoardState {
  services: Record<string, ServiceState>;
  detail: Record<string, DetailState>;
  /** server-side timestamp of the last upstream sweep */
  generatedAt: number;
  /** set when this browser could not reach /api/status at all */
  apiError: string | null;
  loading: boolean;
  filter: Filter;
  setFilter: (patch: Partial<Filter>) => void;
  refresh: () => Promise<void>;
  loadDetail: (id: string, force?: boolean) => Promise<void>;
  hydrate: () => void;
}

function initialState(): Record<string, ServiceState> {
  const map: Record<string, ServiceState> = {};
  for (const def of SERVICES) {
    map[def.id] = {
      def,
      severity: 'unknown',
      description: 'Loading…',
      history: [],
      fetchedAt: 0,
      checkedAt: 0,
      latencyMs: 0,
      error: null,
      stale: false,
      loading: true,
    };
  }
  return map;
}

function persist(services: Record<string, ServiceState>, generatedAt: number) {
  try {
    const slim: Record<string, unknown> = {};
    for (const [id, s] of Object.entries(services)) {
      slim[id] = {
        severity: s.severity,
        description: s.description,
        fetchedAt: s.fetchedAt,
        checkedAt: s.checkedAt,
        latencyMs: s.latencyMs,
        error: s.error,
        stale: s.stale,
        history: s.history.slice(-HISTORY_LEN),
      };
    }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: Date.now(), generatedAt, services: slim }));
  } catch {
    /* the snapshot is a nicety; private mode can refuse it */
  }
}

export const useBoard = create<BoardState>((set, get) => ({
  services: initialState(),
  detail: {},
  generatedAt: 0,
  apiError: null,
  loading: true,
  filter: { query: '', category: null, problemsOnly: false, sort: 'severity' },

  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),

  hydrate: () => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        generatedAt: number;
        services: Record<string, Partial<ServiceState>>;
      };
      const services = { ...get().services };
      for (const [id, saved] of Object.entries(parsed.services ?? {})) {
        if (!services[id]) continue;
        services[id] = { ...services[id], ...saved, def: services[id].def, loading: false } as ServiceState;
      }
      set({ services, generatedAt: parsed.generatedAt ?? 0 });
    } catch {
      /* ignore a corrupt snapshot */
    }
  },

  refresh: async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as StatusPayload;

      set((state) => {
        const services = { ...state.services };
        for (const entry of payload.services ?? []) {
          const previous = services[entry.id];
          if (!previous) continue;
          services[entry.id] = {
            ...previous,
            severity: entry.severity,
            description: entry.description,
            fetchedAt: entry.fetchedAt,
            checkedAt: entry.checkedAt,
            latencyMs: entry.latencyMs,
            error: entry.error,
            stale: entry.stale,
            loading: false,
            history: entry.latencyMs > 0 ? [...previous.history, entry.latencyMs].slice(-HISTORY_LEN) : previous.history,
          };
        }
        return { services, generatedAt: payload.generatedAt, apiError: null, loading: false };
      });

      persist(get().services, get().generatedAt);
    } catch (err) {
      set({
        apiError: err instanceof Error ? err.message : 'request failed',
        loading: false,
      });
    }
  },

  loadDetail: async (id, force) => {
    const cached = get().detail[id];
    if (!force && cached?.payload && Date.now() - cached.payload.fetchedAt < 60_000) return;

    set((s) => ({ detail: { ...s.detail, [id]: { payload: cached?.payload ?? null, loading: true } } }));
    try {
      const res = await fetch(`/api/service?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as DetailPayload;
      set((s) => ({ detail: { ...s.detail, [id]: { payload, loading: false } } }));
    } catch (err) {
      set((s) => ({
        detail: {
          ...s.detail,
          [id]: {
            payload: cached?.payload
              ? { ...cached.payload, error: err instanceof Error ? err.message : 'request failed', stale: true }
              : null,
            loading: false,
          },
        },
      }));
    }
  },
}));
