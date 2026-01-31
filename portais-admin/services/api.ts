import { Lead, Integration, WebhookEvent, LogEntry, LeadStatus, WebhookEventStatus } from '../types';

const API_BASE = 'http://localhost:3434';
const API_URL = `${API_BASE}/api`;

const getInternalHeaders = () => {
  const token = (import.meta as any)?.env?.VITE_INTERNAL_TOKEN;
  if (!token) return {};
  return { 'X-Internal-Token': token };
};

const getCrmErrorMessage = (status: number) => {
  if (status === 401 || status === 403) return 'Token inválido ou sem permissão';
  if (status === 404) return 'Recurso não encontrado (workflow/custom value/user)';
  if (status === 422) return 'Dados inválidos para a API';
  return null;
};

const buildCrmError = async (response: Response, fallback: string) => {
  const mapped = getCrmErrorMessage(response.status);
  let payload: any = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  const serverMessage = payload?.error || payload?.message || '';
  const base = mapped || fallback;
  if (serverMessage) {
    return new Error(`${base}. ${serverMessage}`);
  }
  return new Error(`${base}. Verifique os logs.`);
};

const normalizeLeadStatus = (status: string): LeadStatus => {
  const normalized = (status || '').toString().trim().toLowerCase();
  const map: Record<string, LeadStatus> = {
    processed: 'sent',
    synced: 'sent',
    sent: 'sent',
    success: 'sent',
    received: 'pending',
    new: 'pending',
    pending: 'pending',
    failed: 'failed',
    error: 'failed'
  };
  return map[normalized] || 'pending';
};

const normalizeWebhookStatus = (status: string): WebhookEventStatus => {
  const normalized = (status || '').toString().trim().toLowerCase();
  const map: Record<string, WebhookEventStatus> = {
    received: 'received',
    processed: 'processed',
    failed: 'failed'
  };
  return map[normalized] || 'received';
};

export const fetchLeads = async (): Promise<Lead[]> => {
  try {
    const response = await fetch(`${API_URL}/leads`);
    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.statusText}`);
    }
    const data = await response.json();

    return data.map((item: any) => ({
      ...item,
      id: item.leadId || item.id,
      leadId: item.leadId || item.id,
      integrationId: item.integrationId || 'legacy',
      integrationName: item.integrationName || item.fonte_do_lead || 'Desconhecido',
      status: normalizeLeadStatus(item.status),
      receivedAt: item.receivedAt || item.createdAt || item.received_at,
      lastError: item.lastError ?? item.error ?? null
    }));
  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    return [];
  }
};

export const fetchWebhooks = async (): Promise<WebhookEvent[]> => {
  try {
    const response = await fetch(`${API_URL}/webhooks`);
    if (!response.ok) throw new Error('Falha ao buscar webhooks');
    const data = await response.json();

    return data.map((item: any) => ({
      ...item,
      id: item.id || item.eventId,
      eventId: item.eventId || item.id,
      integrationId: item.integrationId,
      integrationSlug: item.integrationSlug || item.integrationName,
      status: normalizeWebhookStatus(item.status),
      receivedAt: item.receivedAt || item.timestamp
    }));
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error);
    return [];
  }
};

export const fetchLogs = async (): Promise<LogEntry[]> => {
  try {
    const response = await fetch(`${API_URL}/logs`);
    if (!response.ok) throw new Error('Falha ao buscar logs');
    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    return [];
  }
};

// --- Métodos de Integração ---

export const fetchIntegrations = async (): Promise<Integration[]> => {
  try {
    const response = await fetch(`${API_URL}/integrations`);
    if (!response.ok) throw new Error('Falha ao buscar integrações');
    return await response.json();
  } catch (error) {
    console.error('Erro em fetchIntegrations:', error);
    return [];
  }
};

export const createIntegration = async (data: { name: string; slug: string }): Promise<Integration> => {
  const response = await fetch(`${API_URL}/integrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Falha ao criar integração');
  }
  return await response.json();
};

export const updateIntegration = async (id: string, data: Partial<Integration>): Promise<Integration> => {
  const response = await fetch(`${API_URL}/integrations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Falha ao atualizar integração');
  return await response.json();
};

export const patchIntegrationCrm = async (
  id: string,
  data: { locationId?: string; pitToken?: string }
): Promise<Integration> => {
  const response = await fetch(`${API_BASE}/integrations/${id}/crm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getInternalHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao atualizar CRM');
  }
  return await response.json();
};

export const identifyWorkflow = async (
  id: string
): Promise<{ found: boolean; workflowId?: string; workflowIds?: Record<string, string>; missingNames?: string[] }> => {
  const response = await fetch(`${API_BASE}/integrations/${id}/crm/identify-workflow`, {
    method: 'POST',
    headers: {
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    throw await buildCrmError(response, 'Falha ao identificar workflow');
  }
  return await response.json();
};

export const createWebhookValue = async (id: string): Promise<Integration> => {
  const response = await fetch(`${API_BASE}/integrations/${id}/crm/create-webhook-value`, {
    method: 'POST',
    headers: {
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    throw await buildCrmError(response, 'Falha ao criar custom value');
  }
  return await response.json();
};

export const createSupportUser = async (id: string): Promise<Integration> => {
  const response = await fetch(`${API_BASE}/integrations/${id}/crm/create-support-user`, {
    method: 'POST',
    headers: {
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    throw await buildCrmError(response, 'Falha ao criar usuário de suporte');
  }
  return await response.json();
};

export const runWebhookHealthcheck = async (id: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/integrations/${id}/webhook/healthcheck`, {
    method: 'POST',
    headers: {
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao executar healthcheck');
  }
  return await response.json();
};

export const anonymizeLead = async (leadId: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/leads/${leadId}/anonymize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Confirm-Action': 'true',
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao anonimizar lead');
  }
  return await response.json();
};

export const deleteLead = async (leadId: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/leads/${leadId}`, {
    method: 'DELETE',
    headers: {
      'X-Confirm-Action': 'true',
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao remover lead');
  }
  return await response.json();
};

export const deleteIntegration = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/integrations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Falha ao excluir integração');
};

export const testIntegration = async (id: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/integrations/${id}/test`, {
    method: 'POST',
    headers: {
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao testar integração');
  }
  return await response.json();
};

export const reprocessEvent = async (eventId: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/events/${eventId}/reprocess`, {
    method: 'POST',
    headers: {
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao reprocessar evento');
  }
  return await response.json();
};

export const reprocessLead = async (leadId: string): Promise<any> => {
  const response = await fetch(`${API_BASE}/leads/${leadId}/reprocess`, {
    method: 'POST',
    headers: {
      ...getInternalHeaders()
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao reprocessar lead');
  }
  return await response.json();
};

export const completeChecklistItem = async (integrationId: string, key: string, notes?: string): Promise<Integration> => {
  const response = await fetch(`${API_BASE}/integrations/${integrationId}/checklist/${key}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getInternalHeaders() },
    body: JSON.stringify({ notes })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao atualizar checklist');
  }
  return await response.json();
};
