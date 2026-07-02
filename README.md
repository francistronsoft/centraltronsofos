# Central TronSoftOS

Sistema centralizado para revendas monitorarem clientes que utilizam o TronSoftOS.

## Objetivo

A Central TronSoftOS nasce como um sistema separado do TronSoftOS principal. Ela permite que revendas cadastrem clientes, acompanhem ambientes ativos, monitorem saude operacional e recebam alertas de eventos relevantes.

## Componentes iniciais

- **Central Web**: interface para revendas, operadores e administradores.
- **API Central**: camada de negocio, cadastro, permissoes, relatorios e integracoes.
- **Worker de 0auth**: servico separado para rotinas de autenticacao/autorizacao, sincronizacao de credenciais, renovacao de tokens e eventos de identidade.
- **Agentes TronSoftOS**: clientes monitorados enviam sinais de saude, versao, status e eventos.

## Como executar agora

```bash
npm run dev
```

No PowerShell, se a politica de execucao bloquear o `npm.ps1`, use:

```bash
node src/server.js
```

Depois acesse:

```text
http://localhost:3080
```

## Deploy em Debian

Instalador para Debian 13 via SSH:

```bash
git clone URL_DO_REPOSITORIO central-tronsoftos
cd central-tronsoftos
bash install.sh
```

Guia detalhado com `systemd` e Nginx: `docs/deploy-debian.md`.

## API inicial

A primeira implementacao recebe:

- cadastro de cliente na Central com geracao de token de pareamento;
- validacao do token informado no frontend do TronSoftOS;
- identificacao do cliente que utiliza TronSoftOS;
- versao do TronSoftOS;
- engine, versao e schema do banco usado pelo cliente;
- heartbeats de saude;
- notificacoes e alertas.

Contrato detalhado: `docs/api-ingestao.md`.

## Primeiras entidades

- Revenda
- Cliente
- Ambiente TronSoftOS
- Usuario
- Alerta
- Evento de monitoramento
- Credencial/identidade 0auth

## Estrutura do repositorio

```text
docs/
  api-ingestao.md
  arquitetura.md
  modelo-dados.md
  mvp-backlog.md
  visao-produto.md
install.sh
prototype/
  index.html
  styles.css
  app.js
src/
  server.js
```

## Prototipo

Abra `prototype/index.html` no navegador para visualizar o rascunho estatico, ou rode `npm run dev` para abrir a Central consumindo a API local.
