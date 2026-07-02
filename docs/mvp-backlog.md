# Backlog do MVP

## Fundacao

- Definir stack principal da Central Web e API.
- Criar padrao de ambientes: desenvolvimento, homologacao e producao.
- Definir banco de dados inicial.
- Definir estrategia de filas para workers.
- Definir contrato de integracao dos agentes TronSoftOS.

## Autenticacao e 0auth

- Criar worker de 0auth.
- Definir protocolo de comunicacao entre API Central e worker de 0auth.
- Criar fluxo de cadastro de usuario da revenda.
- Criar fluxo de login.
- Criar vinculacao entre usuario local e identidade externa.
- Registrar auditoria de login, renovacao e revogacao.

## Revendas e clientes

- Cadastrar revenda.
- Editar dados da revenda.
- Cadastrar cliente vinculado a revenda.
- Editar cliente.
- Ativar/inativar cliente.

## Ambientes monitorados

- Cadastrar ambiente TronSoftOS.
- Gerar identificador de instalacao.
- Registrar ultima comunicacao.
- Exibir versao instalada.
- Exibir status consolidado.

## Monitoramento

- Receber evento de ambiente.
- Persistir evento bruto.
- Normalizar evento.
- Gerar alerta por severidade.
- Listar alertas abertos.
- Resolver alerta.

## Painel

- Exibir total de clientes.
- Exibir ambientes online/offline.
- Exibir alertas criticos.
- Exibir clientes que precisam de atencao.
- Filtrar por revenda, cliente, severidade e status.

