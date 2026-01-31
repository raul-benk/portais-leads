const fs = require('fs-extra');
const path = require('path');

const storage = require('../storage');
const logger = require('../services/logger');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const INTEGRATIONS_FILE = path.join(OUTPUT_DIR, 'integrations.json');

fs.ensureDirSync(OUTPUT_DIR);
if (!fs.existsSync(INTEGRATIONS_FILE)) {
  fs.writeJsonSync(INTEGRATIONS_FILE, []);
}

let integrationsWriteQueue = Promise.resolve();

const readIntegrationsRaw = async () => {
  const data = await fs.readJson(INTEGRATIONS_FILE);
  return Array.isArray(data) ? data : [];
};

const scheduleIntegrationWrite = (operation) => {
  const task = async () => {
    const current = await readIntegrationsRaw();
    const next = await operation(current);
    if (next !== undefined) {
      const tmpFile = `${INTEGRATIONS_FILE}.tmp`;
      await fs.writeJson(tmpFile, next, { spaces: 2 });
      await fs.move(tmpFile, INTEGRATIONS_FILE, { overwrite: true });
      return next;
    }
    return current;
  };

  const nextPromise = integrationsWriteQueue.then(task, task);
  integrationsWriteQueue = nextPromise;
  return nextPromise;
};

const createJsonRepositories = () => {
  const integrations = {
    readAll: readIntegrationsRaw,
    transact: scheduleIntegrationWrite
  };

  const events = {
    append: (event) => storage.appendWebhookEvent(event),
    update: (eventId, updates) => storage.updateWebhookEvent(eventId, updates),
    list: () => storage.readWebhookEvents(),
    findById: async (eventId) => {
      const list = await storage.readWebhookEvents();
      return list.find((evt) => evt.eventId === eventId || evt.id === eventId) || null;
    }
  };

  const leads = {
    append: (lead) => storage.appendLead(lead),
    update: (leadId, updates) => storage.updateLead(leadId, updates),
    remove: (leadId) => storage.deleteLead(leadId),
    list: () => storage.readLeads(),
    findById: async (leadId) => {
      const list = await storage.readLeads();
      return list.find((lead) => lead.leadId === leadId || lead.id === leadId) || null;
    }
  };

  const logs = {
    append: (entry) => logger.log(entry),
    list: () => logger.readLogs()
  };

  return {
    integrations,
    events,
    leads,
    logs
  };
};

module.exports = {
  createJsonRepositories
};
