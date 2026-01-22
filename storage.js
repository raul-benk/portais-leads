const fs = require('fs-extra');
const path = require('path');

// Definição dos caminhos
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const LOG_DIR = path.resolve(__dirname, 'logs');

const FILES = {
  INTEGRATIONS: path.join(OUTPUT_DIR, 'integrations.json'),
  LEADS: path.join(OUTPUT_DIR, 'leads.json'),
  WEBHOOKS: path.join(LOG_DIR, 'webhook-events.json')
};

// Garante a estrutura inicial
fs.ensureDirSync(OUTPUT_DIR);
fs.ensureDirSync(LOG_DIR);

for (const file of Object.values(FILES)) {
  if (!fs.existsSync(file)) {
    fs.writeJsonSync(file, []);
  }
}

// Filas de escrita para evitar Race Conditions (Mutex simples)
const writeQueues = {
  [FILES.INTEGRATIONS]: Promise.resolve(),
  [FILES.LEADS]: Promise.resolve(),
  [FILES.WEBHOOKS]: Promise.resolve()
};

/**
 * Executa uma operação de leitura-modificação-escrita de forma segura e atômica.
 */
function scheduleWrite(filePath, operation) {
  const previousPromise = writeQueues[filePath];
  
  const task = async () => {
    try {
      // 1. Lê os dados atuais
      const currentData = await fs.readJson(filePath);
      // 2. Executa a modificação (callback)
      const newData = await operation(currentData);
      
      if (newData !== undefined) {
        // 3. Escreve em arquivo temporário
        const tmpFile = `${filePath}.tmp`;
        await fs.writeJson(tmpFile, newData, { spaces: 2 });
        // 4. Renomeia para o arquivo final (atômico)
        await fs.move(tmpFile, filePath, { overwrite: true });
        return newData;
      }
      return currentData;
    } catch (err) {
      console.error(`❌ Erro de I/O em ${path.basename(filePath)}:`, err);
      throw err;
    }
  };

  // Encadeia a tarefa na fila
  const nextPromise = previousPromise.then(task, task);
  writeQueues[filePath] = nextPromise;
  return nextPromise;
}

// --- Métodos Públicos ---

const storage = {
  // Integrações
  readIntegrations: () => fs.readJson(FILES.INTEGRATIONS),
  
  writeIntegrations: (data) => scheduleWrite(FILES.INTEGRATIONS, () => data),
  
  getIntegrationBySlug: async (slug) => {
    const list = await fs.readJson(FILES.INTEGRATIONS);
    return list.find(i => i.slug === slug);
  },

  // Webhooks
  readWebhookEvents: () => fs.readJson(FILES.WEBHOOKS),
  
  appendWebhookEvent: (event) => scheduleWrite(FILES.WEBHOOKS, (list) => {
    list.push(event);
    return list;
  }),

  // Leads
  readLeads: () => fs.readJson(FILES.LEADS),
  
  appendLead: (lead) => scheduleWrite(FILES.LEADS, (list) => {
    list.push(lead);
    return list;
  }),

  updateLead: (leadId, updates) => scheduleWrite(FILES.LEADS, (list) => {
    const index = list.findIndex(l => l.id === leadId || l.leadId === leadId);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      return list;
    }
    // Se não encontrar, retorna undefined para não reescrever o arquivo
    return undefined; 
  })
};

module.exports = storage;