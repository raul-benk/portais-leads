import { Lead } from '../types';

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
      integrationId: 'legacy', // Valor padrão, já que o backend não possui este campo por lead
      integrationName: item.fonte_do_lead || 'Desconhecido',
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