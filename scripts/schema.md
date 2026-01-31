# Contrato de Dados (Schemas JSON)

Este documento define a estrutura final esperada para os arquivos de persistência do sistema.

## 1. Integrações (`output/integrations.json`)
Armazena as configurações de cada cliente (tenant) com foco no onboarding e dados de CRM.

```json
[
  {
    "id": "int_<uuid>",
    "name": "Nome do Cliente",
    "slug": "cliente-x",
    "status": "draft",
    "crm": {
      "locationId": "loc_xxxx",
      "pitToken": "pit-xxxx",
      "workflowId": "wf_xxxx",
      "workflowIds": {
        "1.1 Cria Oportunidade > Portais": "wf_portais",
        "RECEBIMENTO DE LEADS (PORTAIS)": "wf_recebimento"
      },
      "customWebhookFieldId": "fld_xxxx",
      "supportUserEmail": "suporte+cliente-x@dominio.com"
    },
    "checklist": [
      {
        "key": "subconta_criada",
        "label": "Subconta criada",
        "type": "manual",
        "required": true,
        "dependsOn": [],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      },
      {
        "key": "pit_token_inserido",
        "label": "PIT Token inserido",
        "type": "manual",
        "required": true,
        "dependsOn": [],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      },
      {
        "key": "workflow_duplicado",
        "label": "Workflow duplicado",
        "type": "manual",
        "required": true,
        "dependsOn": [],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      },
      {
        "key": "custom_value_webhook_criado",
        "label": "Custom Value Webhook criado",
        "type": "auto",
        "required": true,
        "dependsOn": ["subconta_criada", "pit_token_inserido"],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      },
      {
        "key": "dns_configurado",
        "label": "DNS configurado",
        "type": "manual",
        "required": true,
        "dependsOn": [],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      },
      {
        "key": "usuario_suporte_criado",
        "label": "Usuario de suporte criado",
        "type": "auto",
        "required": true,
        "dependsOn": ["subconta_criada", "pit_token_inserido", "dns_configurado"],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      },
      {
        "key": "webhook_healthcheck",
        "label": "Webhook healthcheck",
        "type": "auto",
        "required": true,
        "dependsOn": ["subconta_criada"],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      },
      {
        "key": "webhook_testado",
        "label": "Webhook testado",
        "type": "auto",
        "required": true,
        "dependsOn": ["webhook_healthcheck"],
        "status": "pending",
        "notes": "",
        "validatedAt": null,
        "validatedBy": null
      }
    ],
    "createdAt": "2023-10-27T10:00:00Z",
    "updatedAt": "2023-10-27T10:00:00Z"
  }
]
```
*Status possíveis*: `draft`, `onboarding`, `active`, `error`.

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
