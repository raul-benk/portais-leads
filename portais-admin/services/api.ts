import { Lead, Integration } from '../types';

const API_URL = 'http://localhost:3434/api';

export const fetchLeads = async (): Promise<Lead[]> => {
  try {
    const response = await fetch(`${API_URL}/leads`);
    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.statusText}`);
    }
    const data = await response.json();

    // Mapeia os dados do backend (leads.json) para o formato esperado pelo frontend (Lead interface)
    return data.map((item: any) => ({
      id: item.leadId,
      integrationId: item.integrationId || 'legacy',
      integrationName: item.integrationName || item.fonte_do_lead || 'Desconhecido',
      name: item.nome || 'Sem Nome',
      email: item.email || '',
      phone: item.telefone || '',
      source: item.fonte_do_lead || 'Desconhecido',
      status: mapStatus(item.status),
      crmId: item.crm?.contactId,
      createdAt: item.receivedAt
    }));
  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    return [];
  }
};

const mapStatus = (backendStatus: string): string => {
  const statusMap: Record<string, string> = {
    'processed': 'Synced',
    'received': 'New',
    'failed': 'Error'
  };
  return statusMap[backendStatus] || backendStatus;
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