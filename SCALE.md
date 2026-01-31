Pontos de Escala Planejados

1) Entrada de Fila (antes do pipeline)
- O ponto de entrada ideal para fila é imediatamente antes de `processEventPipeline`.
- `processWebhook` e `reprocessEvent` devem enfileirar o evento e apenas registrar/ack.

2) Substituição de Persistência (JSON -> DB)
- `repositories/json-repository.js` é o único adaptador de I/O.
- Substituir por um repositório de banco mantendo as mesmas interfaces:
  - EventRepository
  - LeadRepository
  - IntegrationRepository
  - LogRepository

3) Paralelismo e Lock
- Ao processar eventos em paralelo, garantir lock por `integrationId` para evitar race.
- Atualizações de checklist e status precisam de exclusão mútua.

4) Idempotência Crítica
- `eventId` deve ser preservado em reprocessamentos.
- `canReprocessEvent` e `canReprocessLead` bloqueiam duplicidade.
- Processamento de CRM deve ser idempotente para evitar contatos duplicados.

5) Observabilidade e Auditoria
- Logs estruturados já incluem `eventId`.
- Em escala, considerar indexação/streaming para auditoria.
