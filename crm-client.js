const https = require('https');

const API_CONFIG = {
  hostname: 'services.leadconnectorhq.com',
  version: '2021-07-28'
};

/**
 * Helper para realizar requisições HTTPS genéricas para o CRM.
 */
function makeRequest(path, method, data, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: API_CONFIG.hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': API_CONFIG.version,
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        let responseJson = {};
        try {
          responseJson = JSON.parse(responseBody || '{}');
        } catch (e) {
          const error = new Error(`API response is not valid JSON: ${responseBody}`);
          error.statusCode = res.statusCode;
          return reject(error);
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseJson);
        } else {
          // Retorna o JSON de erro stringificado para que o chamador possa fazer o parse se necessário
          const error = new Error(JSON.stringify(responseJson));
          error.statusCode = res.statusCode;
          reject(error);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

/**
 * Cria um contato no CRM via API da Lead Connector.
 */
function createContact(contactDetails, credentials) {
  if (!credentials?.pitToken || !credentials?.locationId) {
    return Promise.reject(new Error("Credenciais (pitToken, locationId) são obrigatórias."));
  }

  const payload = {
    firstName: contactDetails.firstName || '',
    lastName: contactDetails.lastName || '',
    name: `${contactDetails.firstName || ''} ${contactDetails.lastName || ''}`.trim(),
    email: contactDetails.email || '',
    phone: contactDetails.phone || '',
    locationId: credentials.locationId,
    source: contactDetails.source || 'Email Webhook',
  };

  console.log('➡️ Enviando requisição de Contato...');
  return makeRequest('/contacts/', 'POST', payload, credentials.pitToken);
}

/**
 * Cria ou atualiza uma oportunidade no CRM.
 */
function upsertOpportunity(opportunityDetails, credentials) {
  if (!credentials?.pitToken || !credentials?.locationId) {
    return Promise.reject(new Error("Credenciais (pitToken, locationId) são obrigatórias."));
  }

  const payload = {
    ...opportunityDetails,
    locationId: credentials.locationId,
  };

  console.log('➡️ Enviando requisição de Oportunidade (Upsert)...');
  return makeRequest('/opportunities/upsert', 'POST', payload, credentials.pitToken);
}

module.exports = { createContact, upsertOpportunity };
