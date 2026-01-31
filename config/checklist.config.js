module.exports = [
  {
    key: 'subconta_criada',
    label: 'Subconta criada',
    type: 'manual',
    required: true
  },
  {
    key: 'pit_token_inserido',
    label: 'PIT Token inserido',
    type: 'manual',
    required: true
  },
  {
    key: 'workflow_duplicado',
    label: 'Workflow duplicado',
    type: 'manual',
    required: true
  },
  {
    key: 'custom_value_webhook_criado',
    label: 'Custom Value Webhook criado',
    type: 'auto',
    required: true,
    dependsOn: ['subconta_criada', 'pit_token_inserido']
  },
  {
    key: 'dns_configurado',
    label: 'DNS configurado',
    type: 'manual',
    required: true
  },
  {
    key: 'usuario_suporte_criado',
    label: 'Usuario de suporte criado',
    type: 'auto',
    required: true,
    dependsOn: ['subconta_criada', 'pit_token_inserido', 'dns_configurado']
  },
  {
    key: 'webhook_healthcheck',
    label: 'Webhook healthcheck',
    type: 'auto',
    required: true,
    dependsOn: ['subconta_criada']
  },
  {
    key: 'webhook_testado',
    label: 'Webhook testado',
    type: 'auto',
    required: true,
    dependsOn: ['webhook_healthcheck']
  }
];
