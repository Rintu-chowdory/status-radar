import type { IncidentDay, Severity, SpIncident, SpSummary } from './types';

/** The board reads status.json, so severity comes from the page indicator alone. */
export function severityFromIndicator(indicator: string | undefined): Severity {
  switch (indicator) {
    case 'none':
      return 'operational';
    case 'minor':
      return 'degraded';
    case 'major':
    case 'critical':
      return 'outage';
    case 'maintenance':
      return 'maintenance';
    default:
      return 'unknown';
  }
}

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
  let severity = severityFromIndicator(summary.status?.indicator);
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

/**
 * Per-day incident time for the history chart.
 *
 * Overlapping incidents are merged inside a day, so the number means "time with at
 * least one incident open" rather than the sum of every incident's duration. Providers
 * like Cloudflare post many simultaneous regional incidents, and a summed figure would
 * look far worse than the day actually was.
 */
export function incidentDays(incidents: SpIncident[], days: number): IncidentDay[] {
  const dayMs = 86_400_000;
  const now = new Date();
  const impactRank: Record<string, number> = { none: 0, minor: 1, major: 2, critical: 3 };

  const intervals: { start: number; end: number; impact: IncidentDay['worst'] }[] = [];
  for (const incident of incidents) {
    if (incident.impact === 'none') continue;
    const start = new Date(incident.created_at).getTime();
    if (!Number.isFinite(start)) continue;
    const end = incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now();
    if (!Number.isFinite(end) || end <= start) continue;
    intervals.push({ start, end, impact: incident.impact as IncidentDay['worst'] });
  }

  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const buckets: IncidentDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - i * dayMs);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = dayStart.getTime() + dayMs;

    const overlaps = intervals
      .filter((iv) => iv.end > dayStart.getTime() && iv.start < dayEnd)
      .map((iv) => ({
        start: Math.max(iv.start, dayStart.getTime()),
        end: Math.min(iv.end, dayEnd),
        impact: iv.impact,
      }))
      .sort((a, b) => a.start - b.start);

    let minutes = 0;
    let worst: IncidentDay['worst'] = 'none';

    if (overlaps.length) {
      let cursorStart = overlaps[0].start;
      let cursorEnd = overlaps[0].end;
      for (const iv of overlaps) {
        if (impactRank[iv.impact] > impactRank[worst]) worst = iv.impact;
        if (iv.start <= cursorEnd) {
          cursorEnd = Math.max(cursorEnd, iv.end);
        } else {
          minutes += cursorEnd - cursorStart;
          cursorStart = iv.start;
          cursorEnd = iv.end;
        }
      }
      minutes += cursorEnd - cursorStart;
    }

    buckets.push({
      date: localKey(dayStart),
      minutes: Math.round(minutes / 60_000),
      count: overlaps.length,
      worst,
    });
  }

  return buckets;
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
