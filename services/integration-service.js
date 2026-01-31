const crypto = require('crypto');

const {
  IntegrationStatus,
  normalizeSlug,
  assertValidSlug,
  normalizeIntegration,
  createIntegration,
  applyIntegrationUpdate,
  applyChecklistItemUpdate,
  recalculateIntegrationStatus,
  toPublicIntegration
} = require('../models/integration');
const crmConfig = require('../crm.config');
const crmClient = require('../crm-client');
const limitsConfig = require('../config/limits.config');
const { createExecutionContext } = require('./execution-context');
const { createJsonRepositories } = require('../repositories/json-repository');

const LOG_CATEGORIES = Object.freeze({
  EVENT: 'EVENT',
  LEAD: 'LEAD',
  CRM: 'CRM',
  CHECKLIST: 'CHECKLIST',
  ERROR: 'ERROR',
  RETRY: 'RETRY'
});

const repositories = createJsonRepositories();
const integrationRepo = repositories.integrations;
const eventRepo = repositories.events;
const leadRepo = repositories.leads;
const logRepo = repositories.logs;

const MAX_EVENTS_IN_FLIGHT = limitsConfig.MAX_EVENTS_IN_FLIGHT;
const MAX_RETRIES_PER_EVENT = limitsConfig.MAX_RETRIES_PER_EVENT;

const logWithContext = (entry, context) =>
  logRepo.append({
    ...entry,
    metadata: {
      ...(entry.metadata || {}),
      context
    }
  });

const listIntegrations = async ({ maskSensitive = true } = {}) => {
  const list = await integrationRepo.readAll();
  const normalized = list.map((item) => normalizeIntegration(item));
  return maskSensitive ? normalized.map(toPublicIntegration) : normalized;
};

const listLogs = async () => {
  if (!logRepo.list) return [];
  return logRepo.list();
};

const getIntegrationBySlug = async (slug, { maskSensitive = false } = {}) => {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;

  const list = await integrationRepo.readAll();
  const found = list.find((item) => normalizeSlug(item.slug) === normalizedSlug);
  if (!found) return null;

  const normalized = normalizeIntegration(found);
  return maskSensitive ? toPublicIntegration(normalized) : normalized;
};

const getIntegrationById = async (id, { maskSensitive = false } = {}) => {
  if (!id) return null;
  const list = await integrationRepo.readAll();
  const found = list.find((item) => item.id === id);
  if (!found) return null;

  const normalized = normalizeIntegration(found);
  return maskSensitive ? toPublicIntegration(normalized) : normalized;
};

const createNewIntegration = async ({ name, slug }) => {
  const normalizedSlug = normalizeSlug(slug);
  assertValidSlug(normalizedSlug);

  const integration = createIntegration({ name, slug: normalizedSlug });

  await integrationRepo.transact((list) => {
    const exists = list.some((item) => normalizeSlug(item.slug) === normalizedSlug);
    if (exists) {
      throw new Error('Slug ja existe.');
    }
    return [...list, integration];
  });

  return integration;
};

const updateIntegration = async (id, updates = {}) => {
  let updated = null;

  await integrationRepo.transact((list) => {
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error('Integracao nao encontrada.');
    }

    const current = normalizeIntegration(list[index]);
    updated = applyIntegrationUpdate(current, updates);
    list[index] = updated;
    return list;
  });

  return updated;
};

const normalizeCrmValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.toString().trim();
  return trimmed ? trimmed : undefined;
};

const updateCrmFields = async (id, { locationId, pitToken } = {}, { maskSensitive = true } = {}) => {
  const nextLocationId = normalizeCrmValue(locationId);
  const nextPitToken = normalizeCrmValue(pitToken);

  if (!nextLocationId && !nextPitToken) {
    throw createServiceError('CRM_FIELDS_EMPTY', 'Payload vazio.', 400);
  }

  let updated = null;

  await integrationRepo.transact((list) => {
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw createServiceError('INTEGRATION_NOT_FOUND', 'Integracao nao encontrada.', 404);
    }

    const current = normalizeIntegration(list[index]);
    const crmUpdates = {
      ...(nextLocationId ? { locationId: nextLocationId } : {}),
      ...(nextPitToken ? { pitToken: nextPitToken } : {})
    };
    updated = applyIntegrationUpdate(current, { crm: crmUpdates });
    list[index] = updated;
    return list;
  });

  return maskSensitive ? toPublicIntegration(updated) : updated;
};

const markChecklistItemDoneManual = async (id, key, { notes = '' } = {}) => {
  let updated = null;

  await integrationRepo.transact((list) => {
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error('Integracao nao encontrada.');
    }

    const current = normalizeIntegration(list[index]);
    updated = applyChecklistItemUpdate(current, key, {
      status: 'done',
      notes,
      validatedBy: 'technician',
      manualOnly: true
    });
    list[index] = updated;
    return list;
  });

  logRepo.append({
    integrationId: updated?.id || id,
    category: LOG_CATEGORIES.CHECKLIST,
    message: 'Checklist manual atualizado',
    metadata: { key, status: updated?.status || 'updated' }
  });

  return updated;
};

const markChecklistItemError = async (id, key, { notes = '', validatedBy = 'system' } = {}) => {
  let updated = null;

  await integrationRepo.transact((list) => {
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error('Integracao nao encontrada.');
    }

    const current = normalizeIntegration(list[index]);
    updated = applyChecklistItemUpdate(current, key, {
      status: 'error',
      notes,
      validatedBy
    });
    list[index] = updated;
    return list;
  });

  return updated;
};

