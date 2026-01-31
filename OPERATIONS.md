# Playbooks Operacionais

## Testes de Onboarding
1. Inserir `locationId` e `pitToken` via endpoint interno.
2. Marcar manualmente **workflow_duplicado** no checklist.
3. Executar **identify-workflow** para buscar os `workflowIds`.
4. Executar **create-webhook-value** para criar o custom value.
5. Marcar **dns_configurado** no checklist.
6. Executar **create-support-user** para criar o usuário de suporte.
7. Executar **webhook healthcheck** (endpoint interno).
8. Executar **testIntegration** e validar o checklist.

## Checklist incompleto
1. Abra a integração e vá até a aba **Checklist**.
2. Verifique itens em **pending** e **error**.
3. Para itens manuais, confirme a etapa concluída com o cliente e marque como **concluída** com uma nota curta.
4. Para itens automáticos, revise os dados de CRM (locationId, pitToken, workflowIds) e refaça a automação se necessário.
5. Recarregue a integração e valide se o status evoluiu para **active**.

## Webhook falhou
1. Abra a integração e vá até a aba **Eventos**.
2. Filtre por **failed** e abra o erro mostrado.
3. Consulte a aba **Logs** para encontrar o eventId e detalhes técnicos.
4. Corrija o problema (payload inválido, CRM indisponível, etc.).
5. Use **Reprocessar Evento** e confirme a nova execução.

## CRM fora do ar
1. Suspenda reprocessamentos manuais até o CRM estabilizar.
2. Registre o incidente em um canal interno e acompanhe o status do CRM.
3. Quando o CRM voltar, reprocessar eventos e leads com status **failed**.
4. Verifique se o checklist automático foi atualizado após a recuperação.

## Lead em failed
1. Abra a integração e vá até a aba **Leads**.
2. Filtre por **failed** e leia o erro informado.
3. Corrija o motivo (ex: campo obrigatório ausente, CRM indisponível).
4. Use **Reprocessar Lead** para reenviar apenas ao CRM.
5. Confirme que o status mudou para **sent** e que não houve duplicação.
