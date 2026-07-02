# Modelo de Dados Inicial

## Revenda

Representa uma empresa parceira que gerencia clientes.

Campos sugeridos:

- `id`
- `nome`
- `documento`
- `status`
- `criado_em`
- `atualizado_em`

## Cliente

Cliente final vinculado a uma revenda.

Campos sugeridos:

- `id`
- `revenda_id`
- `nome`
- `documento`
- `cidade`
- `uf`
- `status`
- `criado_em`
- `atualizado_em`

## Ambiente TronSoftOS

Instancia monitorada em um cliente.

Campos sugeridos:

- `id`
- `cliente_id`
- `nome`
- `identificador_instalacao`
- `versao_tronsoftos`
- `status`
- `ultima_comunicacao_em`
- `criado_em`
- `atualizado_em`

## Usuario

Pessoa que acessa a Central.

Campos sugeridos:

- `id`
- `revenda_id`
- `nome`
- `email`
- `perfil`
- `status`
- `identity_subject`
- `criado_em`
- `atualizado_em`

## Identidade 0auth

Registro local para vincular a Central ao worker/provedor de identidade.

Campos sugeridos:

- `id`
- `usuario_id`
- `provider`
- `subject`
- `status`
- `ultimo_login_em`
- `sincronizado_em`
- `criado_em`
- `atualizado_em`

## Evento de monitoramento

Evento bruto ou normalizado recebido de um ambiente.

Campos sugeridos:

- `id`
- `ambiente_id`
- `tipo`
- `severidade`
- `payload`
- `recebido_em`
- `processado_em`

## Alerta

Ocorrencia que exige acompanhamento.

Campos sugeridos:

- `id`
- `ambiente_id`
- `evento_origem_id`
- `titulo`
- `descricao`
- `severidade`
- `status`
- `aberto_em`
- `resolvido_em`

