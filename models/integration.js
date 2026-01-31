const crypto = require('crypto');
const CHECKLIST_CONFIG = require('../config/checklist.config');

const IntegrationStatus = Object.freeze({
  DRAFT: 'draft',
  ONBOARDING: 'onboarding',
  ACTIVE: 'active',
  ERROR: 'error'
});

const ChecklistStatus = Object.freeze({
  PENDING: 'pending',
  DONE: 'done',
  ERROR: 'error'
});

const ChecklistValidatedBy = Object.freeze({
  SYSTEM: 'system',
  TECHNICIAN: 'technician'
});

const CRM_FIELDS = [
  'locationId',
  'pitToken',
  'workflowId',
  'workflowIds',
  'customWebhookFieldId',
  'supportUserEmail'
];

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CHECKLIST_BY_KEY = new Map(
  CHECKLIST_CONFIG.map((item) => [item.key, item])
);

const LEGACY_CHECKLIST_ID_MAP = Object.freeze({
  '2': 'pit_token_inserido',
  '3': 'subconta_criada',
  '4': 'dns_configurado',
  '6': 'workflow_duplicado',
  '7': 'webhook_testado'
});

const LEGACY_LABEL_MAP = Object.freeze({
  'sub-conta criada': 'subconta_criada',
  'subconta criada': 'subconta_criada',
  'credenciais configuradas': 'pit_token_inserido',
  'workflow configurado': 'workflow_duplicado',
  'automacao ativada': 'workflow_duplicado',
  'automação ativada': 'workflow_duplicado',
  'dns configurado': 'dns_configurado',
  'webhook recebendo dados': 'webhook_testado'
});

const normalizeSlug = (slug) => (slug || '').toString().trim().toLowerCase();

const normalizeStatus = (status) => {
  const normalized = (status || '').toString().trim().toLowerCase();
  if (Object.values(IntegrationStatus).includes(normalized)) {
    return normalized;
  }

  const legacyMap = {
    active: IntegrationStatus.ACTIVE,
    inactive: IntegrationStatus.DRAFT,
    paused: IntegrationStatus.ONBOARDING,
    error: IntegrationStatus.ERROR,
    draft: IntegrationStatus.DRAFT,
    onboarding: IntegrationStatus.ONBOARDING
  };

  return legacyMap[normalized] || IntegrationStatus.DRAFT;
};

const normalizeChecklistStatus = (status) => {
  const normalized = (status || '').toString().trim().toLowerCase();
  if (Object.values(ChecklistStatus).includes(normalized)) {
    return normalized;
  }

  const legacyMap = {
    done: ChecklistStatus.DONE,
    pending: ChecklistStatus.PENDING,
    error: ChecklistStatus.ERROR,
    failed: ChecklistStatus.ERROR,
    success: ChecklistStatus.DONE
  };

  return legacyMap[normalized] || ChecklistStatus.PENDING;
};

const assertValidSlug = (slug) => {
  if (!slug || !SLUG_REGEX.test(slug)) {
    throw new Error('Slug invalido. Use letras minusculas, numeros e hifen.');
  }
};

const pickCrmFields = (source) => {
  const data = {};
  if (!source || typeof source !== 'object') {
    return data;
  }

  for (const field of CRM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      data[field] = source[field];
    }
  }

  return data;
};

const normalizeCrm = (raw) => {
  const source = raw?.crm || raw?.credentials || {};
  const workflowIds =
    source.workflowIds && typeof source.workflowIds === 'object' && !Array.isArray(source.workflowIds)
      ? { ...source.workflowIds }
      : {};
  return {
    locationId: source.locationId || '',
    pitToken: source.pitToken || '',
    workflowId: source.workflowId || '',
    workflowIds,
    customWebhookFieldId: source.customWebhookFieldId || '',
    supportUserEmail: source.supportUserEmail || ''
  };
};

const createChecklistState = () =>
  CHECKLIST_CONFIG.map((item) => ({
    key: item.key,
    label: item.label,
    type: item.type,
    required: Boolean(item.required),
    dependsOn: Array.isArray(item.dependsOn) ? [...item.dependsOn] : [],
    status: ChecklistStatus.PENDING,
    notes: '',
    validatedAt: null,
    validatedBy: null
  }));

