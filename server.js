require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const storage = require('./storage');
const path = require('path');
const integrationService = require('./services/integration-service');
const securityConfig = require('./security.config');
const internalAuth = require('./middleware/internal-auth');
const webhookValidation = require('./middleware/webhook-validation');

const app = express();
const PORT = 3434;

if (!securityConfig.internalAuth?.token) {
  console.warn('⚠️ INTERNAL_TOKEN não definido. Em dev as rotas internas ficam liberadas; em produção, proteja com token.');
}

const respondServiceError = (res, error, fallbackMessage) => {
  const status = error?.statusCode || 500;
  res.status(status).json({
    error: error?.message || fallbackMessage,
    code: error?.code,
    details: error?.details
  });
};

const requireConfirmAction = (req, res, next) => {
  const value = (req.headers['x-confirm-action'] || '').toString().toLowerCase();
  if (value === 'true') return next();
  return res.status(400).json({ error: 'Confirmacao obrigatoria para esta acao.' });
};

// ================================
// CORS
// ================================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Internal-Token, X-Confirm-Action');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// ================================
// Parsers
// ================================
const payloadLimit = securityConfig.payloadLimit || '1mb';
app.use(bodyParser.json({ limit: payloadLimit }));
app.use(bodyParser.urlencoded({ extended: true, limit: payloadLimit }));
app.use(bodyParser.text({ type: '*/*', limit: payloadLimit }));

// ================================
// Rotas de Integração (CRUD)
// ================================

// Listar integrações
app.get('/api/integrations', async (req, res) => {
  try {
    const integrations = await integrationService.listIntegrations({ maskSensitive: true });
    res.json(integrations);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar integrações' });
  }
});

// Criar integração (Etapa 1)
app.post('/api/integrations', async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nome e Slug são obrigatórios' });

    const newIntegration = await integrationService.createIntegration({ name, slug });
    console.log(`✅ Integração criada e salva em JSON: ${newIntegration.slug}`);
    res.json(newIntegration);
  } catch (error) {
    console.error(error);
    const status = error.message?.includes('Slug') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Erro ao criar integração' });
  }
});

// Atualizar integração (Etapa 2 - Credenciais)
app.put('/api/integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await integrationService.updateIntegration(id, updates);
    console.log(`✅ Integração ${id} atualizada e salva em JSON.`);
    res.json(updated);
  } catch (error) {
    const status = error.message?.includes('nao encontrada') ? 404 : 400;
    res.status(status).json({ error: error.message || 'Erro ao atualizar integração' });
  }
});

// Excluir integração
app.delete('/api/integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await integrationService.deleteIntegration(id);
    console.log(`✅ Integração ${id} removida e salva em JSON.`);
    res.json({ success: true });
  } catch (error) {
    const status = error.message?.includes('nao encontrada') ? 404 : 400;
    res.status(status).json({ error: error.message || 'Erro ao excluir integração' });
  }
});

// Checklist manual (Interno)
app.post('/integrations/:id/checklist/:key/complete', internalAuth, async (req, res) => {
  try {
    const { id, key } = req.params;
    const { notes } = req.body || {};
    const updated = await integrationService.markChecklistItemDoneManual(id, key, { notes });
    res.json(updated);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao atualizar checklist');
  }
});

// ================================
// CRM Automacoes (Internas)
// ================================
app.patch('/integrations/:id/crm', internalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await integrationService.updateCrmFields(id, req.body || {});
    res.json(updated);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao atualizar CRM');
  }
});

app.post('/integrations/:id/crm/identify-workflow', async (req, res) => {
  try {
    const result = await integrationService.identifyWorkflow(req.params.id);
    res.json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao identificar workflow');
  }
});

app.post('/integrations/:id/crm/create-webhook-value', async (req, res) => {
  try {
    const updated = await integrationService.ensureCustomWebhookValue(req.params.id);
    res.json(updated);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao criar custom value');
  }
});

app.post('/integrations/:id/crm/create-support-user', async (req, res) => {
  try {
    const updated = await integrationService.ensureSupportUser(req.params.id);
    res.json(updated);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao criar usuario de suporte');
  }
});

// ================================
// Webhook Healthcheck (Interno)
// ================================
app.post('/integrations/:id/webhook/healthcheck', internalAuth, async (req, res) => {
  try {
    const result = await integrationService.runWebhookHealthcheck(req.params.id);
    res.json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao executar healthcheck');
  }
});

// ================================
// Teste de Integração (Interno)
// ================================
app.post('/integrations/:id/test', internalAuth, async (req, res) => {
  try {
    const result = await integrationService.testIntegration(req.params.id);
    res.json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao testar integracao');
  }
});

// ================================
// Reprocessamento (Interno)
// ================================
app.post('/events/:eventId/reprocess', internalAuth, async (req, res) => {
  try {
    const result = await integrationService.reprocessEvent(req.params.eventId);
    res.json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao reprocessar evento');
  }
});

app.post('/leads/:leadId/reprocess', internalAuth, async (req, res) => {
  try {
    const result = await integrationService.reprocessLead(req.params.leadId);
    res.json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao reprocessar lead');
  }
});

// ================================
// LGPD (Interno)
// ================================
app.delete('/leads/:id', internalAuth, requireConfirmAction, async (req, res) => {
  try {
    const result = await integrationService.deleteLead(req.params.id);
    res.json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao remover lead');
  }
});

app.post('/leads/:id/anonymize', internalAuth, requireConfirmAction, async (req, res) => {
  try {
    const result = await integrationService.anonymizeLead(req.params.id);
    res.json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao anonimizar lead');
  }
});

// ================================
// Webhook Dinâmico
// ================================
app.get('/webhook/email/:slug/health', async (req, res) => {
  try {
    const result = await integrationService.getWebhookHealth(req.params.slug);
    res.status(result.status).json(result.payload);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao checar health do webhook');
  }
});

app.post('/webhook/email/:slug', webhookValidation, async (req, res) => {
  try {
    const result = await integrationService.processWebhook({
      slug: req.params.slug,
      headers: req.headers,
      body: req.body,
      dryRun: false
    });
    res.status(200).json(result);
  } catch (error) {
    respondServiceError(res, error, 'Erro ao processar webhook');
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const leads = await storage.readLeads();
    res.json(leads);
  } catch (error) {
    console.error('❌ Erro ao ler leads:', error);
    res.status(500).json({ error: 'Erro ao buscar leads' });
  }
});

app.get('/api/webhooks', async (req, res) => {
  try {
    const events = await storage.readWebhookEvents();
    res.json(events);
  } catch (error) {
    console.error('❌ Erro ao ler webhooks:', error);
    res.status(500).json({ error: 'Erro ao buscar webhooks' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await integrationService.listLogs();
    res.json(logs);
  } catch (error) {
    console.error('❌ Erro ao ler logs:', error);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

// ================================
// Frontend Estático (Produção)
// ================================
// Serve os arquivos estáticos do build do React
app.use(express.static(path.join(__dirname, 'portais-admin/dist')));

// Qualquer outra rota não-API retorna o index.html (para o React Router funcionar)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'portais-admin/dist/index.html'));
});

// ================================
// Start server
// ================================
app.listen(PORT, () => {
  console.log(`🚀 Webhook rodando em http://localhost:${PORT}`);
});
