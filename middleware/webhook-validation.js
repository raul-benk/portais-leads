const logger = require('../services/logger');

const hasValidBody = (body) => {
  if (!body || typeof body !== 'object') return false;
  if (Array.isArray(body)) return false;
  if (Object.keys(body).length === 0) return false;

  const bodyMail = body?.customData?.['body-mail'];
  if (typeof bodyMail !== 'string' || bodyMail.trim().length === 0) {
    return false;
  }

  const jsonMatch = bodyMail.match(/```json\s*({[\s\S]+?})\s*```/);
  if (!jsonMatch || !jsonMatch[1]) {
    return false;
  }

  try {
    JSON.parse(jsonMatch[1]);
  } catch (error) {
    return false;
  }

  return true;
};

const webhookValidation = (req, res, next) => {
  if (hasValidBody(req.body)) {
    return next();
  }

  logger.log({
    category: 'ERROR',
    message: 'Webhook payload invalido',
    metadata: { slug: req.params?.slug || null }
  });

  return res.status(400).json({ error: 'Payload invalido.' });
};

module.exports = webhookValidation;
