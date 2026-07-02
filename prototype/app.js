const statusLabels = {
  online: "Online",
  warning: "Atencao",
  offline: "Offline",
  unknown: "Desconhecido"
};

let currentUser = null;
let currentClients = [];
let currentAuthEvents = [];
let currentResellers = [];

function selectedResellerId() {
  return document.querySelector("#reseller-filter").value || "";
}

function querySuffix() {
  const resellerId = selectedResellerId();
  return resellerId ? `?resellerId=${encodeURIComponent(resellerId)}` : "";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function showLogin() {
  document.querySelector("#login-view").hidden = false;
  document.querySelector("#app-shell").hidden = true;
}

function showApp() {
  document.querySelector("#login-view").hidden = true;
  document.querySelector("#app-shell").hidden = false;
}

async function loadSession() {
  try {
    const payload = await api("/api/auth/me");
    currentUser = payload.user;
    showApp();
    await configureScopeControls();
    await loadCentralData();
  } catch {
    showLogin();
  }
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const error = document.querySelector("#login-error");
  error.textContent = "";

  try {
    const payload = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: data.get("email"),
        password: data.get("password")
      })
    });
    currentUser = payload.user;
    showApp();
    await configureScopeControls();
    await loadCentralData();
  } catch (err) {
    error.textContent = err.message;
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  currentUser = null;
  showLogin();
}

async function configureScopeControls() {
  document.querySelector("#user-badge").textContent = `${currentUser.name} (${currentUser.role === "tronsoft_admin" ? "TronSoft" : "Revenda"})`;
  document.querySelector("#scope-label").textContent = currentUser.role === "tronsoft_admin"
    ? "Painel TronSoft com todos os clientes e filtro por revenda."
    : "Painel da revenda com apenas seus clientes TronSoftOS.";

  currentResellers = await api("/api/resellers");
  const filter = document.querySelector("#reseller-filter");
  const clientResellerSelect = document.querySelector("#client-reseller-select");
  const resellerNameInput = document.querySelector("#reseller-name-input");
  const resellerDocumentInput = document.querySelector("#reseller-document-input");

  filter.innerHTML = `<option value="">Todas as revendas</option>${currentResellers
    .map((reseller) => `<option value="${reseller.id}">${reseller.name}</option>`)
    .join("")}`;
  clientResellerSelect.innerHTML = currentResellers
    .map((reseller) => `<option value="${reseller.id}">${reseller.name}</option>`)
    .join("");

  const tronsoft = currentUser.role === "tronsoft_admin";
  filter.hidden = !tronsoft;
  clientResellerSelect.hidden = !tronsoft;
  resellerNameInput.hidden = tronsoft;
  resellerDocumentInput.hidden = tronsoft;
  resellerNameInput.required = !tronsoft;

  if (!tronsoft && currentResellers[0]) {
    resellerNameInput.value = currentResellers[0].name;
    resellerDocumentInput.value = currentResellers[0].document || "";
  }
}

async function loadCentralData() {
  const [dashboard, installations, alerts] = await Promise.all([
    api(`/api/dashboard${querySuffix()}`),
    api(`/api/installations${querySuffix()}`),
    api(`/api/alerts${querySuffix()}`)
  ]);

  currentClients = installations.map((installation) => ({
    name: installation.client?.name || "Cliente nao identificado",
    reseller: installation.reseller?.name || "Sem revenda",
    environment: installation.name,
    version: installation.tronsoftos?.version || "-",
    database: [
      installation.database?.engine,
      installation.database?.version,
      installation.database?.schemaVersion
    ]
      .filter(Boolean)
      .join(" / ") || "-",
    status: installation.status,
    lastSeen: installation.lastSeenAt ? new Date(installation.lastSeenAt).toLocaleString("pt-BR") : "-"
  }));

  currentAuthEvents = alerts.slice(-4).reverse().map((alert) => ({
    title: alert.title,
    detail: `${alert.severity} - ${alert.message || alert.code || "Sem detalhes"}`
  }));

  renderMetrics(dashboard);
  renderClients(document.querySelector("#client-filter").value);
  renderAuthEvents();
}

function renderMetrics(dashboard) {
  document.querySelector("#metric-resellers").textContent = dashboard.resellers;
  document.querySelector("#metric-clients").textContent = dashboard.clients;
  document.querySelector("#metric-online").textContent = dashboard.online;
  document.querySelector("#metric-alerts").textContent = dashboard.criticalAlerts;
}

function renderClients(filter = "") {
  const table = document.querySelector("#clients-table");
  const normalizedFilter = filter.trim().toLowerCase();
  const visibleClients = currentClients.filter((client) => {
    const searchable = `${client.name} ${client.reseller} ${client.environment} ${client.database || ""}`.toLowerCase();
    return searchable.includes(normalizedFilter);
  });

  table.innerHTML = visibleClients
    .map(
      (client) => `
        <tr>
          <td>${client.name}</td>
          <td>${client.reseller}</td>
          <td>${client.environment}</td>
          <td>${client.version}<br><span class="muted-cell">${client.database || "-"}</span></td>
          <td><span class="status ${client.status}">${statusLabels[client.status] || client.status}</span></td>
          <td>${client.lastSeen}</td>
        </tr>
      `
    )
    .join("");
}

function renderAuthEvents() {
  const list = document.querySelector("#auth-events");
  const events = currentAuthEvents.length > 0
    ? currentAuthEvents
    : [{ title: "Sem eventos", detail: "Nenhum alerta recente no escopo atual" }];

  list.innerHTML = events
    .map(
      (event) => `
        <article class="event">
          <strong>${event.title}</strong>
          <span>${event.detail}</span>
        </article>
      `
    )
    .join("");
}

async function createClient(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const result = document.querySelector("#pairing-result");
  const tronsoft = currentUser.role === "tronsoft_admin";
  const selectedReseller = currentResellers.find((reseller) => reseller.id === data.get("resellerId"));

  result.hidden = false;
  result.textContent = "Gerando token...";

  try {
    const payload = await api("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify({
        reseller: tronsoft && selectedReseller
          ? { name: selectedReseller.name, document: selectedReseller.document }
          : {
              name: data.get("resellerName"),
              document: data.get("resellerDocument")
            },
        customer: {
          name: data.get("customerName"),
          document: data.get("customerDocument"),
          city: data.get("customerCity"),
          state: data.get("customerState")
        }
      })
    });

    result.innerHTML = `
      <strong>Token gerado para ${payload.client.name}</strong><br>
      <code>${payload.pairingToken.token}</code>
    `;
    form.reset();
    await configureScopeControls();
    await loadCentralData();
  } catch (error) {
    result.textContent = error.message || "Nao foi possivel gerar o token.";
  }
}

document.querySelector("#login-form").addEventListener("submit", login);
document.querySelector("#logout-button").addEventListener("click", logout);
document.querySelector("#refresh-button").addEventListener("click", loadCentralData);
document.querySelector("#reseller-filter").addEventListener("change", loadCentralData);
document.querySelector("#client-filter").addEventListener("input", (event) => {
  renderClients(event.target.value);
});
document.querySelector("#client-form").addEventListener("submit", createClient);

loadSession();
