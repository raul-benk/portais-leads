const storage = require('../storage');
const fs = require('fs-extra');
const path = require('path');

async function test() {
  console.log('🚀 Iniciando teste do storage.js...');

  // 1. Teste de Integrações
  console.log('\n1️⃣ Testando escrita de integrações...');
  const mockIntegration = { id: 'test_1', name: 'Teste Storage', slug: 'teste-storage' };
  await storage.writeIntegrations([mockIntegration]);
  
  const integrations = await storage.readIntegrations();
  if (integrations.length === 1 && integrations[0].slug === 'teste-storage') {
    console.log('✅ Integração salva e lida corretamente.');
  } else {
    console.error('❌ Falha na leitura/escrita de integrações.');
  }

  // 2. Teste de Concorrência (Leads)
  console.log('\n2️⃣ Testando concorrência (Append Lead)...');
  console.log('   Disparando 5 adições simultâneas...');
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(storage.appendLead({ id: `lead_${i}`, name: `Lead ${i}` }));
  }
  
  await Promise.all(promises);
  
  const leads = await storage.readLeads();
  console.log(`   Leads encontrados: ${leads.length}`);
  
  // Verifica se todos os 5 foram salvos (se não houvesse mutex, poderiam ser menos devido a race condition)
  const testLeads = leads.filter(l => l.id && l.id.startsWith('lead_'));
  if (testLeads.length === 5) {
    console.log('✅ Concorrência tratada com sucesso (5/5 salvos).');
  } else {
    console.error(`❌ Falha na concorrência. Esperado 5, encontrado ${testLeads.length}.`);
  }
}

test();