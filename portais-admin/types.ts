export enum IntegrationStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Paused = 'Paused'
}

export interface Integration {
  id: string;
  name: string;
  slug: string;
  status: IntegrationStatus;
  webhookUrl: string;
  createdAt: string;
  lastActivity: string;
  credentials: {
    pitToken: string;
    locationId: string;
    workflowId: string;
    lastUpdated: string;
  };
  checklist: SetupChecklistItem[];
}

export interface SetupChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  status: 'Pending' | 'In Progress' | 'Done';
  notes?: string;
}

export enum WebhookStatus {
  Received = 'Received',
  Processed = 'Processed',
  Failed = 'Failed'
}

export interface WebhookEvent {
  id: string;
  integrationId: string;
  integrationName: string;
  source: string;
  status: WebhookStatus;
  timestamp: string;
  payload: Record<string, any>;
}

export interface Lead {
  id: string;
  integrationId: string;
  integrationName: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: 'New' | 'Synced' | 'Error';
  crmId?: string;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  integrationId?: string;
}

export interface DNSRecord {
  type: string;
  host: string;
  value: string;
}