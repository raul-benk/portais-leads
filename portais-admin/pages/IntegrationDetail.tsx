import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchIntegrations, fetchWebhooks, fetchLeads, fetchLogs, completeChecklistItem, reprocessEvent, reprocessLead, testIntegration, patchIntegrationCrm, identifyWorkflow, runWebhookHealthcheck, createWebhookValue, createSupportUser, anonymizeLead, deleteLead } from '../services/api';
import { Integration, WebhookEvent, Lead, LogEntry, ChecklistItem, ChecklistItemType } from '../types';
import { SectionHeader, Button, Badge, Card, CopyInput, Input, Checkbox, formatDate, cn } from '../components/Shared';
import { ArrowLeft, RefreshCw, PlayCircle, AlertTriangle, XCircle, RotateCcw, X } from 'lucide-react';

type TabKey = 'checklist' | 'events' | 'leads' | 'logs';

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

const getChecklistProgress = (items: ChecklistItem[]) => {
  const required = (items || []).filter((item) => item.required);
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

const resolveEventSource = (event: WebhookEvent) => {
  const headers = event.headers || {};
  if (headers['x-test'] || headers['X-Test']) return 'test';
  if ((event.attempts || 1) > 1) return 'retry';
  return 'webhook';
};

const CHECKLIST_ORDER = [
  'subconta_criada',
  'pit_token_inserido',
  'workflow_duplicado',
  'custom_value_webhook_criado',
  'dns_configurado',
  'usuario_suporte_criado',
  'webhook_healthcheck',
  'webhook_testado'
];

const CHECKLIST_DEFINITIONS: Record<string, { label: string; type: ChecklistItemType; required: boolean; dependsOn?: string[] }> = {
  subconta_criada: { label: 'Subconta criada', type: 'manual', required: true },
  pit_token_inserido: { label: 'PIT Token inserido', type: 'manual', required: true },
  workflow_duplicado: { label: 'Workflow duplicado', type: 'manual', required: true },
  custom_value_webhook_criado: { label: 'Custom Value Webhook criado', type: 'auto', required: true, dependsOn: ['subconta_criada', 'pit_token_inserido'] },
  dns_configurado: { label: 'DNS configurado', type: 'manual', required: true },
  usuario_suporte_criado: { label: 'Usuario de suporte criado', type: 'auto', required: true, dependsOn: ['subconta_criada', 'pit_token_inserido', 'dns_configurado'] },
  webhook_healthcheck: { label: 'Webhook healthcheck', type: 'auto', required: true, dependsOn: ['subconta_criada'] },
  webhook_testado: { label: 'Webhook testado', type: 'auto', required: true, dependsOn: ['webhook_healthcheck'] }
};

const MANUAL_ASSISTED_KEYS = new Set(['subconta_criada', 'pit_token_inserido']);

export const IntegrationDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('checklist');

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [locationIdInput, setLocationIdInput] = useState('');
  const [pitTokenInput, setPitTokenInput] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'processed' | 'failed'>('all');
  const [eventIdFilter, setEventIdFilter] = useState('');
  const [leadFilter, setLeadFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [logFilterCategory, setLogFilterCategory] = useState<string>('all');
  const [logFilterEventId, setLogFilterEventId] = useState<string>('');
  const [dnsHelpOpen, setDnsHelpOpen] = useState(false);

  const internalToken = (import.meta as any)?.env?.VITE_INTERNAL_TOKEN;
  const hasInternalToken = Boolean(internalToken);
  const isStaging = (import.meta as any)?.env?.VITE_ENV === 'staging';
  const isDev = (import.meta as any)?.env?.MODE === 'development';
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const internalActionsEnabled = hasInternalToken || isDev || isLocalhost;
  const lgpdEnabled = internalActionsEnabled && !isStaging;

  const dnsDomain = integration?.slug ? `${integration.slug}.appzoi.com.br` : '<slug>.appzoi.com.br';
  const dnsUrl = integration?.crm?.locationId
    ? `https://app.zoitech.com.br/v2/location/${integration.crm.locationId}/settings/smtp_service`
    : 'https://app.zoitech.com.br/v2/location/<locationId>/settings/smtp_service';

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [integrationData, eventData, leadData, logData] = await Promise.all([
        fetchIntegrations(),
        fetchWebhooks(),
        fetchLeads(),
        fetchLogs()
      ]);
      const found = integrationData.find((item) => item.id === id) || null;
      setIntegration(found);
      setEvents(eventData);
      setLeads(leadData);
      setLogs(logData);
    } catch (error) {
      console.error('Erro ao carregar integração:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (!integration) return;
    setLocationIdInput(integration.crm?.locationId || '');
    setPitTokenInput('');
  }, [integration?.id]);

  const integrationEvents = useMemo(
    () => events.filter((event) => event.integrationId === integration?.id),
    [events, integration?.id]
  );

  const integrationLeads = useMemo(
    () => leads.filter((lead) => lead.integrationId === integration?.id),
    [leads, integration?.id]
  );

  const integrationLogs = useMemo(
    () => logs.filter((log) => log.integrationId === integration?.id),
    [logs, integration?.id]
  );

  const filteredEvents = integrationEvents.filter((event) => {
    if (eventFilter !== 'all' && event.status !== eventFilter) return false;
    if (eventIdFilter) {
      const eventId = event.eventId || event.id || '';
      if (!eventId.includes(eventIdFilter)) return false;
    }
    return true;
  });

  const filteredLeads = integrationLeads.filter((lead) => {
    if (leadFilter === 'all') return true;
    return lead.status === leadFilter;
  });

  const filteredLogs = integrationLogs.filter((log) => {
    if (logFilterCategory !== 'all' && log.category !== logFilterCategory) return false;
    if (logFilterEventId && !(log.eventId || '').includes(logFilterEventId)) return false;
    return true;
  });

  const logCategories = Array.from(new Set(integrationLogs.map((log) => log.category))).sort();

  const formatActionTimestamp = (timestamp?: string) => formatDate(timestamp || new Date().toISOString());

  const copyToClipboard = async (value: string, label = 'eventId') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setActionError(null);
      setActionMessage(`${label} copiado.`);
    } catch (error) {
      setActionError('Falha ao copiar.');
    }
  };

  const confirmTypedAction = (confirmText: string, description: string) => {
    const typed = window.prompt(`${description}\nAção irreversível. Digite "${confirmText}" para confirmar.`);
    if (typed !== confirmText) {
      setActionMessage(null);
      setActionError('Confirmação incorreta.');
      return false;
    }
    return true;
  };

  const orderedChecklist = useMemo(() => {
    if (!integration) return [];
    const byKey = new Map((integration.checklist || []).map((item) => [item.key, item]));
    return CHECKLIST_ORDER.map((key) => {
      const existing = byKey.get(key);
      if (existing) return existing;
      const definition = CHECKLIST_DEFINITIONS[key];
      return {
        key,
        label: definition?.label || key,
        type: definition?.type || 'auto',
        required: Boolean(definition?.required),
        dependsOn: definition?.dependsOn || [],
        status: 'pending'
      } as ChecklistItem;
    });
  }, [integration]);

  const checklistStatusByKey = useMemo(
    () => new Map(orderedChecklist.map((item) => [item.key, item.status])),
    [orderedChecklist]
  );

  const checklistLabelByKey = useMemo(
    () => new Map(orderedChecklist.map((item) => [item.key, item.label])),
    [orderedChecklist]
  );

  const isChecklistDone = (key: string) => checklistStatusByKey.get(key) === 'done';

  const resolveDependsOn = (item: ChecklistItem) =>
    (item.dependsOn && item.dependsOn.length > 0
      ? item.dependsOn
      : CHECKLIST_DEFINITIONS[item.key]?.dependsOn || []);

  const handleManualChecklist = async (item: ChecklistItem) => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    if (!window.confirm(`Marcar "${item.label}" como concluído?`)) return;

    setSavingKey(item.key);
    setActionMessage(null);
    setActionError(null);
    try {
      const updated = await completeChecklistItem(integration.id, item.key);
      setIntegration(updated);
      setActionMessage(`Checklist "${item.label}" atualizado com sucesso.`);
    } catch (error: any) {
      setActionError(error.message || 'Falha ao atualizar checklist.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveLocationId = async () => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    const value = locationIdInput.trim();
    if (!value) {
      setActionMessage(null);
      setActionError('Informe o Location ID.');
      return;
    }
    setSavingKey('subconta_criada');
    setActionMessage(null);
    setActionError(null);
    try {
      const updated = await patchIntegrationCrm(integration.id, { locationId: value });
      setIntegration(updated);
      setLocationIdInput(updated.crm?.locationId || value);
      setActionMessage('Location ID atualizado com sucesso.');
    } catch (error: any) {
      setActionError(error.message || 'Falha ao atualizar Location ID.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSavePitToken = async () => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    const value = pitTokenInput.trim();
    if (!value) {
      setActionMessage(null);
      setActionError('Informe o PIT Token.');
      return;
    }
    setSavingKey('pit_token_inserido');
    setActionMessage(null);
    setActionError(null);
    try {
      const updated = await patchIntegrationCrm(integration.id, { pitToken: value });
      setIntegration(updated);
      setPitTokenInput('');
      setActionMessage('PIT Token atualizado com sucesso.');
    } catch (error: any) {
      setActionError(error.message || 'Falha ao atualizar PIT Token.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleIdentifyWorkflow = async () => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    setSavingKey('workflow_duplicado:identify');
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await identifyWorkflow(integration.id);
      if (result?.found) {
        const workflowIds = result.workflowIds || {};
        const foundNames = Object.keys(workflowIds);
        const foundLabel = foundNames.length > 0
          ? `Encontrados ${foundNames.length}.`
          : 'Workflow identificado.';
        const missingLabel = result.missingNames?.length
          ? `Não encontrados: ${result.missingNames.join(', ')}.`
          : '';
        setActionMessage(`Concluído em ${formatActionTimestamp()}. ${foundLabel} ${missingLabel}`.trim());
      } else {
        setActionMessage(`Concluído em ${formatActionTimestamp()}. Workflow não encontrado.`);
      }
      await loadData();
    } catch (error: any) {
      setActionError(`${error.message || 'Falha ao buscar Workflow ID.'} Verifique os logs.`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateCustomValue = async () => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    setSavingKey('custom_value_webhook_criado');
    setActionMessage(null);
    setActionError(null);
    try {
      const updated = await createWebhookValue(integration.id);
      setIntegration(updated);
      setActionMessage('Custom Value criado com sucesso.');
    } catch (error: any) {
      setActionError(error.message || 'Falha ao criar Custom Value.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateSupportUser = async () => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    setSavingKey('usuario_suporte_criado');
    setActionMessage(null);
    setActionError(null);
    try {
      const updated = await createSupportUser(integration.id);
      setIntegration(updated);
      const email = updated?.crm?.supportUserEmail;
      const detail = email ? `Email: ${email}.` : 'Usuário criado.';
      setActionMessage(`Concluído em ${formatActionTimestamp()}. ${detail}`);
    } catch (error: any) {
      setActionError(`${error.message || 'Falha ao criar usuário de suporte.'} Verifique os logs.`);
      await loadData();
    } finally {
      setSavingKey(null);
    }
  };

  const handleRunHealthcheck = async () => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    setSavingKey('webhook_healthcheck');
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await runWebhookHealthcheck(integration.id);
      if (result?.ok) {
        setActionMessage(`Concluído em ${formatActionTimestamp(result?.timestamp)}. Health check OK.`);
      } else {
        setActionError(`${result?.reason || 'Health check falhou.'} Verifique os logs.`);
      }
      await loadData();
    } catch (error: any) {
      setActionError(`${error.message || 'Falha ao executar health check.'} Verifique os logs.`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleTestIntegration = async () => {
    if (!integration) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    if (!window.confirm(`Executar teste da integração "${integration.name}"?`)) return;
    setActionMessage(null);
    setActionError(null);
    try {
      const result = await testIntegration(integration.id);
      const steps = (result?.steps || []).map((step: any) => `${step.step}: ${step.ok ? 'ok' : 'falhou'}`).join(', ');
      const timestamp = formatActionTimestamp();
      if (result?.success) {
        setActionMessage(`Concluído em ${timestamp}. Teste OK. ${steps}`);
      } else {
        setActionError(`Falha em ${timestamp}. ${steps || 'Teste falhou.'} Verifique os logs.`);
      }
      await loadData();
    } catch (error: any) {
      setActionError(`${error.message || 'Falha ao testar integração.'} Verifique os logs.`);
    }
  };

  const handleReprocessEvent = async (eventId?: string) => {
    if (!eventId) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    if (!window.confirm(`Reprocessar evento ${eventId}?`)) return;
    setActionMessage(null);
    setActionError(null);
    try {
      await reprocessEvent(eventId);
      setActionMessage('Evento reprocessado com sucesso.');
      await loadData();
    } catch (error: any) {
      setActionError(error.message || 'Falha ao reprocessar evento.');
    }
  };

  const handleReprocessLead = async (leadId?: string) => {
    if (!leadId) return;
    if (!internalActionsEnabled) {
      setActionMessage(null);
      setActionError('Ações internas desabilitadas.');
      return;
    }
    if (!window.confirm(`Reprocessar lead ${leadId}?`)) return;
    setActionMessage(null);
    setActionError(null);
    try {
      await reprocessLead(leadId);
      setActionMessage('Lead reprocessado com sucesso.');
      await loadData();
    } catch (error: any) {
      setActionError(error.message || 'Falha ao reprocessar lead.');
    }
  };

  const handleAnonymizeLead = async (leadId: string, leadName: string) => {
    if (!lgpdEnabled) {
      setActionMessage(null);
      setActionError('Ações LGPD desabilitadas.');
      return;
    }
    if (!confirmTypedAction('ANONIMIZAR', `Anonimizar lead "${leadName}"?`)) return;
    setActionMessage(null);
    setActionError(null);
    try {
      await anonymizeLead(leadId);
      setActionMessage(`Concluído em ${formatActionTimestamp()}. Lead anonimizado.`);
      await loadData();
    } catch (error: any) {
      setActionError(`${error.message || 'Falha ao anonimizar lead.'} Verifique os logs.`);
    }
  };

  const handleDeleteLead = async (leadId: string, leadName: string) => {
    if (!lgpdEnabled) {
      setActionMessage(null);
      setActionError('Ações LGPD desabilitadas.');
      return;
    }
    if (!confirmTypedAction('DELETAR', `Excluir lead "${leadName}"?`)) return;
    setActionMessage(null);
    setActionError(null);
    try {
      await deleteLead(leadId);
      setActionMessage(`Concluído em ${formatActionTimestamp()}. Lead removido.`);
      await loadData();
    } catch (error: any) {
      setActionError(`${error.message || 'Falha ao remover lead.'} Verifique os logs.`);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Carregando integração...</div>;
  }

  if (!integration) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/integrations')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="text-gray-600">Integração não encontrada.</div>
      </div>
    );
  }

  const progress = getChecklistProgress(orderedChecklist);
  const canTestIntegration = isChecklistDone('webhook_healthcheck');

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Integração: ${integration.name}`}
        subtitle={`Slug: ${integration.slug}`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestIntegration}
              disabled={!canTestIntegration || !internalActionsEnabled}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Testar Integração
            </Button>
            <Button variant="ghost" onClick={() => navigate('/integrations')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="space-y-2">
            <div className="text-sm text-gray-500">Status</div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(integration.status)}>{getStatusLabel(integration.status)}</Badge>
              {integration.status === 'error' && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> atenção
                </span>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <div className="text-sm text-gray-500">Checklist</div>
            <div className="flex items-center gap-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-black h-2 rounded-full" style={{ width: `${progress.percent}%` }} />
              </div>
              <span className="text-xs font-medium">{progress.percent}%</span>
              <span className="text-xs text-gray-500">{progress.doneCount}/{progress.requiredCount}</span>
            </div>
          </div>
        </Card>
        <Card>
          <CopyInput
            label="Webhook"
            value={`/webhook/email/${integration.slug}`}
            disabled={false}
            helpText="Use este endpoint no CRM."
          />
        </Card>
      </div>

      <div className="flex border-b border-gray-200">
        {(['checklist', 'events', 'leads', 'logs'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2",
              activeTab === tab ? "border-black text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab === 'checklist' && 'Checklist'}
            {tab === 'events' && 'Eventos'}
            {tab === 'leads' && 'Leads'}
            {tab === 'logs' && 'Logs'}
          </button>
        ))}
      </div>

      {activeTab === 'checklist' && (
        <Card>
          <div className="space-y-4">
            {orderedChecklist.map((item) => {
              const dependsOn = resolveDependsOn(item);
              const missingDeps = dependsOn.filter((dep) => !isChecklistDone(dep));
              const isBlocked = missingDeps.length > 0;
              const blockedLabels = missingDeps.map((dep) => checklistLabelByKey.get(dep) || dep);
              const dependsOnLabels = dependsOn.map((dep) => checklistLabelByKey.get(dep) || dep);
              const canIdentifyWorkflow = isChecklistDone('subconta_criada') && isChecklistDone('pit_token_inserido');
              const typeLabel = MANUAL_ASSISTED_KEYS.has(item.key)
                ? 'Manual assistido'
                : item.type === 'auto'
                  ? 'Automático'
                  : 'Manual';

              return (
                <div
                  key={item.key}
                  className={cn(
                    "border border-gray-200 rounded-lg p-4",
                    isBlocked && "bg-gray-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900">{item.label}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{typeLabel}</span>
                        {item.required && <span className="text-gray-400">• obrigatório</span>}
                        {dependsOn && dependsOn.length > 0 && (
                          <span className="text-gray-400">• depende de {dependsOnLabels.join(', ')}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant={item.status === 'done' ? 'success' : item.status === 'error' ? 'error' : 'neutral'}>
                      {item.status}
                    </Badge>
                  </div>

                  {isBlocked && (
                    <div className="mt-2 text-xs text-gray-500">
                      Bloqueado: conclua {blockedLabels.join(', ')}.
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-500">
                    {item.validatedAt && <div>Validado em: {formatDate(item.validatedAt)}</div>}
                    {item.validatedBy && <div>Validado por: {item.validatedBy}</div>}
                    {item.notes && <div>Notas: {item.notes}</div>}
                  </div>

                  {item.key === 'subconta_criada' && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <Input
                          label="Location ID"
                          placeholder="ex: loc_12345"
                          value={locationIdInput}
                          onChange={(e) => setLocationIdInput(e.target.value)}
                        />
                        {integration.crm?.locationId && (
                          <div className="mt-1 text-xs text-gray-500">Atual: {integration.crm.locationId}</div>
                        )}
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          onClick={handleSaveLocationId}
                          disabled={!internalActionsEnabled || savingKey === 'subconta_criada'}
                        >
                          <RefreshCw className={cn("h-4 w-4 mr-2", savingKey === 'subconta_criada' && 'animate-spin')} />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  )}

                  {item.key === 'pit_token_inserido' && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <Input
                          label="PIT Token"
                          type="password"
                          placeholder={item.status === 'done' ? 'Token definido' : 'Insira o token'}
                          value={pitTokenInput}
                          onChange={(e) => setPitTokenInput(e.target.value)}
                        />
                        {item.status === 'done' && (
                          <div className="mt-1 text-xs text-gray-500">Token definido.</div>
                        )}
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          onClick={handleSavePitToken}
                          disabled={!internalActionsEnabled || savingKey === 'pit_token_inserido'}
                        >
                          <RefreshCw className={cn("h-4 w-4 mr-2", savingKey === 'pit_token_inserido' && 'animate-spin')} />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  )}

                  {item.key === 'workflow_duplicado' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Checkbox
                          label="Workflow duplicado"
                          checked={item.status === 'done'}
                          disabled={!internalActionsEnabled || item.status === 'done' || savingKey === item.key}
                          onChange={() => handleManualChecklist(item)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleIdentifyWorkflow}
                          disabled={!internalActionsEnabled || !canIdentifyWorkflow || savingKey === 'workflow_duplicado:identify'}
                        >
                          <RefreshCw className={cn("h-4 w-4 mr-2", savingKey === 'workflow_duplicado:identify' && 'animate-spin')} />
                          Buscar Workflow ID
                        </Button>
                      </div>
                      {!canIdentifyWorkflow && (
                        <div className="text-xs text-gray-500">Requer Location ID e PIT Token.</div>
                      )}
                      {savingKey === item.key && (
                        <div className="text-xs text-gray-400">Atualizando...</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {(() => {
                          const workflowIds = integration.crm?.workflowIds || {};
                          const entries = Object.entries(workflowIds);
                          if (entries.length > 0) {
                            return (
                              <div className="space-y-1">
                                {entries.map(([name, id]) => (
                                  <div key={name}>{name}: {id}</div>
                                ))}
                              </div>
                            );
                          }
                          return integration.crm?.workflowId
                            ? `Workflow ID: ${integration.crm.workflowId}`
                            : 'IDs não identificados';
                        })()}
                      </div>
                    </div>
                  )}

                  {item.key === 'custom_value_webhook_criado' && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">
                        {integration.crm?.customWebhookFieldId
                          ? `Custom Value ID: ${integration.crm.customWebhookFieldId}`
                          : 'Custom Value não definido.'}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateCustomValue}
                        disabled={!internalActionsEnabled || isBlocked || item.status === 'done' || savingKey === 'custom_value_webhook_criado'}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", savingKey === 'custom_value_webhook_criado' && 'animate-spin')} />
                        Criar Custom Value
                      </Button>
                    </div>
                  )}

                  {item.key === 'dns_configurado' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Checkbox
                          label="DNS configurado"
                          checked={item.status === 'done'}
                          disabled={!internalActionsEnabled || item.status === 'done' || savingKey === item.key}
                          onChange={() => handleManualChecklist(item)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDnsHelpOpen(true)}
                        >
                          Passo a passo
                        </Button>
                      </div>
                      {savingKey === item.key && (
                        <div className="mt-2 text-xs text-gray-400">Atualizando...</div>
                      )}
                    </div>
                  )}

                  {item.key === 'usuario_suporte_criado' && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">
                        {integration.crm?.supportUserEmail
                          ? `Email: ${integration.crm.supportUserEmail}`
                          : 'Usuário de suporte não criado.'}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateSupportUser}
                        disabled={!internalActionsEnabled || isBlocked || item.status === 'done' || savingKey === 'usuario_suporte_criado'}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", savingKey === 'usuario_suporte_criado' && 'animate-spin')} />
                        Criar Usuário Suporte
                      </Button>
                    </div>
                  )}

                  {item.key === 'webhook_healthcheck' && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">Verifica se o endpoint está acessível e a integração existe.</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRunHealthcheck}
                        disabled={!internalActionsEnabled || isBlocked || savingKey === 'webhook_healthcheck'}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", savingKey === 'webhook_healthcheck' && 'animate-spin')} />
                        Rodar Health Check
                      </Button>
                    </div>
                  )}

                  {item.key === 'webhook_testado' && (
                    <div className="mt-3 text-xs text-gray-500">
                      {canTestIntegration
                        ? 'Use o botão "Testar Integração" para validar este item.'
                        : 'Bloqueado: conclua Webhook healthcheck antes de testar a integração.'}
                    </div>
                  )}

                  {item.type === 'auto' && !['custom_value_webhook_criado', 'usuario_suporte_criado', 'webhook_healthcheck', 'webhook_testado'].includes(item.key) && (
                    <div className="mt-3 text-xs text-gray-500">
                      Atualizado automaticamente pelo sistema.
                    </div>
                  )}

                  {item.status === 'error' && (
                    <div className="mt-3 text-xs text-red-600 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Requer atenção
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'events' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-700">Eventos</div>
            <div className="flex gap-2">
              <Input
                placeholder="Filtrar por eventId"
                value={eventIdFilter}
                onChange={(e) => setEventIdFilter(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded-md text-sm px-2 py-1"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as 'all' | 'processed' | 'failed')}
              >
                <option value="all">Todos</option>
                <option value="processed">Processados</option>
                <option value="failed">Falhos</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">EventId</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recebido em</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                      Nenhum evento encontrado.
                    </td>
                  </tr>
                )}
                {filteredEvents.map((event) => {
                  const eventId = event.eventId || event.id || '';
                  return (
                    <tr key={eventId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs font-mono text-gray-600">
                          <span>{eventId}</span>
                          <button
                            type="button"
                            className="text-xs text-gray-500 hover:text-gray-800"
                            onClick={() => copyToClipboard(eventId, 'eventId')}
                            disabled={!eventId}
                          >
                            Copiar
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{resolveEventSource(event)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={event.status === 'processed' ? 'success' : event.status === 'failed' ? 'error' : 'neutral'}>
                          {event.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{event.error?.message || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {event.receivedAt ? formatDate(event.receivedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {event.status === 'failed' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprocessEvent(eventId)}
                            disabled={!internalActionsEnabled}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reprocessar
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'leads' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-700">Leads</div>
            <select
              className="border border-gray-300 rounded-md text-sm px-2 py-1"
              value={leadFilter}
              onChange={(e) => setLeadFilter(e.target.value as 'all' | 'pending' | 'sent' | 'failed')}
            >
              <option value="all">Todos</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          {!lgpdEnabled && (
            <div className="mb-3 text-xs text-gray-500">Ações LGPD desabilitadas.</div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Última tentativa</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                      Nenhum lead encontrado.
                    </td>
                  </tr>
                )}
                {filteredLeads.map((lead) => {
                  const leadId = lead.leadId || lead.id || '';
                  const leadName = lead.nome || lead.name || lead.email || 'Sem nome';
                  return (
                    <tr key={leadId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{leadName}</div>
                        <div className="text-xs text-gray-500">{lead.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={lead.status === 'sent' ? 'success' : lead.status === 'failed' ? 'error' : 'neutral'}>
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {typeof lead.lastError === 'string' ? lead.lastError : lead.lastError?.message || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {lead.lastAttemptAt ? formatDate(lead.lastAttemptAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end items-center gap-2">
                          {lead.status === 'failed' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReprocessLead(leadId)}
                              disabled={!internalActionsEnabled}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reprocessar
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnonymizeLead(leadId, leadName)}
                            disabled={!leadId || !lgpdEnabled}
                          >
                            Anonimizar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteLead(leadId, leadName)}
                            disabled={!leadId || !lgpdEnabled}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="text-sm font-medium text-gray-700">Logs</div>
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                placeholder="Filtrar por eventId"
                value={logFilterEventId}
                onChange={(e) => setLogFilterEventId(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded-md text-sm px-2 py-1"
                value={logFilterCategory}
                onChange={(e) => setLogFilterCategory(e.target.value)}
              >
                <option value="all">Todas categorias</option>
                {logCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {filteredLogs.length === 0 && (
              <div className="text-sm text-gray-500">Nenhum log encontrado.</div>
            )}
            {filteredLogs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="border border-gray-200 rounded-md p-3 text-xs text-gray-600">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono">{formatDate(log.timestamp)}</span>
                  <Badge variant={log.category === 'ERROR' ? 'error' : log.category === 'CHECKLIST' ? 'warning' : 'neutral'}>
                    {log.category}
                  </Badge>
                  {log.eventId && (
                    <span className="font-mono text-gray-400 flex items-center gap-2">
                      eventId: {log.eventId}
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-gray-800"
                        onClick={() => copyToClipboard(log.eventId, 'eventId')}
                      >
                        Copiar
                      </button>
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-700">{log.message}</div>
                {log.metadata && (
                  <div className="mt-1 text-xs text-gray-500">
                    {log.metadata?.message && <div>Detalhe: {String(log.metadata.message)}</div>}
                    {log.metadata?.statusCode && <div>Status: {String(log.metadata.statusCode)}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {dnsHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Configuração de DNS</h3>
              <button onClick={() => setDnsHelpOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  Acessar:{' '}
                  <a
                    href={dnsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline break-all"
                  >
                    {dnsUrl}
                  </a>
                </li>
                <li>Clicar em &quot;Dedicated Domain And IP&quot;.</li>
                <li>&quot;+ Add Domain&quot;.</li>
                <li>
                  Inserir (Aplicar opção de copiar dominio personalizado):
                  <div className="mt-2">
                    <CopyInput
                      label="Domínio personalizado"
                      value={dnsDomain}
                      helpText="Use este domínio na configuração."
                    />
                  </div>
                </li>
                <li>&quot;Add &amp; Verify&quot; &gt; &quot;Continue&quot;.</li>
                <li>Realizar todos os registros exibidos, após, confirmar no checkbox da integração (fora do pop-up).</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
