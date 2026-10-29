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
  const { def, severity, description, history, error, loading, stale, fetchedAt } = service;
  const tone = TONE[severity] ?? TONE.unknown;
  const latest = history.length ? history[history.length - 1] : 0;

  return (
    <button
      className={`card${stale ? ' stale' : ''}`}
      style={{ borderColor: `color-mix(in srgb, ${tone} 26%, transparent)` }}
      onClick={onOpen}
    >
      <div className="card-top">
        <span className="dot" style={{ background: tone, boxShadow: `0 0 10px ${tone}` }} />
        <span className="name">{def.name}</span>
        <span className="state" style={{ color: tone }}>
          {loading && !fetchedAt ? '…' : LABEL[severity]}
        </span>
      </div>

      <div className="card-mid">
        <span className="category">{def.category}</span>
        <span className={`incident-line${error ? ' warn-text' : ' muted'}`} title={error ? `Last check failed: ${error}` : undefined}>
          {error ? (fetchedAt ? 'Last check failed, showing earlier data' : 'Status unavailable') : description}
        </span>
      </div>

      <div className="card-foot">
        <span className="latency">{latest ? `${latest} ms` : '—'}</span>
        <Sparkline values={history} tone={stale ? '#ffc857' : tone} />
        <span className={`checked${error ? ' err' : ''}`}>
          {error && (
            <span className="warn-icon" title={`Last check failed: ${error}`} aria-label={`Last check failed: ${error}`}>
              !
            </span>
          )}
          {fetchedAt ? ` Updated ${formatAgo(fetchedAt)}` : 'No data yet'}
        </span>
      </div>
    </button>
  );
}
