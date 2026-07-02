# Deploy em Debian via SSH

Este guia instala a Central TronSoftOS como servico `systemd` em um servidor Debian.

## O que ja existe

- Frontend simples servido pelo proprio Node em `/`.
- API de ingestao em `/api/tronsoftos/*`.
- Banco local em arquivo JSON dentro de `data/central-db.json`.

Importante: o banco JSON e suficiente para teste/piloto. Para producao, o proximo passo recomendado e trocar esse armazenamento por PostgreSQL.

## Requisitos

- Debian com acesso SSH.
- Node.js 20 ou superior.
- Usuario Linux dedicado para rodar a aplicacao.
- Porta liberada no firewall, ou Nginx fazendo proxy.

## Instalacao automatica

No servidor Debian 13:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone URL_DO_REPOSITORIO central-tronsoftos
cd central-tronsoftos
bash install.sh
```

Padroes do instalador:

- app em `/opt/central-tronsoftos/app`;
- usuario de servico `central-tronsoftos`;
- ambiente em `/etc/central-tronsoftos/central.env`;
- servico `central-tronsoftos.service`;
- porta `3080`;
- dominio Nginx `central.tronsoft.app.br`.

Instalacao sem perguntas:

```bash
CENTRAL_TRONSOFTOS_SETUP_NGINX=yes \
CENTRAL_TRONSOFTOS_DOMAIN=central.tronsoft.app.br \
CENTRAL_TRONSOFTOS_PORT=3080 \
bash install.sh
```

Comandos uteis:

```bash
sudo systemctl status central-tronsoftos
sudo journalctl -u central-tronsoftos -f
curl http://127.0.0.1:3080/health
```

## Cloudflare Tunnel

Se voce ja usa Cloudflare Tunnel para `central.tronsoft.app.br`, o tunnel pode apontar direto para:

```text
http://127.0.0.1:3080
```

Nesse caso, responda `n` quando o instalador perguntar sobre Nginx, ou rode:

```bash
CENTRAL_TRONSOFTOS_SETUP_NGINX=no bash install.sh
```

Se preferir usar Nginx como intermediario local, deixe o instalador configurar Nginx e aponte o tunnel para:

```text
http://127.0.0.1:80
```

## Instalacao manual

## 1. Acessar o servidor

```bash
ssh usuario@ip-do-servidor
```

## 2. Instalar Node.js

Se o Node.js ainda nao estiver instalado, instale uma versao LTS recente. Exemplo usando NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

## 3. Criar usuario da aplicacao

```bash
sudo adduser --system --group --home /opt/central-tronsoftos central-tronsoftos
```

## 4. Enviar o projeto para o servidor

No seu computador, dentro da pasta do projeto:

```bash
scp -r . usuario@ip-do-servidor:/tmp/central-tronsoftos
```

No servidor:

```bash
sudo mkdir -p /opt/central-tronsoftos/app
sudo cp -r /tmp/central-tronsoftos/* /opt/central-tronsoftos/app/
sudo chown -R central-tronsoftos:central-tronsoftos /opt/central-tronsoftos
```

## 5. Criar arquivo de ambiente

```bash
sudo cp /opt/central-tronsoftos/app/.env.example /opt/central-tronsoftos/app/.env
sudo nano /opt/central-tronsoftos/app/.env
```

Conteudo inicial:

```text
PORT=3080
```

## 6. Criar servico systemd

```bash
sudo nano /etc/systemd/system/central-tronsoftos.service
```

Conteudo:

```ini
[Unit]
Description=Central TronSoftOS
After=network.target

[Service]
Type=simple
User=central-tronsoftos
Group=central-tronsoftos
WorkingDirectory=/opt/central-tronsoftos/app
EnvironmentFile=/opt/central-tronsoftos/app/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ativar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable central-tronsoftos
sudo systemctl start central-tronsoftos
sudo systemctl status central-tronsoftos
```

## 7. Testar localmente no servidor

```bash
curl http://localhost:3080/health
```

Resposta esperada:

```json
{
  "ok": true,
  "service": "central-tronsoftos"
}
```

## 8. Expor com Nginx

Instalar:

```bash
sudo apt-get install -y nginx
```

Criar site:

```bash
sudo nano /etc/nginx/sites-available/central-tronsoftos
```

Conteudo:

```nginx
server {
    listen 80;
    server_name central.seudominio.com.br;

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar:

```bash
sudo ln -s /etc/nginx/sites-available/central-tronsoftos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. HTTPS

Depois do DNS apontar para o servidor, use Certbot:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d central.seudominio.com.br
```

## Rotas principais

- Frontend: `http://servidor:3080/`
- Saude: `GET /health`
- Identificacao: `POST /api/tronsoftos/identify`
- Heartbeat: `POST /api/tronsoftos/heartbeat`
- Alertas: `POST /api/tronsoftos/alerts`

## Observacoes para piloto

- Faça backup do arquivo `data/central-db.json`.
- Mantenha a porta `3080` fechada externamente se estiver usando Nginx.
- Use HTTPS antes de enviar tokens de instalacao pela internet.
- Para producao, migrar dados para PostgreSQL e adicionar autenticacao administrativa.
