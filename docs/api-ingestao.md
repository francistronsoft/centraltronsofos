# API de Ingestao TronSoftOS

Esta API recebe a identificacao da instalacao TronSoftOS, atualizacoes de saude e alertas/notificacoes.

## Subir servidor local

```bash
npm run dev
```

No PowerShell, se `npm.ps1` estiver bloqueado pela politica de execucao:

```bash
node src/server.js
```

Endereco padrao:

```text
http://localhost:3080
```

## Fluxo oficial de pareamento

1. A revenda cadastra o cliente na Central.
2. A Central gera um token de pareamento.
3. O tecnico abre o TronSoftOS do cliente em Manutencao > Ajustes > Central TronSoftOS.
4. O tecnico informa a URL `https://central.tronsoft.app.br` e cola o token.
5. O TronSoftOS valida o token na Central e recebe um token interno de instalacao.
6. A partir dai, o TronSoftOS envia heartbeats e alertas automaticamente.

## Cadastrar cliente e gerar token

`POST /api/admin/clients`

```json
{
  "reseller": {
    "name": "Alpha Sistemas",
    "document": "00000000000100"
  },
  "customer": {
    "name": "Mercado Sol Nascente",
    "document": "11111111000199",
    "city": "Sao Paulo",
    "state": "SP"
  }
}
```

Resposta:

```json
{
  "client": {
    "id": "id-do-cliente",
    "name": "Mercado Sol Nascente"
  },
  "pairingToken": {
    "token": "cts_token_de_pareamento"
  }
}
```

Esse `pairingToken.token` e o valor que o tecnico informa no frontend do TronSoftOS.

## Validar token pelo TronSoftOS

`POST /api/tronsoftos/pair`

Usado pelo backend do TronSoftOS depois que o tecnico informa o token na guia Manutencao.

```json
{
  "pairingToken": "cts_token_de_pareamento",
  "installationId": "cliente-001-matriz",
  "environment": {
    "name": "Matriz"
  },
  "tronsoftos": {
    "version": "2026.7.0",
    "build": "1250",
    "channel": "stable"
  },
  "database": {
    "engine": "Firebird",
    "version": "2.5",
    "schemaVersion": "2026.07.001"
  },
  "host": {
    "hostname": "srv-mercado-01",
    "os": "Linux 6.x",
    "ip": "192.168.0.10"
  }
}
```

Resposta:

```json
{
  "ok": true,
  "installationId": "cliente-001-matriz",
  "installationToken": "token-da-instalacao",
  "clientId": "id-do-cliente",
  "status": "online"
}
```

O TronSoftOS guarda o `installationToken` para chamadas futuras.

## Identificar instalacao legado

`POST /api/tronsoftos/identify`

Fluxo antigo em que o TronSoftOS se apresenta criando cliente automaticamente. O fluxo recomendado agora e o pareamento com token gerado na Central.

```json
{
  "installationId": "cliente-001-matriz",
  "reseller": {
    "name": "Alpha Sistemas",
    "document": "00000000000100"
  },
  "customer": {
    "name": "Mercado Sol Nascente",
    "document": "11111111000199",
    "city": "Sao Paulo",
    "state": "SP"
  },
  "environment": {
    "name": "Matriz"
  },
  "tronsoftos": {
    "version": "2026.7.0",
    "build": "1250",
    "channel": "stable"
  },
  "database": {
    "engine": "PostgreSQL",
    "version": "16.3",
    "schemaVersion": "2026.07.001",
    "sizeMb": 842
  },
  "host": {
    "hostname": "srv-mercado-01",
    "os": "Windows Server 2022",
    "ip": "192.168.0.10"
  }
}
```

Resposta:

```json
{
  "installationId": "cliente-001-matriz",
  "installationToken": "token-gerado",
  "clientId": "id-do-cliente",
  "resellerId": "id-da-revenda",
  "status": "online"
}
```

Guarde o `installationToken` no TronSoftOS para chamadas futuras.

## Enviar heartbeat

`POST /api/tronsoftos/heartbeat`

Headers:

```text
x-installation-token: token-gerado
```

Payload:

```json
{
  "status": "online",
  "tronsoftos": {
    "version": "2026.7.1"
  },
  "database": {
    "engine": "PostgreSQL",
    "version": "16.3",
    "schemaVersion": "2026.07.002"
  }
}
```

## Enviar alerta/notificacao

`POST /api/tronsoftos/alerts`

Headers:

```text
x-installation-token: token-gerado
```

Payload:

```json
{
  "severity": "critical",
  "title": "Backup nao executado",
  "message": "O ultimo backup valido tem mais de 24 horas.",
  "code": "BACKUP_STALE",
  "details": {
    "lastBackupAt": "2026-07-02T08:00:00.000Z"
  }
}
```

Se preferir chamar o mesmo fluxo como notificacao, tambem existe:

```text
POST /api/tronsoftos/notifications
```

## Consultas da Central

- `GET /health`
- `GET /api/dashboard`
- `GET /api/clients`
- `GET /api/installations`
- `GET /api/alerts`
