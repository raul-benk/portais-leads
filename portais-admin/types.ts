export type IntegrationStatus = 'draft' | 'onboarding' | 'active' | 'error';

export type ChecklistItemStatus = 'pending' | 'done' | 'error';
export type ChecklistItemType = 'auto' | 'manual';
export type ChecklistValidatedBy = 'system' | 'technician' | null;

export interface ChecklistItem {
  key: string;
  label: string;
  type: ChecklistItemType;
  required: boolean;
  dependsOn?: string[];
  status: ChecklistItemStatus;
  notes?: string;
  validatedAt?: string | null;
  validatedBy?: ChecklistValidatedBy;
}

export interface Integration {
  id: string;
  name: string;
  slug: string;
  status: IntegrationStatus;
  crm: {
    locationId: string;
    pitToken?: string;
    workflowId: string;
    workflowIds?: Record<string, string>;
    customWebhookFieldId: string;
    supportUserEmail?: string;
  };
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export type WebhookEventStatus = 'received' | 'processed' | 'failed';

export interface WebhookEvent {
  id?: string;
  eventId?: string;
  integrationId: string;
  integrationSlug?: string;
  status: WebhookEventStatus;
  error?: { code?: string; message?: string; step?: string } | null;
  processedAt?: string | null;
  receivedAt?: string;
  headers?: Record<string, any>;
  body?: Record<string, any>;
  attempts?: number;
}

export type LeadStatus = 'pending' | 'sent' | 'failed';

export interface Lead {
  id?: string;
  leadId?: string;
  eventId?: string;
  integrationId: string;
  integrationName?: string;
  status: LeadStatus;
  lastError?: { code?: string; message?: string } | string | null;
  lastAttemptAt?: string | null;
  attempts?: number;
  receivedAt?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  fonte_do_lead?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  integrationId?: string | null;
  eventId?: string | null;
  leadId?: string | null;
  category: 'EVENT' | 'LEAD' | 'CRM' | 'CHECKLIST' | 'ERROR' | 'RETRY' | string;
  message: string;
  metadata?: Record<string, any>;
}
