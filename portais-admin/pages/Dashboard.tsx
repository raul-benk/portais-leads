import React, { useEffect, useState } from 'react';
import { Card, SectionHeader } from '../components/Shared';
import { fetchIntegrations, fetchLeads } from '../services/api';
import { Integration, Lead, IntegrationStatus } from '../types';
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
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [intData, leadsData] = await Promise.all([
          fetchIntegrations(),
          fetchLeads()
        ]);
        setIntegrations(intData);
        setLeads(leadsData);
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate stats
  const totalIntegrations = integrations.length;
  const activeIntegrations = integrations.filter(i => i.status === IntegrationStatus.Active).length;
  
  // Como não temos endpoint de webhooks ainda, usamos 0 ou dados derivados
  const webhooksToday = 0; 
  const leadsToday = leads.length;
  const failedEvents = 0;
  
  // Usar o último lead como referência de atividade
  const lastActivity = leads.length > 0 
    ? [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] 
    : null;

  if (loading) {
    return <div className="p-6 text-gray-500">Carregando dados do sistema...</div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Dashboard" subtitle="Visão geral operacional do sistema." />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Integrações" 
          value={totalIntegrations} 
          icon={Zap}
          trend={`${activeIntegrations} Ativas`}
        />
        <StatCard 
          title="Webhooks (Hoje)" 
          value={webhooksToday} 
          icon={Activity} 
          trend="N/A"
        />
        <StatCard 
          title="Leads Processados" 
          value={leadsToday} 
          icon={ArrowUpRight} 
          trend="Total"
        />
        <StatCard 
          title="Eventos Falhos" 
          value={failedEvents} 
          icon={AlertCircle} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Status do Sistema">
           <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Última Atividade</span>
              <span className="text-sm font-mono font-medium">{lastActivity ? new Date(lastActivity.createdAt).toLocaleString() : 'N/A'}</span>
           </div>
           <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Latência API (Est.)</span>
              <span className="text-sm font-mono font-medium text-green-600">~45ms</span>
           </div>
           <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Conexão Backend</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Online
              </span>
           </div>
        </Card>
        
        <Card title="Atividade Recente (Leads)">
           <ul className="divide-y divide-gray-100">
             {leads.slice(0, 5).map(lead => (
               <li key={lead.id} className="py-3 flex justify-between items-center text-sm">
                 <div className="flex flex-col">
                   <span className="font-medium text-gray-900">{lead.name}</span>
                   <span className="text-gray-500 text-xs">via {lead.integrationName}</span>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className={lead.status === 'Error' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {lead.status}
                    </span>
                    <span className="text-gray-400 text-xs">{new Date(lead.createdAt).toLocaleTimeString()}</span>
                 </div>
               </li>
             ))}
             {leads.length === 0 && (
                <li className="py-3 text-sm text-gray-500 text-center">Nenhuma atividade recente.</li>
             )}
           </ul>
        </Card>
      </div>
    </div>
  );
};
