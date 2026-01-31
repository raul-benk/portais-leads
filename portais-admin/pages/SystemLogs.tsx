import React, { useEffect, useState } from 'react';
import { fetchLogs } from '../services/api';
import { SectionHeader, Card, Badge, formatDate } from '../components/Shared';
import { LogEntry } from '../types';

const getBadgeVariant = (category: string) => {
  if (category === 'ERROR') return 'error';
  if (category === 'CHECKLIST') return 'warning';
  if (category === 'CRM') return 'neutral';
  return 'neutral';
};

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLogs();
        setLogs(data);
      } catch (error) {
        console.error('Erro ao buscar logs:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader title="Logs do Sistema" subtitle="Trilhas de auditoria e relatórios de erro." />
      
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensagem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Integração</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EventId</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Carregando...</td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Nenhum log encontrado.</td>
                </tr>
              )}
              {!loading && logs.map((log, index) => (
                <tr key={`${log.timestamp}-${index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{formatDate(log.timestamp)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getBadgeVariant(log.category)}>{log.category}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{log.message}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.integrationId || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{log.eventId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
