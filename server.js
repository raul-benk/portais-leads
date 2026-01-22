require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const storage = require('./storage');

const app = express();
const PORT = 3434;

// ================================
// CORS
// ================================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ================================
// Parsers
// ================================
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.text({ type: '*/*', limit: '50mb' }));

// ================================
// CRM Client
// ================================
const { createContact, upsertOpportunity } = require('./crm-client.js');

// ================================
// Rotas de Integração (CRUD)
// ================================

// Listar integrações
app.get('/api/integrations', async (req, res) => {
  try {
    const integrations = await storage.readIntegrations();
    // Mascara o token para segurança no frontend
    const safeIntegrations = integrations.map(i => ({
      ...i,
      credentials: { ...i.credentials, pitToken: i.credentials?.pitToken ? '****' + i.credentials.pitToken.slice(-4) : '' }
    }));
    res.json(safeIntegrations);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar integrações' });
  }
});

// Criar integração (Etapa 1)
app.post('/api/integrations', async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nome e Slug são obrigatórios' });

    const integrations = await storage.readIntegrations();
    
    if (integrations.find(i => i.slug === slug)) {
      return res.status(400).json({ error: 'Slug já existe' });
    }

    const newIntegration = {
      id: crypto.randomUUID(),
      name,
      slug,
      status: 'active',
      createdAt: new Date().toISOString(),
      credentials: {
        pitToken: '',
        locationId: ''
      },
      checklist: [
        { id: '1', label: 'Integração criada', checked: true, status: 'Done' },
        { id: '2', label: 'Credenciais configuradas', checked: false, status: 'Pending' },
        { id: '3', label: 'Sub-conta criada', checked: false, status: 'Pending' },
        { id: '4', label: 'DNS configurado', checked: false, status: 'Pending' },
        { id: '5', label: 'Email de notificação', checked: false, status: 'Pending' },
        { id: '6', label: 'Automação ativada', checked: false, status: 'Pending' },
        { id: '7', label: 'Webhook recebendo dados', checked: false, status: 'Pending' },
      ]
    };

    // Adiciona e salva
    await storage.writeIntegrations([...integrations, newIntegration]);
    res.json(newIntegration);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar integração' });
  }
});

// Atualizar integração (Etapa 2 - Credenciais)
app.put('/api/integrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const integrations = await storage.readIntegrations();
    const index = integrations.findIndex(i => i.id === id);

    if (index === -1) return res.status(404).json({ error: 'Integração não encontrada' });

    // Atualiza campos permitidos
    if (updates.credentials) {
      integrations[index].credentials = { ...integrations[index].credentials, ...updates.credentials };
      
      // Atualiza checklist se credenciais foram preenchidas
      if (updates.credentials.pitToken && updates.credentials.locationId) {
        const checkItem = integrations[index].checklist.find(i => i.id === '2');
        if (checkItem) { checkItem.checked = true; checkItem.status = 'Done'; }
      }
    }
    
    if (updates.status) integrations[index].status = updates.status;
    if (updates.checklist) integrations[index].checklist = updates.checklist;

    await storage.writeIntegrations(integrations);
    res.json(integrations[index]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar integração' });
  }
});