const resolveLegacyKey = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  if (item.key && CHECKLIST_BY_KEY.has(item.key)) {
    return item.key;
  }

  if (item.id && LEGACY_CHECKLIST_ID_MAP[item.id]) {
    return LEGACY_CHECKLIST_ID_MAP[item.id];
  }

  const label = (item.label || '').toString().trim().toLowerCase();
  if (label && LEGACY_LABEL_MAP[label]) {
    return LEGACY_LABEL_MAP[label];
  }

  return null;
};

const normalizeChecklist = (checklist) => {
  if (!checklist) {
    return createChecklistState();
  }

  let items = [];
  if (Array.isArray(checklist)) {
    items = checklist;
  } else if (typeof checklist === 'object') {
    items = Object.values(checklist);
  }

  const mapped = new Map();
  for (const rawItem of items) {
    const key = resolveLegacyKey(rawItem);
    if (!key || !CHECKLIST_BY_KEY.has(key)) {
      continue;
    }
    mapped.set(key, rawItem);
  }

  return CHECKLIST_CONFIG.map((definition) => {
    const rawItem = mapped.get(definition.key);
    const status =
      rawItem?.status
        ? normalizeChecklistStatus(rawItem.status)
        : rawItem?.checked
          ? ChecklistStatus.DONE
          : ChecklistStatus.PENDING;

    return {
      key: definition.key,
      label: definition.label,
      type: definition.type,
      required: Boolean(definition.required),
      dependsOn: Array.isArray(definition.dependsOn) ? [...definition.dependsOn] : [],
      status,
      notes: rawItem?.notes || '',
      validatedAt: rawItem?.validatedAt || null,
      validatedBy: rawItem?.validatedBy || null
    };
  });
};

const setChecklistItemStatus = (checklist, key, status, options = {}) => {
  const item = checklist.find((entry) => entry.key === key);
  if (!item) {
    return checklist;
  }

  item.status = normalizeChecklistStatus(status);
  if (options.notes !== undefined) {
    item.notes = options.notes;
  }
  if (options.validatedBy) {
    item.validatedBy = options.validatedBy;
  }
  item.validatedAt = options.validatedAt || new Date().toISOString();
  return checklist;
};

const applyAutoChecklistRules = (integration, context = {}) => {
  const checklist = Array.isArray(integration.checklist)
    ? integration.checklist
    : createChecklistState();

  const markDone = (key) => {
    const item = checklist.find((entry) => entry.key === key);
    if (!item || item.status === ChecklistStatus.DONE || item.status === ChecklistStatus.ERROR) {
      return;
    }
    setChecklistItemStatus(checklist, key, ChecklistStatus.DONE, {
      validatedBy: ChecklistValidatedBy.SYSTEM
    });
  };

  if (integration.crm?.locationId) {
    markDone('subconta_criada');
  }
  if (integration.crm?.pitToken) {
    markDone('pit_token_inserido');
  }
  if (integration.crm?.customWebhookFieldId) {
    markDone('custom_value_webhook_criado');
  }
  if (integration.crm?.supportUserEmail) {
    markDone('usuario_suporte_criado');
  }
  if (context.webhookTested) {
    markDone('webhook_testado');
  }

  integration.checklist = checklist;
  return integration;
};

const recalculateIntegrationStatus = (checklist) => {
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return IntegrationStatus.DRAFT;
  }

  const requiredItems = checklist.filter((item) => item.required);
  if (checklist.some((item) => item.status === ChecklistStatus.ERROR)) {
    return IntegrationStatus.ERROR;
  }

  const allDone = requiredItems.length > 0 &&
    requiredItems.every((item) => item.status === ChecklistStatus.DONE);

  return allDone ? IntegrationStatus.ACTIVE : IntegrationStatus.ONBOARDING;
};

