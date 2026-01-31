const RETENTION_CONFIG = {
  logRetentionDays: Number(process.env.LOG_RETENTION_DAYS || 90),
  eventRetentionDays: Number(process.env.EVENT_RETENTION_DAYS || 90)
};

module.exports = RETENTION_CONFIG;
