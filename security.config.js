const SECURITY_CONFIG = {
  internalAuth: {
    mode: 'header',
    headerName: 'x-internal-token',
    token: process.env.INTERNAL_TOKEN || '',
    ipAllowlist: (process.env.INTERNAL_IP_ALLOWLIST || '').split(',').map((item) => item.trim()).filter(Boolean)
  },
  payloadLimit: process.env.PAYLOAD_LIMIT || '1mb'
};

module.exports = SECURITY_CONFIG;
