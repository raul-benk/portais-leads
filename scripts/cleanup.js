const fs = require('fs-extra');
const path = require('path');

const retentionConfig = require('../retention.config');

const LOG_FILE = path.resolve(__dirname, '..', 'logs', 'logs.json');
const EVENTS_FILE = path.resolve(__dirname, '..', 'logs', 'webhook-events.json');

const toCutoff = (days) => Date.now() - (Number(days) || 0) * 24 * 60 * 60 * 1000;

const parseJsonLines = (content) =>
  content
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

const cleanupLogs = async () => {
  if (!fs.existsSync(LOG_FILE)) return { removed: 0, kept: 0 };
  const content = await fs.readFile(LOG_FILE, 'utf8');
  const entries = parseJsonLines(content);
  const cutoff = toCutoff(retentionConfig.logRetentionDays);
  const kept = entries.filter((entry) => {
    const ts = new Date(entry.timestamp || 0).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
  const output = kept.map((entry) => `${JSON.stringify(entry)}\n`).join('');
  await fs.writeFile(LOG_FILE, output);
  return { removed: entries.length - kept.length, kept: kept.length };
};

const cleanupEvents = async () => {
  if (!fs.existsSync(EVENTS_FILE)) return { removed: 0, kept: 0 };
  const events = await fs.readJson(EVENTS_FILE);
  const cutoff = toCutoff(retentionConfig.eventRetentionDays);
  const kept = (Array.isArray(events) ? events : []).filter((event) => {
    const ts = new Date(event.receivedAt || event.processedAt || 0).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });
  await fs.writeJson(EVENTS_FILE, kept, { spaces: 2 });
  return { removed: (Array.isArray(events) ? events.length : 0) - kept.length, kept: kept.length };
};

const run = async () => {
  try {
    const logResult = await cleanupLogs();
    const eventResult = await cleanupEvents();
    console.log(`🧹 Logs: ${logResult.removed} removidos, ${logResult.kept} mantidos`);
    console.log(`🧹 Eventos: ${eventResult.removed} removidos, ${eventResult.kept} mantidos`);
  } catch (error) {
    console.error('❌ Erro ao executar cleanup:', error);
    process.exitCode = 1;
  }
};

run();
