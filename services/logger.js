const fs = require('fs-extra');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'logs.json');

fs.ensureDirSync(LOG_DIR);
fs.ensureFileSync(LOG_FILE);

let writeQueue = Promise.resolve();

const EMAIL_REGEX = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;
const PHONE_REGEX = /(\+?\d[\d\s().-]{6,}\d)/g;
const TOKEN_KEY_REGEX = /(token|authorization|bearer|pit)/i;

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const prefix = user.slice(0, 2);
  return `${prefix}***@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
};

const sanitizeString = (value, key) => {
  if (!value || typeof value !== 'string') return value;
  if (key && TOKEN_KEY_REGEX.test(key)) return '***';

  let sanitized = value.replace(EMAIL_REGEX, (match) => maskEmail(match));
  sanitized = sanitized.replace(/Bearer\s+[^\s]+/gi, 'Bearer ***');
  sanitized = sanitized.replace(PHONE_REGEX, (match) => maskPhone(match));
  return sanitized;
};

const sanitizeValue = (value, key) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeString(value, key);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === 'object') {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (TOKEN_KEY_REGEX.test(childKey)) {
        output[childKey] = '***';
      } else {
        output[childKey] = sanitizeValue(childValue, childKey);
      }
    }
    return output;
  }
  return value;
};

const sanitizeLogMetadata = (metadata) => sanitizeValue(metadata || {});

const appendLine = async (line) => {
  await fs.appendFile(LOG_FILE, line);
};

const log = ({ integrationId, category, message, metadata = {}, eventId, leadId }) => {
  const entry = {
    timestamp: new Date().toISOString(),
    integrationId: integrationId || null,
    eventId: eventId || null,
    leadId: leadId || null,
    category,
    message: sanitizeString(message),
    metadata: sanitizeLogMetadata(metadata)
  };

  const line = `${JSON.stringify(entry)}\n`;
  writeQueue = writeQueue.then(() => appendLine(line)).catch(() => appendLine(line));
  return writeQueue.catch(() => {});
};

const readLogs = async () => {
  const content = await fs.readFile(LOG_FILE, 'utf8');
  return content
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
};

module.exports = {
  log,
  readLogs,
  LOG_FILE,
  maskEmail,
  maskPhone,
  sanitizeLogMetadata
};
