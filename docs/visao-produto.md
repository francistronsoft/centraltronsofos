# Visao do Produto

## Proposito

A Central TronSoftOS sera uma plataforma de monitoramento para revendas acompanharem varios clientes que utilizam o TronSoftOS.

O foco inicial e dar visibilidade operacional: quais clientes estao ativos, quais ambientes precisam de atencao, qual versao esta instalada e quais alertas exigem acao.

## Publicos

- **Revenda**: cadastra e acompanha sua carteira de clientes.
- **Operador da revenda**: monitora alertas e abre tratativas.
- **Administrador TronSoft**: enxerga revendas, clientes e saude geral da rede.
- **Cliente final**: aparece como entidade monitorada, sem necessariamente acessar a Central no MVP.

## Problemas que resolve

- Revendas nao tem uma visao consolidada de todos os clientes com TronSoftOS.
- Alertas podem se perder em canais dispersos.
- Atualizacoes, integracoes e incidentes ficam dificeis de priorizar.
- A autenticacao/autorizacao precisa ser isolada e auditavel por meio do worker de 0auth.

## MVP

O MVP deve permitir:

- Cadastro de revendas.
- Cadastro de clientes por revenda.
- Cadastro de ambientes TronSoftOS vinculados a clientes.
- Painel de status por cliente.
- Registro de eventos e alertas.
- Autenticacao inicial com apoio do worker de 0auth.
- Historico minimo de sincronizacao e auditoria.

