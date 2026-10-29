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
  summary: SpSummary | null;
  /** client-side latency samples to the provider's status API, newest last */
  history: number[];
  checkedAt: number;
  error: string | null;
  loading: boolean;
}

export interface IncidentDay {
  date: string;
  minutes: number;
  count: number;
  worst: 'none' | 'minor' | 'major' | 'critical';
}
