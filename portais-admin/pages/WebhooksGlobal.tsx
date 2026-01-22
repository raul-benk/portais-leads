import React from 'react';
import { MOCK_WEBHOOKS } from '../services/mockData';
import { SectionHeader, Card, Badge, formatDate } from '../components/Shared';
import { WebhookStatus } from '../types';

export const WebhooksGlobal: React.FC = () => {
  return (
    <div className="space-y-6">
      <SectionHeader title="Global Webhook Events" subtitle="Monitor incoming data across all integrations." />
      
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Integration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {MOCK_WEBHOOKS.map((evt) => (
                <tr key={evt.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{evt.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{evt.integrationName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{evt.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={evt.status === WebhookStatus.Processed ? 'success' : evt.status === WebhookStatus.Failed ? 'error' : 'neutral'}>
                      {evt.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(evt.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