// ================================
// Webhook Dinâmico
// ================================
app.post('/webhook/email/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // 0. Busca a integração e credenciais
    const integration = await storage.getIntegrationBySlug(slug);

    if (!integration) {
      console.warn(`⚠️ Webhook recebido para slug desconhecido: ${slug}`);
      return res.status(404).json({ error: 'Integração não encontrada' });
    }

    if (integration.status !== 'active') {
      console.warn(`⚠️ Webhook recebido para integração inativa: ${slug}`);
      return res.status(400).json({ error: 'Integração inativa' });
    }

    const event = {
      integrationId: integration.id,
      integrationSlug: slug,
      receivedAt: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
    };

    // 1. Salva o evento original
    await storage.appendWebhookEvent(event);
    console.log(`📩 Webhook recebido para ${slug} e salvo com sucesso`);

    // Atualiza checklist da integração (Webhook receiving data)
    const checkItem = integration.checklist.find(i => i.id === '7');
    if (checkItem && !checkItem.checked) {
      checkItem.checked = true;
      checkItem.status = 'Done';
      // Atualiza a integração no storage
      const allIntegrations = await storage.readIntegrations();
      const intIndex = allIntegrations.findIndex(i => i.id === integration.id);
      if (intIndex !== -1) allIntegrations[intIndex] = integration;
      await storage.writeIntegrations(allIntegrations);
    }

    let dataToSave = null;
    const bodyMail = req.body?.customData?.['body-mail'];

    // 2. Extrai e parseia o JSON do corpo do e-mail
    if (typeof bodyMail === 'string') {
      console.log("⚙️ Encontrado `customData['body-mail']`. Tentando extrair JSON...");
      const jsonMatch = bodyMail.match(/```json\s*({[\s\S]+?})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          dataToSave = JSON.parse(jsonMatch[1]);
        } catch (parseError) {
          console.error('❌ Erro ao fazer o parse do JSON extraído do body-mail:', parseError);
        }
      } else {
        console.warn('⚠️ Nenhum bloco JSON ` ```json ... ``` ` encontrado no body-mail.');
      }
    } else {
      console.log("ℹ️ Nenhum campo `customData['body-mail']` do tipo string encontrado.");
    }

    if (!dataToSave) {
      console.log('ℹ️ Nenhum dado JSON válido para processar.');
      return res.status(200).json({ success: true, message: 'Nenhum dado processável.' });
    }

    // 3. Prepara e salva o lead com status inicial 'received'
    const leadData = {
      leadId: crypto.randomUUID(),
      integrationId: integration.id,
      integrationName: integration.name,
      receivedAt: event.receivedAt,
      status: 'received',
      ...dataToSave
    };

    console.log('✅ Dados processados do webhook:', JSON.stringify(leadData, null, 2));
    await storage.appendLead(leadData);
    console.log(`💾 Dados processados salvos com leadId: ${leadData.leadId}`);

    // Função para atualizar o lead no arquivo
    const updateLeadFile = async (status, crmData) => {
      await storage.updateLead(leadData.leadId, {
        status,
        crm: crmData
      });
        console.log(`🔄 Status do lead ${leadData.leadId} atualizado para '${status}'`);
    };

    // 4. --- Início da Interação com o CRM ---
    try {
      // Verifica se temos credenciais
      if (!integration.credentials?.pitToken || !integration.credentials?.locationId) {
        throw new Error('Credenciais (PIT_TOKEN, LOCATION_ID) não configuradas para esta integração.');
      }
      const credentials = integration.credentials;

      let contactId;
      try {
        console.log('➡️ Etapa 1: Processando contato no CRM...');
        const nameParts = (leadData.nome || '').split(' ');
        const contactDetails = {
          firstName: nameParts.shift() || '',
          lastName: nameParts.join(' ') || '',
          email: leadData.email,
          phone: leadData.telefone,
          source: leadData.fonte_do_lead,
        };

        const contactResponse = await createContact(contactDetails, credentials);
        contactId = contactResponse?.contact?.id;
        console.log(`✅ Contato criado com sucesso. ID: ${contactId}`);

      } catch (contactError) {
        let errorData;
        try {
          // O erro vem com a mensagem sendo uma string JSON, então fazemos o parse.
          errorData = JSON.parse(contactError.message);
        } catch (e) {
          // Se o parse falhar, não é o erro de duplicidade que esperamos. Relança o erro original.
          throw contactError;
        }

        // Agora, inspecionamos o erro para ver se é o de duplicidade
        if (
          contactError.statusCode === 400 &&
          errorData.message === 'This location does not allow duplicated contacts.' &&
          errorData.meta?.contactId
        ) {
          console.warn(`ℹ️ Contato já existente (Erro 400). Usando o ID recuperado: ${errorData.meta.contactId}`);
          contactId = errorData.meta.contactId; // Atribui o ID existente e continua o fluxo
        } else {
          // Se for qualquer outro erro, relança para o catch principal tratar como falha.
          throw contactError;
        }
      }
      
      if (!contactId) {
        throw new Error('Não foi possível obter o ID do contato após todas as tentativas.');
      }
      
      console.log(`➡️ Etapa 2: Usando ID de contato: ${contactId}. Criando/atualizando oportunidade...`);
      const priceString = leadData.preco || '0';
      const monetaryValue = parseFloat(priceString.replace(/[^0-9,.-]+/g, '').replace(/\./g, '').replace(',', '.')) || 0;
      const opportunityName = `${leadData.nome || 'Novo Lead'} - ${leadData.placa || leadData.veiculo_interesse || ''}`.trim();

      const customFields = [];
      if (leadData.veiculo_interesse) {
        customFields.push({ id: "MFmWzuig3M2CoRPOgr7T", field_value: leadData.veiculo_interesse });
      }
      if (leadData.placa) {
        customFields.push({ id: "KmT56Is6DrePLfwU8CYp", field_value: leadData.placa });
      }
      if (leadData.mensagem) { // Mantendo o campo de mensagem
        customFields.push({ id: "xbmeg8BTFELaXyCJsMrK", field_value: leadData.mensagem });
      }

      const opportunityData = {
        pipelineId: 'zZrlKDUQrTCcfZDQwM7C',
        pipelineStageId: 'cf2a63ab-3579-438c-ab49-752a7ae18d96',
        contactId: contactId,
        name: opportunityName,
        status: 'open',
        source: leadData.fonte_do_lead,
        monetaryValue: monetaryValue,
        customFields: customFields.length > 0 ? customFields : undefined,
      };

      const opportunityResponse = await upsertOpportunity(opportunityData, credentials);
      console.log('✅ Processo de CRM (Contato + Oportunidade) finalizado com sucesso.');

      await updateLeadFile('processed', {
        contactId: contactId,
        opportunityId: opportunityResponse?.id,
        processedAt: new Date().toISOString()
      });

    } catch (crmError) {
      console.error(`⚠️ Falha durante o processo de interação com o CRM: ${crmError.message}`);
      await updateLeadFile('failed', {
        error: crmError.message,
        processedAt: new Date().toISOString()
      });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Erro fatal no processamento do webhook:', err);
    res.status(500).json({ error: 'Erro ao processar webhook' });
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

// ================================
// Healthcheck
// ================================
app.get('/', (_, res) => {
  res.send('Webhook ativo 🚀');
});

// ================================
// Start server
// ================================
app.listen(PORT, () => {
  console.log(`🚀 Webhook rodando em http://localhost:${PORT}`);
});