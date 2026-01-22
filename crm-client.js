const https = require('https');

/**
 * Cria um contato no CRM via API da Lead Connector.
 * @param {object} contactDetails - Objeto com os detalhes do contato (firstName, lastName, email, phone, source).
 * @param {object} credentials - Objeto com { pitToken, locationId }.
 * @returns {Promise<object>} A resposta da API.
 */
function createContact(contactDetails, credentials) {
  return new Promise((resolve, reject) => {
    if (!credentials || !credentials.pitToken || !credentials.locationId) {
      return reject(new Error("Credenciais (pitToken, locationId) são obrigatórias."));
    }

    // Adiciona o locationId obrigatório e garante que os campos essenciais existam
    const contactPayload = {
      firstName: contactDetails.firstName || '',
      lastName: contactDetails.lastName || '',
      name: `${contactDetails.firstName || ''} ${contactDetails.lastName || ''}`.trim(),
      email: contactDetails.email || '',
      phone: contactDetails.phone || '',
      locationId: credentials.locationId,
      source: contactDetails.source || 'Email Webhook',
    };

    const postData = JSON.stringify(contactPayload);

    const options = {
      hostname: 'services.leadconnectorhq.com',
      path: '/contacts/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28',
        'Authorization': `Bearer ${credentials.pitToken}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        console.log('Resposta da API do CRM (Contato) - Status:', res.statusCode);
        
        let responseJson = {};
        try {
          responseJson = JSON.parse(responseBody || '{}');
        } catch (e) {
            console.error('❌ Erro: A resposta da API (Contato) não é um JSON válido:', responseBody);
            const error = new Error(`API response is not valid JSON: ${responseBody}`);
            error.statusCode = res.statusCode;
            return reject(error);
        }

        // Se a requisição foi um sucesso (status 2xx), resolve.
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Contato criado/atualizado com sucesso!');
            resolve(responseJson);
        } else {
            // Para qualquer outro status, rejeita a promise com os detalhes do erro.
            console.error(`❌ Erro da API (Contato): ${res.statusCode}`);
            console.error('Detalhes:', responseJson);
            const error = new Error(JSON.stringify(responseJson));
            error.statusCode = res.statusCode;
            reject(error);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Problema na requisição para a API (Contato):', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Cria ou atualiza uma oportunidade no CRM.
 * @param {object} opportunityDetails - Detalhes da oportunidade.
 * @param {object} credentials - Objeto com { pitToken, locationId }.
 * @returns {Promise<object>} A resposta da API.
 */
function upsertOpportunity(opportunityDetails, credentials) {
  return new Promise((resolve, reject) => {
    if (!credentials || !credentials.pitToken || !credentials.locationId) {
      return reject(new Error("Credenciais (pitToken, locationId) são obrigatórias."));
    }

    // O locationId é obrigatório para o upsert
    const opportunityPayload = {
      ...opportunityDetails,
      locationId: credentials.locationId, // Garante que o locationId está no payload
    };

    const postData = JSON.stringify(opportunityPayload);
    console.log('➡️ Payload da Oportunidade (Upsert) enviado:', postData);

    const options = {
      hostname: 'services.leadconnectorhq.com',
      path: '/opportunities/upsert',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28',
        'Authorization': `Bearer ${credentials.pitToken}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        console.log('Resposta da API do CRM (Oportunidade Upsert) - Status:', res.statusCode);
        
        let responseJson = {};
        try {
          responseJson = JSON.parse(responseBody || '{}');
          console.log('↪️ Resposta da API (Oportunidade Upsert):', responseJson);
        } catch (e) {
          console.error('❌ Erro: A resposta da API (Oportunidade Upsert) não é um JSON válido:', responseBody);
          const error = new Error('Resposta da API inválida');
          error.statusCode = res.statusCode;
          return reject(error);
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Oportunidade criada/atualizada com sucesso!');
            resolve(responseJson);
        } else {
            console.error(`❌ Erro inesperado da API (Oportunidade Upsert): ${res.statusCode}`);
            const error = new Error(JSON.stringify(responseJson));
            error.statusCode = res.statusCode;
            reject(error);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Problema na requisição para a API (Oportunidade Upsert):', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { createContact, upsertOpportunity };
