# Contrato de Dados (Schemas JSON)

Este documento define a estrutura final esperada para os arquivos de persistência do sistema.

## 1. Integrações (`output/integrations.json`)
Armazena as configurações de cada cliente (tenant).

```json
[
  {
    "id": "int_<uuid>",
    "name": "Nome do Cliente",
    "slug": "cliente-x",
    "status": "active",
    "createdAt": "2023-10-27T10:00:00Z",
    "credentials": {
      "pitToken": "pit-xxxx (mascarado na UI)",
      "locationId": "loc_xxxx"
    },
    "checklist": [
      { "id": "1", "label": "Integração criada", "checked": true, "status": "Done" }
    ]
  }
]
```

## 2. Eventos de Webhook (`logs/webhook-events.json`)
Log imutável de tudo que chega via webhook, com status de processamento.

```json
[
  {
    "id": "evt_<uuid>",
    "integrationId": "int_<uuid>",
    "integrationSlug": "cliente-x",
    "receivedAt": "2023-10-27T10:00:00Z",
    "headers": {
      "content-type": "application/json"
    },
    "body": { ... }, 
    "status": "received", 
    "error": null
  }
]
```
*Status possíveis*: `received`, `processing`, `processed`, `failed`.

## 3. Leads (`output/leads.json`)
Leads extraídos e normalizados, prontos para envio ao CRM ou já sincronizados.

```json
[
  {
    "id": "lead_<uuid>",
    "integrationId": "int_<uuid>",
    "integrationSlug": "cliente-x",
    "receivedAt": "2023-10-27T10:00:00Z",
    "status": "received",
    "payload": {
      "nome": "Fulano de Tal",
      "telefone": "+5511999999999",
      "email": "fulano@email.com",
      "fonte_do_lead": "Mobiauto",
      "veiculo_interesse": "Fiat Uno",
      "placa": "ABC-1234",
      "preco": "50000"
    },
    "crm": {
      "contactId": "crm_contact_123",
      "opportunityId": "crm_opp_456"
    },
    "error": null
  }
]
```