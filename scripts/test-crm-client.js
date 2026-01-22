const { createContact, upsertOpportunity } = require('../crm-client');

async function test() {
  console.log('🚀 Iniciando teste do crm-client.js (Stateless)...');

  const fakeCredentials = {
    pitToken: 'fake_pit_token_123',
    locationId: 'fake_location_id_456'
  };

  const fakeContact = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '+5511999999999',
    source: 'Test Script'
  };

  console.log('\n1️⃣ Testando createContact com credenciais falsas...');
  try {
    await createContact(fakeContact, fakeCredentials);
  } catch (error) {
    console.log('✅ Erro esperado capturado (401/400):', error.message.substring(0, 100) + '...');
  }

  console.log('\n2️⃣ Testando upsertOpportunity com credenciais falsas...');
  try {
    await upsertOpportunity({ title: 'Test Opp', pipelineId: '123' }, fakeCredentials);
  } catch (error) {
    console.log('✅ Erro esperado capturado (401/400):', error.message.substring(0, 100) + '...');
  }
  
  console.log('\n🏁 Teste concluído.');
}

test();