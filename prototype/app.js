const fallbackClients = [
  {
    name: "Mercado Sol Nascente",
    reseller: "Alpha Sistemas",
    environment: "Matriz",
    version: "2026.6.12",
    status: "online",
    lastSeen: "ha 2 min"
  },
  {
    name: "Farmacia Vida Plena",
    reseller: "Alpha Sistemas",
    environment: "Loja 02",
    version: "2026.5.28",
    status: "warning",
    lastSeen: "ha 18 min"
  },
  {
    name: "Autopecas Avenida",
    reseller: "Norte Tech",
    environment: "Servidor fiscal",
    version: "2026.6.08",
    status: "online",
    lastSeen: "ha 5 min"
  },
  {
    name: "Distribuidora Prisma",
    reseller: "Norte Tech",
    environment: "Operacao",
    version: "2026.4.19",
    status: "offline",
    lastSeen: "ha 2 h"
  }
];

const fallbackAuthEvents = [
  {
    title: "Identidade sincronizada",
    detail: "usuario@alphasistemas.com.br"
  },
  {
    title: "Token renovado",
    detail: "Worker 0auth concluiu a rotina agendada"
  },
  {
    title: "Permissoes atualizadas",
    detail: "Perfil operador aplicado em 3 usuarios"
  }
];

const statusLabels = {
  online: "Online",
  warning: "Atencao",
  offline: "Offline"
};

let currentClients = fallbackClients;
let currentAuthEvents = fallbackAuthEvents;

async function loadCentralData() {
  try {
    const [dashboardResponse, installationsResponse, alertsResponse] = await Promise.all([
      fetch("/api/dashboard"),
      fetch("/api/installations"),
      fetch("/api/alerts")
    ]);

    if (!dashboardResponse.ok || !installationsResponse.ok || !alertsResponse.ok) {
      throw new Error("API indisponivel");
    }

    const dashboard = await dashboardResponse.json();
    const installations = await installationsResponse.json();
    const alerts = await alertsResponse.json();

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
  } catch {
    renderMetrics();
  }

  renderClients(document.querySelector("#client-filter").value);
  renderAuthEvents();
}

function renderMetrics(dashboard = null) {
  const resellers = dashboard?.resellers ?? new Set(currentClients.map((client) => client.reseller)).size;
  const online = dashboard?.online ?? currentClients.filter((client) => client.status === "online").length;
  const alerts = dashboard?.criticalAlerts ?? currentClients.filter((client) => client.status !== "online").length;

  document.querySelector("#metric-resellers").textContent = resellers;
  document.querySelector("#metric-clients").textContent = dashboard?.clients ?? currentClients.length;
  document.querySelector("#metric-online").textContent = online;
  document.querySelector("#metric-alerts").textContent = alerts;
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
          <td><span class="status ${client.status}">${statusLabels[client.status]}</span></td>
          <td>${client.lastSeen}</td>
        </tr>
      `
    )
    .join("");
}

function renderAuthEvents() {
  const list = document.querySelector("#auth-events");

  const events = currentAuthEvents.length > 0 ? currentAuthEvents : fallbackAuthEvents;

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

  result.hidden = false;
  result.textContent = "Gerando token...";

  try {
    const response = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reseller: {
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

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    result.innerHTML = `
      <strong>Token gerado para ${payload.client.name}</strong><br>
      <code>${payload.pairingToken.token}</code>
    `;
    form.reset();
    await loadCentralData();
  } catch (error) {
    result.textContent = error.message || "Nao foi possivel gerar o token.";
  }
}

document.querySelector("#client-filter").addEventListener("input", (event) => {
  renderClients(event.target.value);
});

document.querySelector("#client-form").addEventListener("submit", createClient);

loadCentralData();
