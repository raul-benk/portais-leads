import { Integration, ChecklistItem, WebhookEvent, Lead, LogEntry } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

const defaultChecklist: ChecklistItem[] = [
  { key: 'subconta_criada', label: 'Subconta criada', type: 'manual', required: true, status: 'pending' },
  { key: 'pit_token_inserido', label: 'PIT Token inserido', type: 'manual', required: true, status: 'pending' },
  { key: 'workflow_duplicado', label: 'Workflow duplicado', type: 'manual', required: true, status: 'pending' },
  { key: 'custom_value_webhook_criado', label: 'Custom Value Webhook criado', type: 'auto', required: true, status: 'pending' },
  { key: 'dns_configurado', label: 'DNS configurado', type: 'manual', required: true, status: 'pending' },
  { key: 'usuario_suporte_criado', label: 'Usuario de suporte criado', type: 'auto', required: true, status: 'pending' },
  { key: 'webhook_healthcheck', label: 'Webhook healthcheck', type: 'auto', required: true, status: 'pending' },
  { key: 'webhook_testado', label: 'Webhook testado', type: 'auto', required: true, status: 'pending' }
];

export const MOCK_INTEGRATIONS: Integration[] = [
  /*
  {
    id: 'int_1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: IntegrationStatus.Active,
    webhookUrl: 'https://api.opslink.internal/v1/hooks/acme-corp',
    createdAt: '2023-10-15T10:00:00Z',
    lastActivity: '2023-10-27T14:30:00Z',
    credentials: {
      pitToken: 'pit_89s89d89s8d98s9d8s',
      locationId: 'loc_12345',
      workflowId: 'wf_998877',
      lastUpdated: '2023-10-20T09:15:00Z',
    },
    checklist: [...defaultChecklist].map(i => i.id === '1' || i.id === '2' ? { ...i, checked: true, status: 'Done' } : i)
  },
  {
    id: 'int_2',
    name: 'Globex Inc',
    slug: 'globex',
    status: IntegrationStatus.Inactive,
    webhookUrl: 'https://api.opslink.internal/v1/hooks/globex',
    createdAt: '2023-10-22T11:00:00Z',
    lastActivity: '2023-10-25T16:45:00Z',
    credentials: {
      pitToken: '',
      locationId: '',
      workflowId: '',
      lastUpdated: '2023-10-22T11:00:00Z',
    },
    checklist: [...defaultChecklist]
  },
  {
    id: 'int_3',
    name: 'Soylent Corp',
    slug: 'soylent',
    status: IntegrationStatus.Active,
    webhookUrl: 'https://api.opslink.internal/v1/hooks/soylent',
    createdAt: '2023-09-01T08:00:00Z',
    lastActivity: '2023-10-27T15:15:00Z',
    credentials: {
      pitToken: 'pit_valid_token_123',
      locationId: 'loc_99999',
      workflowId: 'wf_11111',
      lastUpdated: '2023-09-02T10:00:00Z',
    },
    checklist: defaultChecklist.map(i => ({ ...i, checked: true, status: 'Done' }))
  }
  */
];

export const MOCK_WEBHOOKS: WebhookEvent[] = [
  /*
  {
    id: 'evt_1',
    integrationId: 'int_1',
    integrationName: 'Acme Corp',
    source: 'Facebook Lead Ads',
    status: WebhookStatus.Processed,
    timestamp: '2023-10-27T14:30:00Z',
    payload: {
      form_id: '123456789',
      leadgen_id: '987654321',
      created_time: '2023-10-27T14:29:55+0000',
      field_data: [
        { name: 'full_name', values: ['John Doe'] },
        { name: 'email', values: ['john.doe@example.com'] },
        { name: 'phone_number', values: ['+15550123456'] }
      ]
    }
  },
  {
    id: 'evt_2',
    integrationId: 'int_1',
    integrationName: 'Acme Corp',
    source: 'Typeform',
    status: WebhookStatus.Failed,
    timestamp: '2023-10-27T12:15:00Z',
    payload: {
      event_id: 'tf_123',
      event_type: 'form_response',
      form_response: {
        token: 'abc12345',
        submitted_at: '2023-10-27T12:14:50Z',
        answers: []
      }
    }
  },
  {
    id: 'evt_3',
    integrationId: 'int_3',
    integrationName: 'Soylent Corp',
    source: 'Website Contact',
    status: WebhookStatus.Received,
    timestamp: '2023-10-27T15:15:00Z',
    payload: {
      source: 'web',
      name: 'Sarah Connor',
      message: 'Interested in your products.'
    }
  }
  */
];

export const MOCK_LEADS: Lead[] = [
  /*
  {
    id: 'lead_1',
    integrationId: 'int_1',
    integrationName: 'Acme Corp',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+15550123456',
    source: 'Facebook',
    status: 'Synced',
    crmId: 'crm_882211',
    createdAt: '2023-10-27T14:30:05Z'
  },
  {
    id: 'lead_2',
    integrationId: 'int_3',
    integrationName: 'Soylent Corp',
    name: 'Sarah Connor',
    email: 'sarah@resistance.org',
    phone: '+15559998888',
    source: 'Website',
    status: 'New',
    createdAt: '2023-10-27T15:15:05Z'
  }
  */
];

export const MOCK_LOGS: LogEntry[] = [
  /*
  { id: 'log_1', timestamp: '2023-10-27T15:15:05Z', level: 'INFO', message: 'Lead created successfully for Soylent Corp', integrationId: 'int_3' },
  { id: 'log_2', timestamp: '2023-10-27T15:15:00Z', level: 'INFO', message: 'Webhook received for Soylent Corp', integrationId: 'int_3' },
  { id: 'log_3', timestamp: '2023-10-27T14:30:05Z', level: 'INFO', message: 'Lead synced to CRM for Acme Corp', integrationId: 'int_1' },
  { id: 'log_4', timestamp: '2023-10-27T12:15:02Z', level: 'ERROR', message: 'Failed to process payload: Missing required fields', integrationId: 'int_1' },
  { id: 'log_5', timestamp: '2023-10-27T10:00:00Z', level: 'WARN', message: 'Rate limit approaching for API Provider X' }
  */
];
