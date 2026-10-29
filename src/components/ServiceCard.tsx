import { formatAgo } from '../lib/statuspage';
import type { ServiceState } from '../lib/types';
import { Sparkline } from './Sparkline';

const TONE: Record<string, string> = {
  operational: '#3ddc97',
  degraded: '#ffc857',
  outage: '#ff5c5c',
  maintenance: '#7aa2ff',
  unknown: '#6b7280',
};

const LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Outage',
  maintenance: 'Maintenance',
  unknown: 'Unknown',
};

export function ServiceCard({ service, onOpen }: { service: ServiceState; onOpen: () => void }) {
  const { def, severity, summary, history, error, loading } = service;
  const tone = TONE[severity] ?? TONE.unknown;
  const incidents = summary?.incidents ?? [];
  const degradedComponents = (summary?.components ?? []).filter(
    (c) => !c.group && c.status !== 'operational' && c.status !== 'under_maintenance',
  );
  const latency = history.length ? history[history.length - 1] : null;

  return (
    <button className="card" style={{ borderColor: `color-mix(in srgb, ${tone} 26%, transparent)` }} onClick={onOpen}>
      <div className="card-top">
        <span className="dot" style={{ background: tone, boxShadow: `0 0 10px ${tone}` }} />
        <span className="name">{def.name}</span>
        <span className="state" style={{ color: tone }}>
          {loading && !summary ? '…' : LABEL[severity]}
        </span>
      </div>

      <div className="card-mid">
        <span className="category">{def.category}</span>
        {incidents.length > 0 ? (
          <span className="incident-line" title={incidents[0]?.name}>
            {incidents.length} open · {incidents[0]?.name}
          </span>
        ) : degradedComponents.length > 0 && severity === 'operational' ? (
          <span className="incident-line">{degradedComponents.length} component(s) affected</span>
        ) : (
          <span className="incident-line muted">{summary?.status?.description ?? 'No incidents reported'}</span>
        )}
      </div>

      <div className="card-foot">
        <span className="latency">{latency !== null ? `${latency} ms` : '—'}</span>
        <Sparkline values={history} tone={tone} />
        <span className={`checked${error ? ' err' : ''}`}>{error ? 'check failed' : formatAgo(service.checkedAt)}</span>
      </div>
    </button>
  );
}
