import { useEffect, useMemo } from 'react';
import { formatAgo, formatMinutes, incidentDays } from '../lib/statuspage';
import { useBoard } from '../store/board';
import type { SpComponent, ServiceState } from '../lib/types';
import { IncidentBars } from './IncidentBars';

const TONE: Record<string, string> = {
  operational: '#3ddc97',
  degraded: '#ffc857',
  outage: '#ff5c5c',
  maintenance: '#7aa2ff',
  unknown: '#6b7280',
};

const COMPONENT_TONE: Record<string, string> = {
  operational: '#3ddc97',
  degraded_performance: '#ffc857',
  partial_outage: '#ffc857',
  major_outage: '#ff5c5c',
  under_maintenance: '#7aa2ff',
};

const IMPACT_LABEL: Record<string, string> = {
  none: 'Maintenance',
  minor: 'Minor',
  major: 'Major',
  critical: 'Critical',
};

function groupComponents(components: SpComponent[]) {
  const groups = new Map<string, SpComponent[]>();
  const names = new Map<string, string>();
  for (const c of components) if (c.group) names.set(c.id, c.name);

  for (const c of components) {
    if (c.group) continue;
    const key = c.group_id ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return [...groups.entries()]
    .map(([id, items]) => ({ id, title: id ? names.get(id) ?? 'Components' : 'Components', items }))
    .sort((a, b) => b.items.length - a.items.length);
}

export function DetailDrawer({ service, onClose }: { service: ServiceState; onClose: () => void }) {
  const detail = useBoard((s) => s.detail[service.def.id]);
  const loadDetail = useBoard((s) => s.loadDetail);

  useEffect(() => {
    void loadDetail(service.def.id);
  }, [service.def.id, loadDetail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const payload = detail?.payload ?? null;
  const summary = payload?.summary ?? null;
  const tone = TONE[service.severity] ?? TONE.unknown;
  const components = useMemo(() => groupComponents(summary?.components ?? []), [summary]);
  const history = useMemo(() => incidentDays(payload?.incidents ?? [], 30), [payload]);
  const sortedLatency = useMemo(() => {
    if (!service.history.length) return null;
    const sorted = [...service.history].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [service.history]);

  const activeIncidents = summary?.incidents ?? [];
  const maintenances = summary?.scheduled_maintenances ?? [];
  const recent = (payload?.incidents ?? []).filter((i) => i.impact !== 'none').slice(0, 6);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`${service.def.name} status details`}>
        <header className="drawer-head">
          <div>
            <h2>{service.def.name}</h2>
            <p style={{ color: tone }}>{service.description}</p>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="drawer-stats">
          <div>
            <label>Upstream median</label>
            <strong>{sortedLatency !== null ? `${sortedLatency} ms` : '—'}</strong>
          </div>
          <div>
            <label>Open incidents</label>
            <strong>{activeIncidents.length}</strong>
          </div>
          <div>
            <label>Components</label>
            <strong>{(summary?.components ?? []).filter((c) => !c.group).length}</strong>
          </div>
          <div>
            <label>Last update</label>
            <strong>{payload?.fetchedAt ? formatAgo(payload.fetchedAt) : '—'}</strong>
          </div>
        </div>

        {(payload?.error || service.error) && (
          <p className="warn">
            Could not read the status API just now ({payload?.error ?? service.error}). Values below may be
            stale.
          </p>
        )}

        {detail?.loading && !summary && <p className="legend">Loading details…</p>}

        {summary && (
          <section>
            <h3>Last 30 days</h3>
            <IncidentBars days={history} />
            <p className="legend">
              {history.reduce((sum, d) => sum + d.minutes, 0) > 0
                ? `${formatMinutes(history.reduce((sum, d) => sum + d.minutes, 0))} with at least one incident open over 30 days (overlaps merged)`
                : 'No reported incidents in the last 30 days'}
            </p>
          </section>
        )}

        {activeIncidents.length > 0 && (
          <section>
            <h3>Open right now</h3>
            {activeIncidents.map((incident) => (
              <article key={incident.id} className="incident open">
                <div className="incident-head">
                  <span className={`impact ${incident.impact}`}>{IMPACT_LABEL[incident.impact] ?? incident.impact}</span>
                  <span className="when">since {new Date(incident.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="incident-name">{incident.name}</p>
                <p className="incident-body">{incident.incident_updates?.[0]?.body?.slice(0, 220)}</p>
              </article>
            ))}
          </section>
        )}

        {maintenances.length > 0 && (
          <section>
            <h3>Scheduled maintenance</h3>
            {maintenances.slice(0, 3).map((m) => (
              <article key={m.id} className="incident">
                <div className="incident-head">
                  <span className="impact none">{m.status.replace(/_/g, ' ')}</span>
                  <span className="when">{new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                </div>
                <p className="incident-name">{m.name}</p>
              </article>
            ))}
          </section>
        )}

        <section>
          <h3>Components</h3>
          {components.length === 0 && <p className="legend">This page does not expose its components.</p>}
          {components.map((group) => (
            <div key={group.id} className="component-group">
              <h4>{group.title}</h4>
              {group.items.slice(0, 18).map((component) => (
                <div key={component.id} className="component">
                  <span className="cdot" style={{ background: COMPONENT_TONE[component.status] ?? '#6b7280' }} />
                  <span className="cname">{component.name}</span>
                  <span className="cstate">{component.status.replace(/_/g, ' ')}</span>
                </div>
              ))}
              {group.items.length > 18 && <p className="legend">+{group.items.length - 18} more in this group</p>}
            </div>
          ))}
        </section>

        <section>
          <h3>Recent incidents</h3>
          {detail?.loading && !payload?.incidents.length && <p className="legend">Loading incident history…</p>}
          {!detail?.loading && !recent.length && !payload?.error && <p className="legend">Nothing reported recently.</p>}
          {recent.map((incident) => {
            const start = new Date(incident.created_at);
            const end = incident.resolved_at ? new Date(incident.resolved_at) : null;
            const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
            return (
              <article key={incident.id} className="incident">
                <div className="incident-head">
                  <span className={`impact ${incident.impact}`}>{IMPACT_LABEL[incident.impact] ?? incident.impact}</span>
                  <span className="when">
                    {start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {minutes !== null ? ` · ${formatMinutes(minutes)}` : ' · ongoing'}
                  </span>
                </div>
                <p className="incident-name">{incident.name}</p>
              </article>
            );
          })}
        </section>

        <footer className="drawer-foot">
          <a href={`${service.def.base}`} target="_blank" rel="noreferrer">
            Official status page ↗
          </a>
          <a href={service.def.homepage} target="_blank" rel="noreferrer">
            Product ↗
          </a>
        </footer>
      </aside>
    </>
  );
}
