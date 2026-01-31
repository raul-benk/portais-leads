const createExecutionContext = ({ eventId, integrationId, source, attempt }) => ({
  eventId,
  integrationId,
  source,
  attempt,
  timestamp: new Date().toISOString()
});

module.exports = {
  createExecutionContext
};
