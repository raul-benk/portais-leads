import React, { useEffect, useState } from 'react';
import { fetchLeads } from '../services/api';
import { SectionHeader, Card, Badge, formatDate } from '../components/Shared';
import { Lead } from '../types';

export const LeadsGlobal: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLeads();
        setLeads(data);
      } catch (error) {
        console.error('Erro ao buscar leads:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader title="Leads Globais" subtitle="Acompanhe leads processados de todos os clientes." />
      
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Integração</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Carregando...</td>
                </tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Nenhum lead encontrado.</td>
                </tr>
              )}
              {!loading && leads.map((lead) => (
                <tr key={lead.leadId || lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {lead.nome || lead.name || lead.email || 'Sem nome'}
                    <div className="text-xs font-normal text-gray-500">{lead.email || '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.integrationName || lead.integrationId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.fonte_do_lead || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={lead.status === 'sent' ? 'success' : lead.status === 'failed' ? 'error' : 'neutral'}>{lead.status}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.receivedAt ? formatDate(lead.receivedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
