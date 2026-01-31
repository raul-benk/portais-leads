import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchIntegrations, createIntegration, deleteIntegration, fetchWebhooks, testIntegration } from '../services/api';
import { Integration, WebhookEvent } from '../types';
import { SectionHeader, Button, Badge, Card, formatDate, Input, cn } from '../components/Shared';
import { Plus, Search, X, Loader2, Trash2, PlayCircle, AlertTriangle } from 'lucide-react';

const getStatusVariant = (status: string) => {
  if (status === 'active') return 'success';
  if (status === 'onboarding') return 'warning';
  if (status === 'error') return 'error';
  return 'neutral';
};

const getStatusLabel = (status: string) => {
  if (status === 'active') return 'Ativo';
  if (status === 'onboarding') return 'Em configuração';
  if (status === 'error') return 'Erro';
  if (status === 'draft') return 'Rascunho';
  return 'Desconhecido';
};

const getChecklistProgress = (integration: Integration) => {
  const required = (integration.checklist || []).filter((item) => item.required);
  if (required.length === 0) {
    return { percent: 0, doneCount: 0, requiredCount: 0 };
  }
  const done = required.filter((item) => item.status === 'done').length;
  return {
    percent: Math.round((done / required.length) * 100),
    doneCount: done,
    requiredCount: required.length
  };
};

const getLastEvent = (events: WebhookEvent[], integrationId: string) => {
  const list = events.filter((event) => event.integrationId === integrationId);
  if (list.length === 0) return null;
  return list
    .map((event) => ({
      ...event,
      _ts: new Date(event.receivedAt || event.processedAt || 0).getTime()
    }))
    .sort((a, b) => b._ts - a._ts)[0];
};

export const Integrations: React.FC = () => {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const internalToken = (import.meta as any)?.env?.VITE_INTERNAL_TOKEN;
  const hasInternalToken = Boolean(internalToken);
  const isDev = (import.meta as any)?.env?.MODE === 'development';
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const internalActionsEnabled = hasInternalToken || isDev || isLocalhost;

  const loadData = async () => {
    try {
      setLoading(true);
      const [integrationData, eventData] = await Promise.all([
        fetchIntegrations(),
        fetchWebhooks()
      ]);
      setIntegrations(integrationData);
      setEvents(eventData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSlug) return;

    try {
      setIsCreating(true);
      setError(null);
      await createIntegration({ name: newName, slug: newSlug });
      await loadData();
      setIsModalOpen(false);
      setNewName('');
      setNewSlug('');
    } catch (err: any) {
      setError(err.message || 'Falha ao criar integração');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir a integração "${name}"? Esta ação não pode ser desfeita.`)) {
      try {
        setLoading(true);
        await deleteIntegration(id);
        await loadData();
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir integração.');
        setLoading(false);
      }
    }
  };

  const handleTest = async (integration: Integration, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    if (!window.confirm(`Executar teste da integração "${integration.name}"?`)) return;
    setActionMessage(null);
    setActionError(null);
    setTestingId(integration.id);
    try {
      const result = await testIntegration(integration.id);
      const steps = (result?.steps || []).map((step: any) => `${step.step}: ${step.ok ? 'ok' : 'falhou'}`).join(', ');
      const timestamp = formatDate(new Date().toISOString());
      if (result?.success) {
        setActionMessage(`Concluído em ${timestamp}. Teste OK. ${steps}`);
      } else {
        setActionError(`Falha em ${timestamp}. ${steps || 'Teste falhou.'} Verifique os logs.`);
      }
    } catch (err: any) {
      setActionError(`${err.message || 'Falha ao testar integração.'} Verifique os logs.`);
    } finally {
      setTestingId(null);
    }
  };

  // Auto-generate slug from name if slug is untouched
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewName(val);
    if (!newSlug || newSlug === val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) {
      setNewSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  const filteredIntegrations = integrations.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Integrações" 
        subtitle="Operação diária de clientes e automações."
        action={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Integração
          </Button>
        }
      />

      {(actionMessage || actionError) && (
        <div className={cn(
          "border-l-4 p-4 rounded",
          actionError ? "bg-red-50 border-red-500 text-red-700" : "bg-green-50 border-green-500 text-green-700"
        )}>
          {actionError || actionMessage}
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <Search className="h-4 w-4 text-gray-400" />
           </div>
           <input
             type="text"
             className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black sm:text-sm"
             placeholder="Buscar por nome ou slug..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      {/* List */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Slug</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Checklist</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Evento</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Erros</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Carregando...</td>
                </tr>
              ) : filteredIntegrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nenhuma integração encontrada.</td>
                </tr>
              ) : (
                filteredIntegrations.map((integration) => {
                  const progress = getChecklistProgress(integration);
                  const lastEvent = getLastEvent(events, integration.id);
                  const hasChecklistError = (integration.checklist || []).some((item) => item.status === 'error');
                  const hasEventError = events.some((event) => event.integrationId === integration.id && event.status === 'failed');
                  const hasError = integration.status === 'error' || hasChecklistError || hasEventError;

                  return (
                    <tr key={integration.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/integrations/${integration.id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                            {integration.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{integration.name}</div>
                            <div className="text-sm text-gray-500">{integration.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(integration.status)}>
                          {getStatusLabel(integration.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div className="bg-black h-2 rounded-full" style={{ width: `${progress.percent}%` }} />
                          </div>
                          <span className="text-xs font-medium">{progress.percent}%</span>
                          <span className="text-xs text-gray-500">{progress.doneCount}/{progress.requiredCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lastEvent?.receivedAt ? formatDate(lastEvent.receivedAt) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {hasError ? (
                          <span className="inline-flex items-center text-red-600 text-xs font-medium">
                            <AlertTriangle className="h-4 w-4 mr-1" /> erro
                          </span>
                        ) : integration.status === 'active' ? (
                          <span className="text-xs text-gray-400">OK</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                         <div className="flex justify-end items-center gap-2">
                           <Button variant="ghost" size="sm" onClick={(e) => {
                             e.stopPropagation();
                             navigate(`/integrations/${integration.id}`);
                           }}>
                             Ver
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={(e) => handleTest(integration, e)}
                             disabled={!internalActionsEnabled || testingId === integration.id}
                           >
                             {testingId === integration.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                             Testar
                           </Button>
                           <button
                              onClick={(e) => handleDelete(integration.id, integration.name, e)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Excluir Integração"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Nova Integração</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              
              <Input 
                label="Nome do Cliente" 
                value={newName} 
                onChange={handleNameChange}
                placeholder="Ex: Concessionária XYZ"
                required
              />
              
              <Input 
                label="Slug (URL)" 
                value={newSlug} 
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="ex: concessionaria-xyz"
                required
              />
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Integração
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
