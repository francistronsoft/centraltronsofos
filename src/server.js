import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readDb, storageInfo, writeDb } from "./storage.js";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prototypeDir = join(rootDir, "prototype");
const port = Number(process.env.PORT || 3080);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(status) {
  const allowed = new Set(["online", "warning", "offline", "unknown"]);
  return allowed.has(status) ? status : "unknown";
}

function normalizeSeverity(severity) {
  const allowed = new Set(["info", "warning", "critical"]);
  return allowed.has(severity) ? severity : "info";
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function clientKey(customer) {
  return customer?.document || toSlug(customer?.name);
}

function generatePairingToken() {
  return `cts_${randomUUID().replace(/-/g, "")}`;
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "JSON invalido.");
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-installation-token"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function requireText(value, field) {
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw httpError(400, `Campo obrigatorio ausente: ${field}.`);
  }

  return value.trim();
}

function findOrCreateReseller(db, resellerPayload) {
  const name = resellerPayload?.name?.trim() || "TronSoftOS Direto";
  const document = resellerPayload?.document?.trim() || "";
  const existing = db.resellers.find((reseller) => {
    return document ? reseller.document === document : reseller.name.toLowerCase() === name.toLowerCase();
  });

  if (existing) {
    existing.name = name;
    existing.document = document;
    existing.updatedAt = nowIso();
    return existing;
  }

  const reseller = {
    id: randomUUID(),
    name,
    document,
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  db.resellers.push(reseller);
  return reseller;
}

function findOrCreateClient(db, reseller, customerPayload) {
  const customerName = requireText(customerPayload?.name, "customer.name");
  const key = clientKey(customerPayload);
  const existing = db.clients.find((client) => {
    return client.resellerId === reseller.id && (client.document === customerPayload?.document || client.key === key);
  });

  if (existing) {
    existing.name = customerName;
    existing.document = customerPayload?.document || "";
    existing.city = customerPayload?.city || "";
    existing.state = customerPayload?.state || "";
    existing.status = "active";
    existing.updatedAt = nowIso();
    return existing;
  }

  const client = {
    id: randomUUID(),
    resellerId: reseller.id,
    key,
    name: customerName,
    document: customerPayload?.document || "",
    city: customerPayload?.city || "",
    state: customerPayload?.state || "",
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  db.clients.push(client);
  return client;
}

function upsertInstallation(db, client, payload) {
  const installationId = payload.installationId?.trim() || randomUUID();
  const existing = db.installations.find((installation) => installation.installationId === installationId);
  const token = existing?.token || randomUUID();

  const installation = {
    id: existing?.id || randomUUID(),
    clientId: client.id,
    installationId,
    token,
    name: payload.environment?.name || payload.host?.hostname || "Ambiente principal",
    status: normalizeStatus(payload.status || "online"),
    tronsoftos: {
      version: payload.tronsoftos?.version || "",
      build: payload.tronsoftos?.build || "",
      channel: payload.tronsoftos?.channel || ""
    },
    database: {
      engine: payload.database?.engine || "",
      version: payload.database?.version || "",
      schemaVersion: payload.database?.schemaVersion || "",
      sizeMb: payload.database?.sizeMb ?? null
    },
    host: {
      hostname: payload.host?.hostname || "",
      os: payload.host?.os || "",
      ip: payload.host?.ip || ""
    },
    lastSeenAt: nowIso(),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso()
  };

  if (existing) {
    Object.assign(existing, installation);
    return existing;
  }

  db.installations.push(installation);
  return installation;
}

function upsertInstallationForClient(db, client, payload) {
  const installationId = payload.installationId?.trim() || randomUUID();
  const existing = db.installations.find((installation) => installation.installationId === installationId);
  const token = existing?.token || randomUUID();

  const installation = {
    id: existing?.id || randomUUID(),
    clientId: client.id,
    installationId,
    token,
    name: payload.environment?.name || payload.host?.hostname || "Ambiente principal",
    status: normalizeStatus(payload.status || "online"),
    tronsoftos: {
      version: payload.tronsoftos?.version || "",
      build: payload.tronsoftos?.build || "",
      channel: payload.tronsoftos?.channel || ""
    },
    database: {
      engine: payload.database?.engine || "",
      version: payload.database?.version || "",
      schemaVersion: payload.database?.schemaVersion || "",
      sizeMb: payload.database?.sizeMb ?? null
    },
    host: {
      hostname: payload.host?.hostname || "",
      os: payload.host?.os || "",
      ip: payload.host?.ip || ""
    },
    lastSeenAt: nowIso(),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso()
  };

  if (existing) {
    Object.assign(existing, installation);
    return existing;
  }

  db.installations.push(installation);
  return installation;
}

function findInstallationByRequest(db, payload, request) {
  const token = request.headers["x-installation-token"];
  const installationId = payload.installationId;

  const installation = db.installations.find((item) => {
    return (token && item.token === token) || (installationId && item.installationId === installationId);
  });

  if (!installation) {
    throw httpError(404, "Instalacao TronSoftOS nao encontrada. Envie primeiro /api/tronsoftos/identify.");
  }

  return installation;
}

function addEvent(db, type, installation, payload) {
  const event = {
    id: randomUUID(),
    installationId: installation.installationId,
    type,
    payload,
    receivedAt: nowIso()
  };
  db.events.push(event);
  return event;
}

function publicPairingToken(token) {
  return {
    id: token.id,
    clientId: token.clientId,
    token: token.token,
    status: token.status,
    installationId: token.installationId || null,
    createdAt: token.createdAt,
    usedAt: token.usedAt || null,
    revokedAt: token.revokedAt || null
  };
}

function publicInstallation(db, installation) {
  const client = db.clients.find((item) => item.id === installation.clientId);
  const reseller = db.resellers.find((item) => item.id === client?.resellerId);

  return {
    id: installation.id,
    installationId: installation.installationId,
    name: installation.name,
    status: installation.status,
    lastSeenAt: installation.lastSeenAt,
    tronsoftos: installation.tronsoftos,
    database: installation.database,
    host: installation.host,
    client,
    reseller
  };
}

function dashboard(db) {
  const criticalAlerts = db.alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").length;
  const online = db.installations.filter((installation) => installation.status === "online").length;
  const warning = db.installations.filter((installation) => installation.status === "warning").length;
  const offline = db.installations.filter((installation) => installation.status === "offline").length;

  return {
    resellers: db.resellers.length,
    clients: db.clients.length,
    installations: db.installations.length,
    online,
    warning,
    offline,
    criticalAlerts,
    updatedAt: nowIso()
  };
}

async function handleIdentify(request, response) {
  const payload = await readJson(request);
  const db = await readDb();
  const reseller = findOrCreateReseller(db, payload.reseller);
  const client = findOrCreateClient(db, reseller, payload.customer);
  const installation = upsertInstallation(db, client, payload);
  addEvent(db, "identify", installation, payload);
  await writeDb(db);

  sendJson(response, 201, {
    installationId: installation.installationId,
    installationToken: installation.token,
    clientId: client.id,
    resellerId: reseller.id,
    status: installation.status
  });
}

async function handleCreateClient(request, response) {
  const payload = await readJson(request);
  const db = await readDb();
  const reseller = findOrCreateReseller(db, payload.reseller);
  const client = findOrCreateClient(db, reseller, payload.customer);
  const token = {
    id: randomUUID(),
    clientId: client.id,
    token: generatePairingToken(),
    status: "active",
    createdAt: nowIso(),
    usedAt: null,
    revokedAt: null,
    installationId: null
  };

  db.pairingTokens.push(token);
  await writeDb(db);

  sendJson(response, 201, {
    reseller,
    client,
    pairingToken: publicPairingToken(token)
  });
}

async function handlePairTronsoftos(request, response) {
  const payload = await readJson(request);
  const pairingToken = requireText(payload.pairingToken, "pairingToken");
  const db = await readDb();
  const token = db.pairingTokens.find((item) => item.token === pairingToken);

  if (!token || token.status !== "active") {
    throw httpError(401, "Token da Central invalido ou inativo.");
  }

  const client = db.clients.find((item) => item.id === token.clientId);
  if (!client) {
    throw httpError(404, "Cliente vinculado ao token nao encontrado.");
  }

  const installation = upsertInstallationForClient(db, client, payload);
  token.usedAt = token.usedAt || nowIso();
  token.installationId = installation.installationId;
  addEvent(db, "pair", installation, { ...payload, pairingToken: "***" });
  await writeDb(db);

  sendJson(response, 200, {
    ok: true,
    installationId: installation.installationId,
    installationToken: installation.token,
    clientId: client.id,
    status: installation.status,
    message: "TronSoftOS vinculado com sucesso."
  });
}

async function handleHeartbeat(request, response) {
  const payload = await readJson(request);
  const db = await readDb();
  const installation = findInstallationByRequest(db, payload, request);

  installation.status = normalizeStatus(payload.status || "online");
  installation.tronsoftos = { ...installation.tronsoftos, ...payload.tronsoftos };
  installation.database = { ...installation.database, ...payload.database };
  installation.host = { ...installation.host, ...payload.host };
  installation.lastSeenAt = nowIso();
  installation.updatedAt = nowIso();

  addEvent(db, "heartbeat", installation, payload);
  await writeDb(db);

  sendJson(response, 200, {
    ok: true,
    installationId: installation.installationId,
    status: installation.status,
    lastSeenAt: installation.lastSeenAt
  });
}

async function handleAlert(request, response) {
  const payload = await readJson(request);
  const db = await readDb();
  const installation = findInstallationByRequest(db, payload, request);
  const title = requireText(payload.title, "title");
  const severity = normalizeSeverity(payload.severity || "info");

  const alert = {
    id: randomUUID(),
    installationId: installation.installationId,
    clientId: installation.clientId,
    title,
    message: payload.message || "",
    code: payload.code || "",
    severity,
    status: "open",
    details: payload.details || {},
    openedAt: nowIso(),
    resolvedAt: null
  };

  db.alerts.push(alert);
  addEvent(db, "alert", installation, payload);

  if (severity === "critical") {
    installation.status = "warning";
    installation.updatedAt = nowIso();
  }

  await writeDb(db);
  sendJson(response, 201, alert);
}

async function handleApi(request, response, pathname) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "central-tronsoftos", storage: storageInfo(), checkedAt: nowIso() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/tronsoftos/identify") {
    await handleIdentify(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/api/tronsoftos/pair") {
    await handlePairTronsoftos(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/clients") {
    await handleCreateClient(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/api/tronsoftos/heartbeat") {
    await handleHeartbeat(request, response);
    return;
  }

  if (request.method === "POST" && ["/api/tronsoftos/alerts", "/api/tronsoftos/notifications"].includes(pathname)) {
    await handleAlert(request, response);
    return;
  }

  const db = await readDb();

  if (request.method === "GET" && pathname === "/api/dashboard") {
    sendJson(response, 200, dashboard(db));
    return;
  }

  if (request.method === "GET" && pathname === "/api/clients") {
    sendJson(response, 200, db.clients.map((client) => ({
      ...client,
      reseller: db.resellers.find((reseller) => reseller.id === client.resellerId) || null,
      pairingTokens: db.pairingTokens.filter((token) => token.clientId === client.id).map(publicPairingToken)
    })));
    return;
  }

  if (request.method === "GET" && pathname === "/api/installations") {
    sendJson(response, 200, db.installations.map((installation) => publicInstallation(db, installation)));
    return;
  }

  if (request.method === "GET" && pathname === "/api/alerts") {
    sendJson(response, 200, db.alerts);
    return;
  }

  throw httpError(404, "Rota nao encontrada.");
}

async function serveStatic(request, response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = normalize(join(prototypeDir, relativePath));

  if (!filePath.startsWith(prototypeDir)) {
    throw httpError(403, "Acesso negado.");
  }

  try {
    await stat(filePath);
  } catch {
    throw httpError(404, "Arquivo nao encontrado.");
  }

  const extension = extname(filePath);
  response.writeHead(200, {
    "content-type": contentTypes[extension] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  try {
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url.pathname);
      return;
    }

    await serveStatic(request, response, decodeURIComponent(url.pathname));
  } catch (error) {
    sendJson(response, error.status || 500, {
      error: error.message || "Erro interno."
    });
  }
});

server.listen(port, () => {
  console.log(`Central TronSoftOS rodando em http://localhost:${port}`);
});
