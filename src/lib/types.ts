export type Severity = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'unknown';

export type Category = 'Dev & CI' | 'Infrastructure' | 'AI' | 'Communication' | 'Productivity' | 'Commerce';

export interface SpComponent {
  id: string;
  name: string;
  status: string;
  description?: string | null;
  group?: boolean;
  group_id?: string | null;
  position?: number;
}

export interface SpIncidentUpdate {
  body: string;
  status: string;
  created_at: string;
}

export interface SpIncident {
  id: string;
  name: string;
  status: string;
  impact: 'none' | 'minor' | 'major' | 'critical' | string;
  created_at: string;
  resolved_at: string | null;
  shortlink?: string;
  components: { id: string; name: string }[];
  incident_updates: SpIncidentUpdate[];
}

export interface SpSummary {
  page: { id: string; name: string; url: string; updated_at: string };
  status: { indicator: string; description: string };
  components: SpComponent[];
  incidents: SpIncident[];
  scheduled_maintenances: SpIncident[];
}

export interface ServiceDef {
  id: string;
  name: string;
  category: Category;
  /** statuspage base URL, no trailing slash */
  base: string;
  homepage: string;
}

export interface ServiceState {
  def: ServiceDef;
  severity: Severity;
  /** the provider's own words for the current state */
  description: string;
  /** newest last; each sample is the upstream response time from the proxy */
  history: number[];
  /** last successful upstream fetch */
  fetchedAt: number;
  /** last attempt, successful or not */
  checkedAt: number;
  latencyMs: number;
  error: string | null;
  /** previous data being shown because the latest attempt failed */
  stale: boolean;
  loading: boolean;
}

/** One service as reported by the /api/status function. */
export interface StatusEntry {
  id: string;
  name: string;
  category: Category;
  severity: Severity;
  description: string;
  fetchedAt: number;
  checkedAt: number;
  latencyMs: number;
  error: string | null;
  stale: boolean;
}

export interface StatusPayload {
  generatedAt: number;
  servedFrom: 'cache' | 'refreshed';
  services: StatusEntry[];
}

export interface DetailPayload {
  id: string;
  name: string;
  summary: SpSummary | null;
  incidents: SpIncident[];
  severity: Severity;
  fetchedAt: number;
  error: string | null;
  stale: boolean;
}

export interface IncidentDay {
  date: string;
  minutes: number;
  count: number;
  worst: 'none' | 'minor' | 'major' | 'critical';
}