const registerWebhookSuccess = async (id, { eventId } = {}) => {
  let updated = null;

  await integrationRepo.transact((list) => {
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error('Integracao nao encontrada.');
    }

    const current = normalizeIntegration(list[index]);
    updated = applyIntegrationUpdate(current, {}, { webhookTested: true });
    list[index] = updated;
    return list;
  });

  logRepo.append({
    integrationId: updated?.id || id,
    eventId,
    category: LOG_CATEGORIES.CHECKLIST,
    message: 'Checklist webhook_testado atualizado',
    metadata: { status: updated?.status }
  });

  return updated;
};

const buildWebhookHealthPayload = (integration) => ({
  ok: true,
  slug: integration.slug,
  integrationId: integration.id,
  timestamp: new Date().toISOString()
});

const getWebhookHealth = async (slug) => {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    return { ok: false, status: 404, payload: { ok: false } };
  }

  const integration = await getIntegrationBySlug(normalizedSlug, { maskSensitive: false });
  if (!integration) {
    return { ok: false, status: 404, payload: { ok: false } };
  }

  return {
    ok: true,
    status: 200,
    payload: buildWebhookHealthPayload(integration)
  };
};

const runWebhookHealthcheck = async (id) => {
  let updated = null;
  let result = null;

  await integrationRepo.transact(async (list) => {
    const index = findIntegrationOrThrow(list, id);
    const current = normalizeIntegration(list[index]);

    let health = { ok: false };
    try {
      assertValidSlug(current.slug);
      health = await getWebhookHealth(current.slug);
    } catch (error) {
      health = { ok: false, status: 400, payload: { ok: false }, reason: error.message };
    }

    if (health.ok) {
      updated = markChecklistDoneSystem(current, 'webhook_healthcheck');
      logRepo.append({
        integrationId: current.id,
        category: LOG_CATEGORIES.CHECKLIST,
        message: 'Healthcheck do webhook concluido',
        metadata: { slug: current.slug }
      });
      list[index] = updated;
      result = health.payload;
      return list;
    }

    const reason = health.reason || 'Healthcheck do webhook falhou.';
    updated = markChecklistError(current, 'webhook_healthcheck', reason);
    logRepo.append({
      integrationId: current.id,
      category: LOG_CATEGORIES.ERROR,
      message: 'Healthcheck do webhook falhou',
      metadata: { slug: current.slug, reason }
    });
    list[index] = updated;
    result = { ok: false, slug: current.slug, integrationId: current.id, timestamp: new Date().toISOString(), reason };
    return list;
  });

  return result;
};

const recalculateStatus = async (id) => {
  let updated = null;

  await integrationRepo.transact((list) => {
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error('Integracao nao encontrada.');
    }

    const current = normalizeIntegration(list[index]);
    updated = {
      ...current,
      status: recalculateIntegrationStatus(current.checklist),
      updatedAt: new Date().toISOString()
    };
    list[index] = updated;
    return list;
  });

  return updated;
};

const anonymizeLeadData = (lead) => {
  if (!lead) return lead;

  const sensitiveKeys = [
    'nome',
    'name',
    'firstName',
    'lastName',
    'email',
    'telefone',
    'phone',
    'celular',
    'cpf',
    'document'
  ];

  const updates = {};
  for (const key of sensitiveKeys) {
    if (Object.prototype.hasOwnProperty.call(lead, key)) {
      updates[key] = null;
    }
  }

  return {
    ...updates,
    anonymizedAt: new Date().toISOString()
  };
};

const deleteLead = async (leadId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) {
    throw createServiceError('LEAD_NOT_FOUND', 'Lead nao encontrado.', 404);
  }

  await leadRepo.remove(leadId);
  logRepo.append({
    integrationId: lead.integrationId,
    leadId: lead.leadId || lead.id,
    category: LOG_CATEGORIES.LEAD,
    message: 'Lead removido (LGPD)',
    metadata: { leadId: lead.leadId || lead.id }
  });

  return { success: true, leadId: lead.leadId || lead.id };
};

const anonymizeLead = async (leadId) => {
  const lead = await leadRepo.findById(leadId);
  if (!lead) {
    throw createServiceError('LEAD_NOT_FOUND', 'Lead nao encontrado.', 404);
  }

  const updates = anonymizeLeadData(lead);
  await leadRepo.update(leadId, updates);

  logRepo.append({
    integrationId: lead.integrationId,
    leadId: lead.leadId || lead.id,
    category: LOG_CATEGORIES.LEAD,
    message: 'Lead anonimizado (LGPD)',
    metadata: { leadId: lead.leadId || lead.id }
  });

  return { success: true, leadId: lead.leadId || lead.id };
};

const deleteIntegration = async (id) => {
  let removed = null;

  await integrationRepo.transact((list) => {
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error('Integracao nao encontrada.');
    }
    removed = list[index];
    return list.filter((item) => item.id !== id);
  });

  return removed ? normalizeIntegration(removed) : null;
};

const createServiceError = (code, message, statusCode, details) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
};

const parseCrmError = (error) => {
  const statusCode = error?.statusCode;
  let payload;
  try {
    payload = JSON.parse(error?.message || '{}');
  } catch (err) {
    payload = null;
  }
  const message = payload?.message || error?.message || 'Erro desconhecido no CRM.';
  return { statusCode, payload, message };
};

