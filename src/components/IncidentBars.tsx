import { formatMinutes } from '../lib/statuspage';
import type { IncidentDay } from '../lib/types';

const TONE: Record<string, string> = {
  none: 'rgba(120, 160, 220, 0.16)',
  minor: '#ffc857',
  major: '#ff8f4d',
  critical: '#ff5c5c',
};

/** One bar per day, height = minutes spent in a degraded/outage state that day. */
export function IncidentBars({ days }: { days: IncidentDay[] }) {
  const max = Math.max(...days.map((d) => d.minutes), 30);
  return (
    <div className="bars">
      {days.map((day) => {
        const height = day.minutes > 0 ? Math.max(6, (day.minutes / max) * 100) : 3;
        return (
          <div
            key={day.date}
            className="bar-slot"
            title={`${day.date}: ${day.minutes > 0 ? formatMinutes(day.minutes) + ' affected, ' + day.count + ' incident(s)' : 'no incidents'}`}
          >
            <span className="bar" style={{ height: `${height}%`, background: TONE[day.worst] ?? TONE.none }} />
          </div>
        );
      })}
    </div>
  );
}
