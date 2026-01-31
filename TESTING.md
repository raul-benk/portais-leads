# Roteiro de Validação Manual (Onboarding)

## Pré-requisitos
- Backend e frontend rodando localmente.
- `VITE_INTERNAL_TOKEN` configurado para ações internas (checklist, CRM, healthcheck).
- Credenciais de teste do CRM (Location ID e PIT Token válidos).

## Passo a passo (A–L)

A) Criar integração
- Ação: criar uma nova integração na UI (nome + slug).
- Esperado: status **Em configuração** e checklist 0/8.
- Arquivo: `output/integrations.json` deve conter a integração.

B) Inserir Location ID
- Ação: no item **Subconta criada**, preencher e salvar o Location ID.
- Esperado: item **subconta_criada** como **done** e progresso 1/8.

C) Inserir PIT Token
- Ação: no item **PIT Token inserido**, preencher e salvar o PIT Token.
- Esperado: item **pit_token_inserido** como **done** e progresso 2/8.

D) Marcar Workflow duplicado
- Ação: marcar checkbox **Workflow duplicado**.
- Esperado: item **workflow_duplicado** como **done**.

E) Buscar Workflow ID
- Ação: clicar em **Buscar Workflow ID**.
- Esperado: mensagem de **Concluído** com timestamp.
  - Se encontrado: `crm.workflowIds` preenchido (IDs por nome).
  - Se não encontrado: mensagem de **não encontrado**.

F) Criar Custom Value
- Ação: clicar em **Criar Custom Value**.
- Esperado: item **custom_value_webhook_criado** como **done** e `crm.customWebhookFieldId` preenchido.
- Arquivo: `logs/logs.json` deve registrar a ação (categoria `CHECKLIST`).

G) Marcar DNS
- Ação: marcar checkbox **DNS configurado**.
- Esperado: item **dns_configurado** como **done**.

H) Criar Usuário suporte
- Ação: clicar em **Criar Usuário Suporte**.
- Esperado: item **usuario_suporte_criado** como **done** e `crm.supportUserEmail` preenchido.

I) Rodar Healthcheck
- Ação: clicar em **Rodar Health Check**.
- Esperado: item **webhook_healthcheck** como **done**.
- Arquivo: `logs/logs.json` deve registrar a ação (categoria `CHECKLIST`).

J) Rodar Teste de Integração
- Ação: clicar em **Testar Integração**.
- Esperado: item **webhook_testado** como **done**.
- Arquivos:
  - `logs/webhook-events.json` deve ter um evento com `eventId`.
  - `output/leads.json` deve ter um lead com o mesmo `eventId`.
  - `logs/logs.json` deve registrar o processamento.

K) Simular erro (PIT Token inválido)
- Ação: atualizar o PIT Token com valor inválido.
- Ação: executar **Criar Custom Value** ou **Criar Usuário Suporte**.
- Esperado: item correspondente em **error** e status geral **Erro**.
- Arquivo: `logs/logs.json` deve registrar o erro com `integrationId`.

L) Corrigir token e reprocessar
- Ação: atualizar PIT Token para um valor válido.
- Ação: repetir a operação que falhou (Custom Value / Usuário Suporte).
- Alternativa: reprocessar evento/lead na aba **Eventos** ou **Leads**.
- Esperado: item volta para **done** e status volta para **Em configuração** ou **Ativo** quando todas as etapas estiverem completas.

## Conferências rápidas
- `output/integrations.json`: status e checklist atualizados.
- `logs/webhook-events.json`: eventos do webhook e do teste.
- `output/leads.json`: leads gerados.
- `logs/logs.json`: registros de checklist/CRM/erros.