const ensureCrmPrereqs = (integration) => {
  const missing = [];
  if (!integration.crm?.locationId) missing.push('locationId');
  if (!integration.crm?.pitToken) missing.push('pitToken');
  if (missing.length) {
    throw createServiceError(
      'CRM_PRECONDITION_FAILED',
      `Credenciais CRM ausentes: ${missing.join(', ')}`,
      400,
      { missing }
    );
  }
  return {
    locationId: integration.crm.locationId,
    pitToken: integration.crm.pitToken
  };
};

const extractWorkflowList = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.workflows)) return response.workflows;
  if (Array.isArray(response.items)) return response.items;
  return [];
};

const extractCustomValues = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.customValues)) return response.customValues;
  if (Array.isArray(response.values)) return response.values;
  return [];
};

const getWebhookUrl = (slug) => {
  const baseUrl = crmConfig.webhook?.baseUrl || '';
  const template = crmConfig.webhook?.pathTemplate || '/webhook/email/{slug}';
  const path = template.replace('{slug}', slug);
  return `${baseUrl.replace(/\/$/, '')}${path}`;
};

const findIntegrationOrThrow = (list, id) => {
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) {
    throw createServiceError('INTEGRATION_NOT_FOUND', 'Integracao nao encontrada.', 404);
  }
  return index;
};

const markChecklistError = (integration, key, message) =>
  applyChecklistItemUpdate(integration, key, {
    status: 'error',
    notes: message,
    validatedBy: 'system'
  });

const markChecklistDoneSystem = (integration, key) =>
  applyChecklistItemUpdate(integration, key, {
    status: 'done',
    validatedBy: 'system'
  });

const extractWebhookJsonPayload = (body) => {
  const bodyMail = body?.customData?.['body-mail'];
  if (typeof bodyMail !== 'string') {
    return null;
  }

  const jsonMatch = bodyMail.match(/```json\s*({[\s\S]+?})\s*```/);
  if (!jsonMatch || !jsonMatch[1]) {
    return null;
  }

  try {
    return JSON.parse(jsonMatch[1]);
  } catch (error) {
    return null;
  }
};

const buildEventError = (code, message, step) => ({
  code,
  message,
  step
});

const buildWebhookEvent = ({ integration, slug, headers, body, eventId }) => ({
  id: eventId,
  eventId,
  integrationId: integration.id,
  integrationSlug: slug,
  receivedAt: new Date().toISOString(),
  status: 'received',
  processedAt: null,
  error: null,
  attempts: 1,
  headers,
  body
});

const buildLeadFromPayload = ({ integration, eventId, payload, receivedAt }) => {
  const leadId = crypto.randomUUID();
  return {
    id: leadId,
    leadId,
    eventId,
    integrationId: integration.id,
    integrationName: integration.name,
    receivedAt,
    status: 'pending',
    lastError: null,
    lastAttemptAt: null,
    attempts: 0,
    ...payload
  };
};

const updateLeadRecord = async (leadId, updates) => {
  await leadRepo.update(leadId, updates);
};

const updateWebhookEventRecord = async (eventId, updates) => {
  await eventRepo.update(eventId, updates);
};

const canReprocessEvent = (event) => {
  if (!event) return false;
  const status = (event.status || '').toString().toLowerCase();
  return status === 'failed';
};

const canReprocessLead = (lead) => {
  if (!lead) return false;
  const status = (lead.status || '').toString().toLowerCase();
  return status === 'failed';
};