const createIntegration = ({ name, slug }) => {
  if (!name || !name.toString().trim()) {
    throw new Error('Nome obrigatorio.');
  }

  const normalizedSlug = normalizeSlug(slug);
  assertValidSlug(normalizedSlug);

  const now = new Date().toISOString();
  const checklist = createChecklistState();
  return {
    id: crypto.randomUUID(),
    name: name.toString().trim(),
    slug: normalizedSlug,
    status: recalculateIntegrationStatus(checklist),
    crm: normalizeCrm({}),
    checklist,
    createdAt: now,
    updatedAt: now
  };
};

const applyIntegrationUpdate = (integration, updates = {}, context = {}) => {
  if (updates.id && updates.id !== integration.id) {
    throw new Error('Campo id e imutavel.');
  }

  if (updates.slug && normalizeSlug(updates.slug) !== integration.slug) {
    throw new Error('Campo slug e imutavel.');
  }

  const next = {
    ...integration,
    crm: { ...(integration.crm || normalizeCrm({})) },
    checklist: Array.isArray(integration.checklist)
      ? integration.checklist.map((item) => ({ ...item }))
      : createChecklistState()
  };

  if (typeof updates.name === 'string' && updates.name.trim()) {
    next.name = updates.name.trim();
  }

  const crmUpdates = updates.crm || updates.credentials;
  if (crmUpdates) {
    next.crm = {
      ...next.crm,
      ...pickCrmFields(crmUpdates)
    };
  }

  if (Array.isArray(updates.checklist)) {
    next.checklist = normalizeChecklist(updates.checklist);
  }

  applyAutoChecklistRules(next, context);

  const computedStatus = recalculateIntegrationStatus(next.checklist);
  if (updates.status) {
    const requested = normalizeStatus(updates.status);
    if (requested !== computedStatus) {
      throw new Error('Status manual invalido para o checklist atual.');
    }
  }
  next.status = computedStatus;

  next.updatedAt = new Date().toISOString();
  return next;
};

const applyChecklistItemUpdate = (integration, key, options = {}) => {
  const definition = CHECKLIST_BY_KEY.get(key);
  if (!definition) {
    throw new Error('Checklist item invalido.');
  }

  if (options.manualOnly && definition.type !== 'manual') {
    throw new Error('Checklist item nao e manual.');
  }

  const next = {
    ...integration,
    checklist: Array.isArray(integration.checklist)
      ? integration.checklist.map((item) => ({ ...item }))
      : createChecklistState()
  };

  setChecklistItemStatus(next.checklist, key, options.status, {
    notes: options.notes,
    validatedBy: options.validatedBy,
    validatedAt: options.validatedAt
  });

  applyAutoChecklistRules(next, {});

  const computedStatus = recalculateIntegrationStatus(next.checklist);
  next.status = computedStatus;
  next.updatedAt = new Date().toISOString();
  return next;
};

const normalizeIntegration = (raw) => {
  const base = raw || {};
  const checklist = normalizeChecklist(base.checklist);
  return {
    id: base.id || '',
    name: base.name || '',
    slug: normalizeSlug(base.slug),
    status: recalculateIntegrationStatus(checklist),
    crm: normalizeCrm(base),
    checklist,
    createdAt: base.createdAt || base.created_at || new Date().toISOString(),
    updatedAt: base.updatedAt || base.updated_at || base.createdAt || new Date().toISOString()
  };
};

const maskToken = (token) => {
  if (!token) return '';
  const tail = token.toString().slice(-4);
  return `****${tail}`;
};

const toPublicIntegration = (integration) => ({
  ...integration,
  crm: {
    ...integration.crm,
    pitToken: maskToken(integration.crm?.pitToken)
  }
});

module.exports = {
  IntegrationStatus,
  ChecklistStatus,
  ChecklistValidatedBy,
  CRM_FIELDS,
  normalizeSlug,
  assertValidSlug,
  normalizeIntegration,
  normalizeChecklist,
  createIntegration,
  applyIntegrationUpdate,
  applyChecklistItemUpdate,
  applyAutoChecklistRules,
  recalculateIntegrationStatus,
  toPublicIntegration
};
