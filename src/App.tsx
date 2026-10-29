import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from './lib/services';
import { formatAgo } from './lib/statuspage';
import { useBoard } from './store/board';
import { ServiceCard } from './components/ServiceCard';
import { DetailDrawer } from './components/DetailDrawer';
import type { ServiceState, Severity } from './lib/types';

const REFRESH_MS = 30_000;
const SEVERITY_ORDER: Severity[] = ['outage', 'degraded', 'maintenance', 'operational', 'unknown'];

export default function App() {
  const services = useBoard((s) => s.services);
  const filter = useBoard((s) => s.filter);
  const setFilter = useBoard((s) => s.setFilter);
  const generatedAt = useBoard((s) => s.generatedAt);
  const apiError = useBoard((s) => s.apiError);
  const loading = useBoard((s) => s.loading);
  const refresh = useBoard((s) => s.refresh);
  const hydrate = useBoard((s) => s.hydrate);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    hydrate();
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
    // keeps every "Updated 12s ago" label truthful without re-fetching anything
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [hydrate, refresh]);

  const list = useMemo(() => {
    const query = filter.query.trim().toLowerCase();
    const visible = Object.values(services).filter((s) => {
      if (filter.category && s.def.category !== filter.category) return false;
      if (filter.problemsOnly && s.severity === 'operational') return false;
      if (query && !`${s.def.name} ${s.def.category}`.toLowerCase().includes(query)) return false;
      return true;
    });

    const latency = (s: ServiceState) => (s.history.length ? s.history[s.history.length - 1] : -1);

    return visible.sort((a, b) => {
      if (filter.sort === 'name') return a.def.name.localeCompare(b.def.name);
      if (filter.sort === 'latency') return latency(b) - latency(a);
      const rank = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
      return rank !== 0 ? rank : a.def.name.localeCompare(b.def.name);
    });
  }, [services, filter]);

  const totals = useMemo(() => {
    const counts: Record<string, number> = { operational: 0, degraded: 0, outage: 0, maintenance: 0, unknown: 0 };
    for (const s of Object.values(services)) counts[s.severity] = (counts[s.severity] ?? 0) + 1;
    return counts;
  }, [services]);

  const problems = totals.degraded + totals.outage;
  const countdown = generatedAt ? Math.max(0, Math.round((REFRESH_MS - (now - generatedAt)) / 1000)) : 0;
  const selected = selectedId ? services[selectedId] : null;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="pulse" />
          <div>
            <h1>StatusRadar</h1>
            <p>{Object.keys(services).length} services · official status APIs, no scraping</p>
          </div>
        </div>

        <div className={`headline ${problems > 0 ? 'has-problems' : ''}`}>
          {problems > 0 ? (
            <>
              <strong>{problems}</strong> service{problems === 1 ? '' : 's'} reporting problems
            </>
          ) : (
            <>
              <strong>All clear</strong> across tracked services
            </>
          )}
        </div>

        <div className="refresh">
          <span className="stamp">{generatedAt ? `updated ${formatAgo(generatedAt)}` : 'loading…'}</span>
          <span className="countdown">next in {countdown}s</span>
          <button className="btn" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {apiError && (
        <div className="banner" role="status">
          <strong>Live data unavailable</strong> — showing the last known state
          {generatedAt ? ` from ${formatAgo(generatedAt)}` : ''}. ({apiError})
        </div>
      )}

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search services…"
          value={filter.query}
          onChange={(e) => setFilter({ query: e.target.value })}
        />
        <div className="chips">
          <button className={`chip${filter.category === null ? ' on' : ''}`} onClick={() => setFilter({ category: null })}>
            All
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              className={`chip${filter.category === category ? ' on' : ''}`}
              onClick={() => setFilter({ category: filter.category === category ? null : category })}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <button
            className={`chip${filter.problemsOnly ? ' on' : ''}`}
            onClick={() => setFilter({ problemsOnly: !filter.problemsOnly })}
          >
            Problems only
          </button>
          <select className="sort" value={filter.sort} onChange={(e) => setFilter({ sort: e.target.value as typeof filter.sort })}>
            <option value="severity">Sort: severity</option>
            <option value="name">Sort: name</option>
            <option value="latency">Sort: latency</option>
          </select>
        </div>
      </div>

      <div className="counts">
        {(['outage', 'degraded', 'maintenance', 'operational'] as Severity[]).map((severity) => (
          <span key={severity} className={`count ${severity}`}>
            <i />
            {totals[severity]} {severity}
          </span>
        ))}
      </div>

      <main className="grid">
        {list.map((service) => (
          <ServiceCard key={service.def.id} service={service} onOpen={() => setSelectedId(service.def.id)} />
        ))}
        {list.length === 0 && <p className="empty">No services match this filter.</p>}
      </main>

      <footer className="foot">
        Status, incidents and components come from each provider's own Statuspage JSON API, fetched by a
        small proxy that caches results for 45 seconds, so providers see one request per interval instead
        of one per visitor. The millisecond figure is the proxy's round trip to that status API, not a probe
        of the service itself, and a failed check is labelled as failed rather than shown as healthy.
      </footer>

      {selected && <DetailDrawer service={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