const processLeadCrm = async ({ integration, leadData, eventId, context }) => {
  if (!integration.crm?.pitToken || !integration.crm?.locationId) {
    throw createServiceError(
      'CRM_CREDENTIALS_MISSING',
      'Credenciais (PIT_TOKEN, LOCATION_ID) nao configuradas para esta integracao.',
      400
    );
  }

  const credentials = integration.crm;
  let contactId;

  if (context) {
    await logWithContext({
      integrationId: integration.id,
      eventId,
      leadId: leadData.leadId || leadData.id,
      category: LOG_CATEGORIES.CRM,
      message: 'Iniciando criacao de contato no CRM',
      metadata: { email: leadData.email }
    }, context);
  } else {
    logRepo.append({
      integrationId: integration.id,
      eventId,
      leadId: leadData.leadId || leadData.id,
      category: LOG_CATEGORIES.CRM,
      message: 'Iniciando criacao de contato no CRM',
      metadata: { email: leadData.email }
    });
  }

  try {
    const nameParts = (leadData.nome || '').split(' ');
    const contactDetails = {
      firstName: nameParts.shift() || '',
      lastName: nameParts.join(' ') || '',
      email: leadData.email,
      phone: leadData.telefone,
      source: leadData.fonte_do_lead
    };

    const contactResponse = await crmClient.createContact(contactDetails, credentials);
    contactId = contactResponse?.contact?.id;
  } catch (contactError) {
    let errorData;
    try {
      errorData = JSON.parse(contactError.message);
    } catch (e) {
      throw contactError;
    }

    if (
      contactError.statusCode === 400 &&
      errorData.message === 'This location does not allow duplicated contacts.' &&
      errorData.meta?.contactId
    ) {
      contactId = errorData.meta.contactId;
    } else {
      throw contactError;
    }
  }

  if (!contactId) {
    throw new Error('Nao foi possivel obter o ID do contato.');
  }

  if (context) {
    await logWithContext({
      integrationId: integration.id,
      eventId,
      leadId: leadData.leadId || leadData.id,
      category: LOG_CATEGORIES.CRM,
      message: 'Contato obtido, criando oportunidade',
      metadata: { contactId }
    }, context);
  } else {
    logRepo.append({
      integrationId: integration.id,
      eventId,
      leadId: leadData.leadId || leadData.id,
      category: LOG_CATEGORIES.CRM,
      message: 'Contato obtido, criando oportunidade',
      metadata: { contactId }
    });
  }

  const priceString = leadData.preco || '0';
  const monetaryValue = parseFloat(
    priceString
      .replace(/[^0-9,.-]+/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  ) || 0;
  const opportunityName = `${leadData.nome || 'Novo Lead'} - ${leadData.placa || leadData.veiculo_interesse || ''}`.trim();

  const customFields = [];
  if (leadData.veiculo_interesse) {
    customFields.push({ id: 'MFmWzuig3M2CoRPOgr7T', field_value: leadData.veiculo_interesse });
  }
  if (leadData.placa) {
    customFields.push({ id: 'KmT56Is6DrePLfwU8CYp', field_value: leadData.placa });
  }
  if (leadData.mensagem) {
    customFields.push({ id: 'xbmeg8BTFELaXyCJsMrK', field_value: leadData.mensagem });
  }

  const opportunityData = {
    pipelineId: 'zZrlKDUQrTCcfZDQwM7C',
    pipelineStageId: 'cf2a63ab-3579-438c-ab49-752a7ae18d96',
    contactId: contactId,
    name: opportunityName,
    status: 'open',
    source: leadData.fonte_do_lead,
    monetaryValue: monetaryValue,
    customFields: customFields.length > 0 ? customFields : undefined
  };

  const opportunityResponse = await crmClient.upsertOpportunity(opportunityData, credentials);
  return {
    contactId,
    opportunityId: opportunityResponse?.id,
    processedAt: new Date().toISOString()
  };
};

const warnIfLimitsExceeded = async (context) => {
  const events = await eventRepo.list();
  const inFlight = events.filter((evt) => (evt.status || '').toLowerCase() === 'received').length;
  if (inFlight > MAX_EVENTS_IN_FLIGHT) {
    await logWithContext({
      integrationId: context.integrationId,
      eventId: context.eventId,
      category: LOG_CATEGORIES.EVENT,
      message: 'Limite de eventos em voo excedido',
      metadata: { inFlight, limit: MAX_EVENTS_IN_FLIGHT }
    }, context);
  }

  if (context.attempt > MAX_RETRIES_PER_EVENT) {
    await logWithContext({
      integrationId: context.integrationId,
      eventId: context.eventId,
      category: LOG_CATEGORIES.RETRY,
      message: 'Limite de retries por evento excedido',
      metadata: { attempt: context.attempt, limit: MAX_RETRIES_PER_EVENT }
    }, context);
  }
};

const processEventPipeline = async ({
  integration,
  payload,
  eventId,
  context,
  dryRun = false,
  existingEvent,
  existingLead
}) => {
  const headers = payload?.headers || {};
  const body = payload?.body || {};
  const slug = integration.slug;
  const attempt = context.attempt || 1;

  const event = existingEvent || buildWebhookEvent({
    integration,
    slug,
    headers,
    body,
    eventId
  });

  if (!existingEvent) {
    await eventRepo.append(event);
  } else {
    await updateWebhookEventRecord(eventId, {
      status: 'received',
      error: null,
      processedAt: null,
      attempts: attempt
    });
  }

  await logWithContext({
    integrationId: integration.id,
    eventId,
    category: LOG_CATEGORIES.EVENT,
    message: 'Webhook recebido',
    metadata: { slug, attempt }
  }, context);

  const parsedPayload = extractWebhookJsonPayload(body);
  if (!parsedPayload) {
    const error = buildEventError('PAYLOAD_INVALID', 'Payload JSON invalido.', 'parse');
    await updateWebhookEventRecord(eventId, {
      status: 'failed',
      processedAt: new Date().toISOString(),
      error
    });
    await logWithContext({
      integrationId: integration.id,
      eventId,
      category: LOG_CATEGORIES.ERROR,
      message: 'Nenhum payload JSON valido encontrado no webhook',
      metadata: { step: 'parse' }
    }, context);

    return {
      success: true,
      step: 'payload_invalid',
      error,
      eventId,
      leadId: null,
      skippedCrm: dryRun,
      message: 'Nenhum dado processavel.'
    };
  }

  let leadData = existingLead;
  if (!leadData) {
    leadData = buildLeadFromPayload({
      integration,
      eventId,
      payload: parsedPayload,
      receivedAt: event.receivedAt
    });

    await leadRepo.append(leadData);
    const leadKey = leadData.leadId || leadData.id;
    await logWithContext({
      integrationId: integration.id,
      eventId,
      leadId: leadKey,
      category: LOG_CATEGORIES.LEAD,
      message: 'Lead salvo',
      metadata: { leadId: leadKey }
    }, context);
  }

  const leadKey = leadData.leadId || leadData.id;

  if (dryRun) {
    await updateWebhookEventRecord(eventId, {
      status: 'processed',
      processedAt: new Date().toISOString(),
      error: null
    });
    return {
      success: true,
      step: 'dry_run_completed',
      eventId,
      leadId: leadKey,
      skippedCrm: true,
      message: 'Dry run concluido.'
    };
  }

  try {
    const nextAttempts = (leadData.attempts || 0) + 1;
    await updateLeadRecord(leadKey, {
      lastAttemptAt: new Date().toISOString(),
      attempts: nextAttempts
    });
    const crmResult = await processLeadCrm({ integration, leadData, eventId, context });
    await updateLeadRecord(leadKey, {
      status: 'sent',
      lastError: null,
      lastAttemptAt: crmResult.processedAt,
      crm: crmResult
    });
    await updateWebhookEventRecord(eventId, {
      status: 'processed',
      processedAt: crmResult.processedAt,
      error: null
    });
    await logWithContext({
      integrationId: integration.id,
      eventId,
      leadId: leadKey,
      category: LOG_CATEGORIES.CRM,
      message: 'Lead sincronizado no CRM',
      metadata: { contactId: crmResult.contactId, opportunityId: crmResult.opportunityId }
    }, context);
    return {
      success: true,
      step: 'crm_processed',
      eventId,
      leadId: leadKey,
      skippedCrm: false
    };
  } catch (crmError) {
    const processedAt = new Date().toISOString();
    const error = buildEventError('CRM_ERROR', crmError.message, 'crm');
    await updateLeadRecord(leadKey, {
      status: 'failed',
      lastError: {
        code: 'CRM_ERROR',
        message: crmError.message
      },
      lastAttemptAt: processedAt,
      crm: {
        error: crmError.message,
        processedAt
      }
    });
    await updateWebhookEventRecord(eventId, {
      status: 'failed',
      processedAt,
      error
    });
    await logWithContext({
      integrationId: integration.id,
      eventId,
      leadId: leadKey,
      category: LOG_CATEGORIES.ERROR,
      message: 'Falha ao processar CRM',
      metadata: { error: crmError.message }
    }, context);

    return {
      success: false,
      step: 'crm_failed',
      error,
      eventId,
      leadId: leadKey,
      skippedCrm: false
    };
  }
};

const processWebhook = async ({
  slug,
  headers = {},
  body = {},
  dryRun = false,
  eventId,
  allowedStatuses,
  existingEvent,
  existingLead,
  source = 'webhook'
}) => {
  const integration = await getIntegrationBySlug(slug, { maskSensitive: false });
  if (!integration) {
    throw createServiceError('INTEGRATION_NOT_FOUND', 'Integracao nao encontrada.', 404);
  }

  const allowed = Array.isArray(allowedStatuses) && allowedStatuses.length > 0
    ? allowedStatuses
    : [IntegrationStatus.ACTIVE];

  if (!allowed.includes(integration.status)) {
    throw createServiceError('INTEGRATION_STATUS_INVALID', 'Integracao nao esta ativa.', 400);
  }

  const resolvedEventId = eventId || existingEvent?.eventId || existingEvent?.id || crypto.randomUUID();
  const attempt = existingEvent ? (existingEvent.attempts || 1) + 1 : 1;
  const context = createExecutionContext({
    eventId: resolvedEventId,
    integrationId: integration.id,
    source,
    attempt
  });

  await warnIfLimitsExceeded(context);

  const result = await processEventPipeline({
    integration,
    payload: { headers, body },
    eventId: resolvedEventId,
    context,
    dryRun,
    existingEvent,
    existingLead
  });

  if (result?.success && result?.step !== 'payload_invalid') {
    await registerWebhookSuccess(integration.id, { eventId: resolvedEventId });
  }

  return result;
};

const buildMockWebhookPayload = (integration) => ({
  customData: {
    'body-mail': [
      '```json',
      '{',
      `  "nome": "Teste ${integration.slug}",`,
      '  "telefone": "(11) 90000-0000",',
      '  "email": "teste@exemplo.com",',
      '  "fonte_do_lead": "Teste Automacao",',
      '  "veiculo_interesse": "Carro Teste",',
      '  "preco": "100000"',
      '}',
      '```'
    ].join('\n')
  }
});

const testIntegration = async (id) => {
  const summary = {
    success: false,
    steps: [],
    errors: []
  };

  const integration = await getIntegrationById(id, { maskSensitive: false });
  if (!integration) {
    summary.errors.push('Integracao nao encontrada.');
    return summary;
  }

  if (integration.status !== IntegrationStatus.ONBOARDING) {
    summary.errors.push('Integracao precisa estar em onboarding.');
    return summary;
  }

  const eventId = crypto.randomUUID();
  const body = buildMockWebhookPayload(integration);

  let result;
  try {
    result = await processWebhook({
      slug: integration.slug,
      headers: { 'x-test': 'true' },
      body,
      dryRun: true,
      eventId,
      allowedStatuses: [IntegrationStatus.ONBOARDING],
      source: 'test'
    });
  } catch (error) {
    summary.errors.push(error.message || 'Falha ao executar teste.');
    return summary;
  }

  const events = await eventRepo.list();
  const leads = await leadRepo.list();
  const hasEvent = events.some((evt) => evt.eventId === eventId);
  const hasLead = leads.some((lead) => lead.eventId === eventId);
  const updatedIntegration = await getIntegrationById(id, { maskSensitive: false });
  const checklistItem = updatedIntegration?.checklist?.find((item) => item.key === 'webhook_testado');
  const checklistDone = checklistItem?.status === 'done';

  summary.steps.push({ step: 'evento_salvo', ok: hasEvent });
  summary.steps.push({ step: 'lead_salvo', ok: hasLead });
  summary.steps.push({ step: 'checklist_webhook_testado', ok: checklistDone });

  if (!hasEvent) summary.errors.push('Evento nao salvo.');
  if (!hasLead) summary.errors.push('Lead nao salvo.');
  if (!checklistDone) summary.errors.push('Checklist webhook_testado nao concluido.');

  summary.success = summary.errors.length === 0 && Boolean(result?.success);
  return summary;
};

const reprocessEvent = async (eventId) => {
  const events = await eventRepo.list();
  const event = events.find((evt) => evt.eventId === eventId || evt.id === eventId);

  if (!event) {
    throw createServiceError('EVENT_NOT_FOUND', 'Evento nao encontrado.', 404);
  }

  if (!canReprocessEvent(event)) {
    throw createServiceError('EVENT_NOT_REPROCESSABLE', 'Evento nao esta em failed.', 409);
  }

  const resolvedEventId = event.eventId || event.id;
  const attempt = (event.attempts || 1) + 1;
  const context = createExecutionContext({
    eventId: resolvedEventId,
    integrationId: event.integrationId,
    source: 'retry',
    attempt
  });
  await logWithContext({
    integrationId: event.integrationId,
    eventId: resolvedEventId,
    category: LOG_CATEGORIES.RETRY,
    message: 'Reprocessando evento',
    metadata: { eventId: resolvedEventId, attempt }
  }, context);

  const leads = await leadRepo.list();
  const existingLead = leads.find((lead) => lead.eventId === (event.eventId || event.id));
  if (existingLead && !canReprocessLead(existingLead)) {
    throw createServiceError('LEAD_NOT_REPROCESSABLE', 'Lead ja enviado.', 409);
  }

  let slug = event.integrationSlug;
  if (!slug && event.integrationId) {
    const integration = await getIntegrationById(event.integrationId, { maskSensitive: false });
    slug = integration?.slug;
  }
  if (!slug) {
    throw createServiceError('INTEGRATION_NOT_FOUND', 'Integracao nao encontrada.', 404);
  }

  const result = await processWebhook({
    slug,
    headers: event.headers || {},
    body: event.body || {},
    dryRun: false,
    eventId: resolvedEventId,
    allowedStatuses: [IntegrationStatus.ACTIVE, IntegrationStatus.ONBOARDING],
    existingEvent: event,
    existingLead,
    source: 'retry'
  });

  const updatedEvents = await eventRepo.list();
  const updatedLeads = await leadRepo.list();
  const updatedEvent = updatedEvents.find((evt) => evt.eventId === eventId || evt.id === eventId) || null;
  const updatedLead = updatedLeads.find((lead) => lead.eventId === (event.eventId || event.id)) || null;

  return {
    success: Boolean(result?.success),
    event: updatedEvent,
    lead: updatedLead,
    attempt
  };
};

const reprocessLead = async (leadId) => {
  const leads = await leadRepo.list();
  const lead = leads.find((item) => item.leadId === leadId || item.id === leadId);
  if (!lead) {
    throw createServiceError('LEAD_NOT_FOUND', 'Lead nao encontrado.', 404);
  }

  if (!canReprocessLead(lead)) {
    throw createServiceError('LEAD_NOT_REPROCESSABLE', 'Lead nao esta em failed.', 409);
  }

  const integration = await getIntegrationById(lead.integrationId, { maskSensitive: false });
  if (!integration) {
    throw createServiceError('INTEGRATION_NOT_FOUND', 'Integracao nao encontrada.', 404);
  }

  const eventId = lead.eventId || null;
  const attempt = (lead.attempts || 0) + 1;
  const context = createExecutionContext({
    eventId,
    integrationId: integration.id,
    source: 'retry',
    attempt
  });

  await logWithContext({
    integrationId: integration.id,
    eventId,
    leadId: lead.leadId || lead.id,
    category: LOG_CATEGORIES.RETRY,
    message: 'Reprocessando lead',
    metadata: { leadId: lead.leadId || lead.id, eventId, attempt }
  }, context);

  if (attempt > MAX_RETRIES_PER_EVENT) {
    await logWithContext({
      integrationId: integration.id,
      eventId,
      leadId: lead.leadId || lead.id,
      category: LOG_CATEGORIES.RETRY,
      message: 'Limite de retries por lead excedido',
      metadata: { attempt, limit: MAX_RETRIES_PER_EVENT }
    }, context);
  }

  try {
    await updateLeadRecord(lead.leadId || lead.id, {
      lastAttemptAt: new Date().toISOString(),
      attempts: attempt
    });

    const crmResult = await processLeadCrm({
      integration,
      leadData: lead,
      eventId,
      context
    });

    await updateLeadRecord(lead.leadId || lead.id, {
      status: 'sent',
      lastError: null,
      lastAttemptAt: crmResult.processedAt,
      crm: crmResult
    });

    if (eventId) {
      await updateWebhookEventRecord(eventId, {
        status: 'processed',
        processedAt: crmResult.processedAt,
        error: null
      });
    }

    const updatedLeads = await leadRepo.list();
    const updatedLead = updatedLeads.find((item) => item.leadId === leadId || item.id === leadId) || null;
    return {
      success: true,
      lead: updatedLead,
      attempt
    };
  } catch (error) {
    const processedAt = new Date().toISOString();
    await updateLeadRecord(lead.leadId || lead.id, {
      status: 'failed',
      lastError: {
        code: 'CRM_ERROR',
        message: error.message
      },
      lastAttemptAt: processedAt
    });

    if (eventId) {
      await updateWebhookEventRecord(eventId, {
        status: 'failed',
        processedAt,
        error: buildEventError('CRM_ERROR', error.message, 'crm')
      });
    }

    logRepo.append({
      integrationId: integration.id,
      eventId,
      leadId: lead.leadId || lead.id,
      category: LOG_CATEGORIES.ERROR,
      message: 'Falha ao reprocessar lead',
      metadata: { error: error.message }
    });

    return {
      success: false,
      error: error.message,
      attempt
    };
  }
};

const identifyWorkflow = async (id) => {
  let result = { found: false };

  await integrationRepo.transact(async (list) => {
    const index = findIntegrationOrThrow(list, id);
    const current = normalizeIntegration(list[index]);
    const { locationId, pitToken } = ensureCrmPrereqs(current);

    try {
      logRepo.append({
        integrationId: current.id,
        category: LOG_CATEGORIES.CRM,
        message: 'Buscando workflow por nome',
        metadata: { locationId }
      });

      const response = await crmClient.listWorkflows(locationId, pitToken);
      const workflows = extractWorkflowList(response);
      const expectedNames = Array.isArray(crmConfig.workflow?.expectedNames)
        ? crmConfig.workflow.expectedNames
        : crmConfig.workflow?.expectedName
          ? [crmConfig.workflow.expectedName]
          : [];
      if (expectedNames.length === 0) {
        throw createServiceError('CRM_CONFIG_INVALID', 'workflow.expectedNames nao configurado.', 500);
      }
      const foundMap = {};
      const missingNames = [];

      for (const name of expectedNames) {
        const match = workflows.find((wf) => wf?.name === name);
        if (!match) {
          missingNames.push(name);
          continue;
        }
        if (!match.id) {
          throw createServiceError('CRM_WORKFLOW_INVALID_RESPONSE', 'Workflow encontrado sem id.', 502);
        }
        foundMap[name] = match.id;
      }

      const foundNames = Object.keys(foundMap);
      if (foundNames.length === 0) {
        logRepo.append({
          integrationId: current.id,
          category: LOG_CATEGORIES.CHECKLIST,
          message: 'Workflow nao encontrado',
          metadata: { expectedNames }
        });
        result = { found: false, workflowIds: {} };
        return list;
      }

      const nextWorkflowIds = {
        ...(current.crm?.workflowIds || {}),
        ...foundMap
      };
      const primaryName = expectedNames.find((name) => foundMap[name]);
      const primaryId = primaryName ? foundMap[primaryName] : '';

      const updated = applyIntegrationUpdate(current, {
        crm: {
          workflowIds: nextWorkflowIds,
          ...(primaryId ? { workflowId: primaryId } : {})
        }
      });

      logRepo.append({
        integrationId: current.id,
        category: LOG_CATEGORIES.CRM,
        message: missingNames.length > 0 ? 'Workflows parcialmente identificados' : 'Workflows identificados',
        metadata: { workflowIds: foundMap, missingNames }
      });
      list[index] = updated;
      result = {
        found: true,
        workflowId: primaryId || undefined,
        workflowIds: foundMap,
        missingNames
      };
      return list;
    } catch (error) {
      const { statusCode, message } = parseCrmError(error);
      if ([401, 403, 422].includes(statusCode)) {
        logRepo.append({
          integrationId: current.id,
          category: LOG_CATEGORIES.ERROR,
          message: 'Erro ao identificar workflow',
          metadata: { statusCode, message }
        });
        result = { found: false };
        return list;
      }
      throw createServiceError('CRM_WORKFLOW_ERROR', message, statusCode || 502);
    }
  });

  return result;
};

const ensureCustomWebhookValue = async (id) => {
  let updated = null;

  await integrationRepo.transact(async (list) => {
    const index = findIntegrationOrThrow(list, id);
    const current = normalizeIntegration(list[index]);
    const { locationId, pitToken } = ensureCrmPrereqs(current);

    try {
      logRepo.append({
        integrationId: current.id,
        category: LOG_CATEGORIES.CRM,
        message: 'Buscando custom value do webhook',
        metadata: { locationId }
      });

      const response = await crmClient.listCustomValues(locationId, pitToken);
      const values = extractCustomValues(response);
      const expectedName = crmConfig.customValue?.name;
      if (!expectedName) {
        throw createServiceError('CRM_CONFIG_INVALID', 'customValue.name nao configurado.', 500);
      }
      const existing = values.find((item) => item?.name === expectedName);

      if (existing) {
        updated = applyIntegrationUpdate(current, {
          crm: { customWebhookFieldId: existing.id }
        });
        logRepo.append({
          integrationId: current.id,
          category: LOG_CATEGORIES.CHECKLIST,
          message: 'Custom value reutilizado',
          metadata: { customWebhookFieldId: existing.id }
        });
        list[index] = updated;
        return list;
      }

      const payload = {
        name: expectedName,
        value: getWebhookUrl(current.slug)
      };

      const created = await crmClient.createCustomValue(locationId, payload, pitToken);
      const createdId = created?.id || created?.customValue?.id;
      if (!createdId) {
        throw createServiceError('CRM_CUSTOM_VALUE_INVALID_RESPONSE', 'Custom Value criado sem id.', 502);
      }

      updated = applyIntegrationUpdate(current, {
        crm: { customWebhookFieldId: createdId }
      });
      logRepo.append({
        integrationId: current.id,
        category: LOG_CATEGORIES.CHECKLIST,
        message: 'Custom value criado',
        metadata: { customWebhookFieldId: createdId }
      });
      list[index] = updated;
      return list;
    } catch (error) {
      const { statusCode, message } = parseCrmError(error);
      if ([401, 403, 400, 422].includes(statusCode)) {
        updated = markChecklistError(current, 'custom_value_webhook_criado', message);
        logRepo.append({
          integrationId: current.id,
          category: LOG_CATEGORIES.ERROR,
          message: 'Erro ao criar custom value',
          metadata: { statusCode, message }
        });
        list[index] = updated;
        return list;
      }
      throw createServiceError('CRM_CUSTOM_VALUE_ERROR', message, statusCode || 502);
    }
  });

  return updated;
};

const ensureSupportUser = async (id) => {
  let updated = null;

  await integrationRepo.transact(async (list) => {
    const index = findIntegrationOrThrow(list, id);
    const current = normalizeIntegration(list[index]);
    const { locationId, pitToken } = ensureCrmPrereqs(current);

    const emailPattern = crmConfig.supportUser?.emailPattern || '';
    if (!emailPattern) {
      throw createServiceError('CRM_CONFIG_INVALID', 'supportUser.emailPattern nao configurado.', 500);
    }
    const email = emailPattern.replace('{slug}', current.slug);

    const scopes = Array.isArray(crmConfig.supportUser?.scopes) ? crmConfig.supportUser.scopes : [];
    if (scopes.length === 0) {
      throw createServiceError('CRM_CONFIG_INVALID', 'supportUser.scopes nao configurado.', 500);
    }

    const companyId = crmConfig.supportUser?.companyId || locationId;
    const payload = {
      firstName: crmConfig.supportUser?.firstName,
      lastName: crmConfig.supportUser?.lastName,
      email,
      role: crmConfig.supportUser?.role,
      type: crmConfig.supportUser?.type,
      platformLanguage: crmConfig.supportUser?.platformLanguage,
      companyId,
      locationIds: [locationId],
      scopes
    };

    const isDuplicateUserError = (err) => {
      const { message, statusCode } = parseCrmError(err);
      if (statusCode === 409) return true;
      const lowered = String(message || '').toLowerCase();
      return lowered.includes('already exists') || lowered.includes('duplicate') || lowered.includes('exists');
    };

    try {
      logRepo.append({
        integrationId: current.id,
        category: LOG_CATEGORIES.CRM,
        message: 'Criando usuario de suporte',
        metadata: { email, companyId, locationId }
      });

      const response = await crmClient.createSupportUser(payload, pitToken);
      const userEmail = response?.user?.email || response?.email || email;

      updated = applyIntegrationUpdate(current, {
        crm: { supportUserEmail: userEmail }
      });
      updated = markChecklistDoneSystem(updated, 'usuario_suporte_criado');
      logRepo.append({
        integrationId: current.id,
        category: LOG_CATEGORIES.CHECKLIST,
        message: 'Usuario de suporte criado',
        metadata: { supportUserEmail: userEmail }
      });
      list[index] = updated;
      return list;
    } catch (error) {
      if (isDuplicateUserError(error)) {
        updated = applyIntegrationUpdate(current, {
          crm: { supportUserEmail: email }
        });
        updated = markChecklistDoneSystem(updated, 'usuario_suporte_criado');
        logRepo.append({
          integrationId: current.id,
          category: LOG_CATEGORIES.CHECKLIST,
          message: 'Usuario de suporte ja existente',
          metadata: { supportUserEmail: email }
        });
        list[index] = updated;
        return list;
      }

      const { statusCode, message } = parseCrmError(error);
      if ([401, 403, 400, 422].includes(statusCode)) {
        updated = markChecklistError(current, 'usuario_suporte_criado', message);
        logRepo.append({
          integrationId: current.id,
          category: LOG_CATEGORIES.ERROR,
          message: 'Erro ao criar usuario de suporte',
          metadata: { statusCode, message, companyId, locationId }
        });
        list[index] = updated;
        return list;
      }

      throw createServiceError('CRM_SUPPORT_USER_ERROR', message, statusCode || 502);
    }
  });

  return updated;
};

module.exports = {
  listIntegrations,
  listLogs,
  getIntegrationBySlug,
  getIntegrationById,
  createIntegration: createNewIntegration,
  updateIntegration,
  updateCrmFields,
  markChecklistItemDoneManual,
  markChecklistItemError,
  registerWebhookSuccess,
  getWebhookHealth,
  runWebhookHealthcheck,
  recalculateStatus,
  processWebhook,
  processEventPipeline,
  testIntegration,
  canReprocessEvent,
  canReprocessLead,
  reprocessEvent,
  reprocessLead,
  identifyWorkflow,
  ensureCustomWebhookValue,
  ensureSupportUser,
  deleteIntegration,
  deleteLead,
  anonymizeLead
};
