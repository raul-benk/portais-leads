const securityConfig = require('../security.config');
const logger = require('../services/logger');

const normalizeIp = (ip) => {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
  return ip;
};

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return normalizeIp(forwarded.split(',')[0].trim());
  }
  return normalizeIp(req.socket?.remoteAddress || '');
};

const isAllowedIp = (ip, allowlist) => {
  if (!allowlist || allowlist.length === 0) return false;
  return allowlist.includes(ip);
};

const internalAuth = (req, res, next) => {
  const config = securityConfig.internalAuth || {};
  const isDev = process.env.NODE_ENV !== 'production';

  if (req.method === 'OPTIONS') {
    return next();
  }

  if (config.mode === 'header' && !config.token && isDev) {
    return next();
  }

  if (config.mode === 'ip' && (!config.ipAllowlist || config.ipAllowlist.length === 0) && isDev) {
    return next();
  }

  if (config.mode === 'ip') {
    const requestIp = getRequestIp(req);
    if (isAllowedIp(requestIp, config.ipAllowlist)) {
      return next();
    }

    logger.log({
      category: 'ERROR',
      message: 'Acesso interno bloqueado (IP nao permitido)',
      metadata: { ip: requestIp, path: req.path }
    });
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  const headerName = (config.headerName || 'x-internal-token').toLowerCase();
  const token = config.token;
  const provided = req.headers[headerName];

  if (token && provided && provided === token) {
    return next();
  }

  logger.log({
    category: 'ERROR',
    message: 'Acesso interno bloqueado (token invalido)',
    metadata: { path: req.path }
  });
  return res.status(401).json({ error: 'Token interno invalido.' });
};

module.exports = internalAuth;
