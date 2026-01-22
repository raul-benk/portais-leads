import React from 'react';
import { Card, SectionHeader } from '../components/Shared';
import { MOCK_INTEGRATIONS, MOCK_WEBHOOKS, MOCK_LEADS } from '../services/mockData';
import { IntegrationStatus, WebhookStatus } from '../types';
import { Activity, AlertCircle, ArrowUpRight, Zap } from 'lucide-react';

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ElementType, trend?: string }> = ({ title, value, icon: Icon, trend }) => (
  <Card className="p-0 overflow-hidden">
    <div className="p-6 flex items-center">
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
        <Icon className="h-6 w-6 text-gray-600" />
      </div>
      <div className="ml-5 w-0 flex-1">
        <dl>
          <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
          <dd>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </dd>
        </dl>
      </div>
    </div>
    {trend && (
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
        <div className="text-sm">
          <span className="font-medium text-gray-900">{trend}</span>
          <span className="text-gray-500"> since yesterday</span>
        </div>
      </div>
    )}
  </Card>
);

export const Dashboard: React.FC = () => {
  // Calculate stats
  const totalIntegrations = MOCK_INTEGRATIONS.length;
  const activeIntegrations = MOCK_INTEGRATIONS.filter(i => i.status === IntegrationStatus.Active).length;
  
  // Mock "Today" filtering by just taking a subset
  const webhooksToday = MOCK_WEBHOOKS.length; 
  const leadsToday = MOCK_LEADS.length;
  const failedEvents = MOCK_WEBHOOKS.filter(w => w.status === WebhookStatus.Failed).length;
  const lastWebhook = MOCK_WEBHOOKS.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  return (
    <div className="space-y-6">
      <SectionHeader title="Dashboard" subtitle="Operational overview of the integration system." />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Integrations" 
          value={totalIntegrations} 
          icon={Zap}
          trend={`${activeIntegrations} Active`}
        />
        <StatCard 
          title="Webhooks Today" 
          value={webhooksToday} 
          icon={Activity} 
          trend="+12%"
        />
        <StatCard 
          title="Leads Processed" 
          value={leadsToday} 
          icon={ArrowUpRight} 
          trend="+5%"
        />
        <StatCard 
          title="Failed Events" 
          value={failedEvents} 
          icon={AlertCircle} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="System Status">
           <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Last Webhook Received</span>
              <span className="text-sm font-mono font-medium">{lastWebhook ? new Date(lastWebhook.timestamp).toLocaleTimeString() : 'N/A'}</span>
           </div>
           <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">API Latency (Avg)</span>
              <span className="text-sm font-mono font-medium text-green-600">45ms</span>
           </div>
           <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Database Connection</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Healthy
              </span>
           </div>
        </Card>
        
        <Card title="Recent Activity">
           <ul className="divide-y divide-gray-100">
             {MOCK_WEBHOOKS.slice(0, 4).map(evt => (
               <li key={evt.id} className="py-3 flex justify-between items-center text-sm">
                 <div className="flex flex-col">
                   <span className="font-medium text-gray-900">{evt.source}</span>
                   <span className="text-gray-500 text-xs">for {evt.integrationName}</span>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className={evt.status === WebhookStatus.Failed ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {evt.status}
                    </span>
                    <span className="text-gray-400 text-xs">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                 </div>
               </li>
             ))}
           </ul>
        </Card>
      </div>
    </div>
  );
};
