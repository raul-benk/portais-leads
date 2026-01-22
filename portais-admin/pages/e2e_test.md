# Roteiro de Testes E2E (End-to-End) - Portais Leads MVP

Este documento descreve o fluxo de validação completo do sistema, desde a criação de uma integração até o recebimento e processamento de um lead.

## 1. Pré-requisitos

Certifique-se de que os serviços estão rodando em terminais separados:

**Terminal 1 (Backend):**
```bash
cd /Users/raulbehnke/Documents/portais-leads
node server.js
# Saída esperada: 🚀 Webhook rodando em http://localhost:3434
```

**Terminal 2 (Frontend):**
```bash
cd /Users/raulbehnke/Documents/portais-leads/portais-admin
npm run dev
# Saída esperada: Local: http://localhost:5173/
```

---

## 2. Cenário de Teste: Nova Integração de Cliente

### Passo 1: Criar a Integração (Frontend)
1.  Acesse `http://localhost:5173/integrations` no navegador.
2.  Clique no botão **"Nova Integração"**.
3.  Preencha o formulário:
    *   **Nome do Cliente**: `Concessionária Teste E2E`
    *   **Slug**: `teste-e2e` (deve ser preenchido automaticamente ao digitar o nome)
4.  Clique em **"Criar Integração"**.
5.  **Validação**: Verifique se um novo card apareceu na lista com o status "Active".

### Passo 2: Configurar Credenciais
1.  Clique no card da integração recém-criada.
2.  Vá para a aba **"Credentials"**.
3.  Preencha com dados (podem ser fictícios para teste de fluxo, ou reais para teste completo):
    *   **PIT Token**: `pit-token-teste-123`
    *   **Location ID**: `location-id-teste-456`
4.  Clique em **"Salvar Credenciais"**.
5.  **Validação**: Recarregue a página (F5). Os campos devem permanecer preenchidos (o token aparecerá mascarado `****`).

### Passo 3: Simular Recebimento de Webhook (Backend)
Abra um terceiro terminal para simular o envio de um lead por um portal (ex: Mobiauto).

**Comando CURL:**
```bash
curl -X POST http://localhost:3434/webhook/email/teste-e2e \
  -H "Content-Type: application/json" \
  -d '{
    "customData": {
      "body-mail": "```json\n{\n  \"nome\": \"Cliente Teste E2E\",\n  \"telefone\": \"(11) 99999-8888\",\n  \"email\": \"cliente@teste.com\",\n  \"fonte_do_lead\": \"Mobiauto\",\n  \"veiculo_interesse\": \"Fiat Uno 2020\",\n  \"preco\": \"45.000\"\n}\n```"
    }
  }'
```

**Validação no Terminal do Backend:**
*   Deve exibir: `📩 Webhook recebido para teste-e2e e salvo com sucesso`
*   Deve exibir: `✅ Dados processados do webhook: ...`
*   Se as credenciais forem falsas, exibirá erro do CRM (401), mas o lead será salvo como `failed`.

### Passo 4: Verificar Processamento (Frontend)
1.  No painel admin, vá para a aba **"Leads"** dentro dos detalhes da integração (ou no Dashboard principal).
2.  **Validação**: O lead "Cliente Teste E2E" deve aparecer na lista.
    *   **Status**: `Error` (se usou credenciais falsas) ou `Synced` (se usou reais).

---

## 3. Rollback (Recuperação)

Caso seja necessário reverter o sistema para um estado anterior:

1.  Pare o servidor (`Ctrl+C`).
2.  Copie os arquivos do backup mais recente em `data/backups/` para a pasta `output/` e `logs/`.
    ```bash
    # Exemplo
    cp data/backups/20260122_XXXXXX/leads.json output/
    ```
3.  Reinicie o servidor.