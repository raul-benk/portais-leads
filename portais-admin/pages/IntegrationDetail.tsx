import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_WEBHOOKS, MOCK_LEADS } from '../services/mockData'; // Mantendo mocks apenas para Events/Leads por enquanto
import { fetchIntegrations, updateIntegration } from '../services/api';
import { Integration, IntegrationStatus, SetupChecklistItem } from '../types';
import { SectionHeader, Button, Badge, Card, CopyInput, Input, Checkbox, formatDate, cn, EmptyState } from '../components/Shared';
import { ArrowLeft, Save, RefreshCw, Eye, AlertCircle, Terminal, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';

// --- Sub-Components for Tabs ---

const OverviewTab: React.FC<{ integration: Integration, onToggleStatus: () => void }> = ({ integration, onToggleStatus }) => (
  <div className="space-y-6">
    <Card title="Integration Details">
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700">Integration Name</label>
          <div className="mt-1 text-sm text-gray-900">{integration.name}</div>
        </div>

        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700">Slug</label>
          <div className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 inline-block px-2 py-0.5 rounded">{integration.slug}</div>
        </div>

        <div className="sm:col-span-6">
          <CopyInput label="Webhook Endpoint URL" value={integration.webhookUrl} />
          <p className="mt-2 text-xs text-gray-500">Provide this URL to the client or configure it in the lead source.</p>
        </div>

        <div className="sm:col-span-3">
           <label className="block text-sm font-medium text-gray-700">Current Status</label>
           <div className="mt-2 flex items-center space-x-4">
             <Badge variant={integration.status === IntegrationStatus.Active ? 'success' : 'neutral'}>
               {integration.status}
             </Badge>
             <Button variant="outline" size="sm" onClick={onToggleStatus}>
               {integration.status === IntegrationStatus.Active ? 'Pause Integration' : 'Activate Integration'}
             </Button>
           </div>
        </div>

        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-gray-700">Timestamps</label>
          <div className="mt-1 text-xs text-gray-500 space-y-1">
             <p>Created: {formatDate(integration.createdAt)}</p>
             <p>Last Activity: {formatDate(integration.lastActivity)}</p>
          </div>
        </div>
      </div>
    </Card>
  </div>
);

const CredentialsTab: React.FC<{ integration: Integration, onUpdate: (data: Partial<Integration>) => Promise<void> }> = ({ integration, onUpdate }) => {
  const [formData, setFormData] = useState(integration.credentials);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({ credentials: { ...integration.credentials, ...formData } });
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card title="CRM Configuration">
        <div className="space-y-6">
          <div className="relative">
            <Input 
              label="PIT Token (Bearer)" 
              name="pitToken"
              type={showToken ? 'text' : 'password'}
              value={formData.pitToken} 
              onChange={handleChange}
            />
            <button 
              type="button" 
              className="absolute right-0 top-6 mt-1 mr-2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowToken(!showToken)}
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Input label="Location ID" name="locationId" value={formData.locationId} onChange={handleChange} />
            <Input label="Workflow ID" name="workflowId" value={formData.workflowId} onChange={handleChange} />
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Last updated: {formatDate(integration.credentials.lastUpdated)}</span>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Credenciais
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const ChecklistTab: React.FC<{ integration: Integration, onUpdate: (data: Partial<Integration>) => Promise<void> }> = ({ integration, onUpdate }) => {
  const [items, setItems] = useState<SetupChecklistItem[]>(integration.checklist);
  const [saving, setSaving] = useState(false);

  const toggleItem = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, checked: !item.checked, status: !item.checked ? 'Done' : 'Pending' } : item
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({ checklist: items });
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const completed = items.filter(i => i.checked).length;
  const progress = Math.round((completed / items.length) * 100);

  return (
    <div className="space-y-6">
      <Card title="Operational Setup Checklist">
        <div className="mb-6">
          <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
             <span>Setup Progress</span>
             <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-black h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
          {items.map(item => (
            <li key={item.id} className={cn("p-4 hover:bg-gray-50 transition-colors", item.checked ? "bg-gray-50" : "bg-white")}>
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    className="focus:ring-black h-4 w-4 text-black border-gray-300 rounded"
                    checked={item.checked}
                    onChange={() => toggleItem(item.id)}
                  />
                </div>
                <div className="ml-3 text-sm flex-1">
                  <label className={cn("font-medium block", item.checked ? "text-gray-500 line-through" : "text-gray-900")}>
                    {item.label}
                  </label>
                  {item.notes && <p className="text-gray-500 mt-1 text-xs">{item.notes}</p>}
                </div>
                <div className="ml-3">
                   <Badge variant={item.status === 'Done' ? 'success' : 'neutral'}>{item.status}</Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-right">
           <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
             {saving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
             Atualizar Checklist
           </Button>
        </div>
      </Card>
    </div>
  );
};

const DNSInstructionsTab: React.FC<{ integration: Integration }> = ({ integration }) => {
  const subdomain = `${integration.slug}.leads.system`;
  
  const records = [
    { type: 'CNAME', host: subdomain, value: 'ingress.opslink.internal' },
    { type: 'TXT', host: subdomain, value: `v=spf1 include:${integration.slug}.mailgun.org ~all` }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
         <div className="flex">
           <div className="flex-shrink-0">
             <AlertCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
           </div>
           <div className="ml-3">
             <h3 className="text-sm font-medium text-blue-800">DNS Configuration Required</h3>
             <div className="mt-2 text-sm text-blue-700">
               <p>Please provide these records to the client's IT team. These records verify domain ownership and enable email sending.</p>
             </div>
           </div>
         </div>
      </div>

      <Card title="DNS Records">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                 <th className="relative px-6 py-3"><span className="sr-only">Copy</span></th>
               </tr>
             </thead>
             <tbody className="bg-white divide-y divide-gray-200">
               {records.map((record, idx) => (
                 <tr key={idx}>
                   <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{record.type}</td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{record.host}</td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{record.value}</td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                     <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${record.type} ${record.host} ${record.value}`)}>
                       Copy
                     </Button>
                   </td>
                 </tr>
               ))}
             </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const EventsTab: React.FC<{ integrationId: string }> = ({ integrationId }) => {
  const events = MOCK_WEBHOOKS.filter(e => e.integrationId === integrationId);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card title="Webhook History" className="p-0">
           {events.length === 0 ? (
             <EmptyState title="No Events" description="No webhooks have been received yet." />
           ) : (
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50">
                   <tr>
                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                     <th className="px-4 py-3"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200 bg-white">
                   {events.map(event => (
                     <tr key={event.id} 
                         className={cn("cursor-pointer hover:bg-gray-50", selectedEvent === event.id ? "bg-gray-50" : "")}
                         onClick={() => setSelectedEvent(event.id)}>
                       <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{event.source}</td>
                       <td className="px-4 py-3 whitespace-nowrap">
                         <Badge variant={event.status === 'Processed' ? 'success' : event.status === 'Failed' ? 'error' : 'neutral'}>{event.status}</Badge>
                       </td>
                       <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</td>
                       <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                         {selectedEvent === event.id && <Eye className="h-4 w-4 text-gray-400" />}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </Card>
      </div>
      <div>
        <Card title="Payload Viewer" className="h-full">
           {selectedEvent ? (
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <span className="text-xs font-mono text-gray-500">ID: {selectedEvent}</span>
                   <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(events.find(e => e.id === selectedEvent)?.payload))}>Copy JSON</Button>
                </div>
                <div className="bg-gray-900 rounded-md p-4 overflow-auto raw-scroll h-[calc(100vh-400px)] min-h-[300px]">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                    {JSON.stringify(events.find(e => e.id === selectedEvent)?.payload, null, 2)}
                  </pre>
                </div>
             </div>
           ) : (
             <div className="h-full flex items-center justify-center text-gray-400 text-sm">
               Select an event to view payload
             </div>
           )}
        </Card>
      </div>
    </div>
  );
};

const LeadsTab: React.FC<{ integrationId: string }> = ({ integrationId }) => {
  const leads = MOCK_LEADS.filter(l => l.integrationId === integrationId);
  return (
    <Card title="Processed Leads" className="p-0">
      {leads.length === 0 ? (
        <EmptyState title="No Leads" description="No leads have been processed yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CRM ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leads.map(lead => (
                <tr key={lead.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{lead.email}</div>
                    <div className="text-xs">{lead.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={lead.status === 'Synced' ? 'success' : 'neutral'}>{lead.status}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{lead.crmId || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};


// --- Main Page Component ---

export const IntegrationDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [integration, setIntegration] = useState<Integration | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'credentials' | 'checklist' | 'dns' | 'events' | 'leads'>('overview');

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await fetchIntegrations();
      const found = list.find(i => i.id === id);
      setIntegration(found);
    } catch (e) {
      console.error("Failed to load integration", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando detalhes...</div>;
  if (!integration) return <div className="p-8 text-center text-red-500">Integração não encontrada.</div>;

  const handleUpdate = async (updates: Partial<Integration>) => {
    if (!integration) return;
    await updateIntegration(integration.id, updates);
    await loadData();
  };

  const handleToggleStatus = async () => {
    const newStatus = integration.status === IntegrationStatus.Active ? IntegrationStatus.Paused : IntegrationStatus.Active;
    await handleUpdate({ status: newStatus });
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'credentials', label: 'Credentials' },
    { id: 'checklist', label: 'Setup Checklist' },
    { id: 'dns', label: 'DNS Instructions' },
    { id: 'events', label: 'Events' },
    { id: 'leads', label: 'Leads' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/integrations')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
         <div className="flex items-center space-x-4">
            <div className="h-14 w-14 bg-black text-white rounded-lg flex items-center justify-center text-xl font-bold">
              {integration.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{integration.name}</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{integration.slug}</span>
                <span>•</span>
                <span className={cn("font-medium", integration.status === IntegrationStatus.Active ? "text-green-600" : "text-gray-500")}>
                  {integration.status}
                </span>
              </div>
            </div>
         </div>
         <div className="mt-4 md:mt-0 flex space-x-3">
            <Button variant="outline" onClick={loadData}>
               <RefreshCw className="h-4 w-4 mr-2" />
               Sync Config
            </Button>
            <Button variant="outline" onClick={() => window.open(integration.webhookUrl, '_blank')}>
               <ExternalLink className="h-4 w-4 mr-2" />
               Test Webhook
            </Button>
         </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                activeTab === tab.id
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'overview' && <OverviewTab integration={integration} onToggleStatus={handleToggleStatus} />}
        {activeTab === 'credentials' && <CredentialsTab integration={integration} onUpdate={handleUpdate} />}
        {activeTab === 'checklist' && <ChecklistTab integration={integration} onUpdate={handleUpdate} />}
        {activeTab === 'dns' && <DNSInstructionsTab integration={integration} />}
        {activeTab === 'events' && <EventsTab integrationId={integration.id} />}
        {activeTab === 'leads' && <LeadsTab integrationId={integration.id} />}
      </div>
    </div>
  );
};