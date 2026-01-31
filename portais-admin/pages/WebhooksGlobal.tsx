import React, { useEffect, useState } from 'react';
import { fetchWebhooks } from '../services/api';
import { SectionHeader, Card, Badge, formatDate } from '../components/Shared';
import { WebhookEvent } from '../types';

const resolveEventSource = (event: WebhookEvent) => {
  const headers = event.headers || {};
  if (headers['x-test'] || headers['X-Test']) return 'test';
  if ((event.attempts || 1) > 1) return 'retry';
  return 'webhook';
};

export const WebhooksGlobal: React.FC = () => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchWebhooks();
        setEvents(data);
      } catch (error) {
        console.error('Erro ao buscar webhooks:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader title="Eventos de Webhook Globais" subtitle="Monitore dados recebidos de todas as integrações." />
      
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EventId</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Integração</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Carregando...</td>
                </tr>
              )}
              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Nenhum evento encontrado.</td>
                </tr>
              )}
              {!loading && events.map((evt) => (
                <tr key={evt.eventId || evt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{evt.eventId || evt.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{evt.integrationSlug || evt.integrationId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{resolveEventSource(evt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={evt.status === 'processed' ? 'success' : evt.status === 'failed' ? 'error' : 'neutral'}>
                      {evt.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{evt.receivedAt ? formatDate(evt.receivedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
