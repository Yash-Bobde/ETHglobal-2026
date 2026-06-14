const sessionId = createSessionId();
const ui = { snapshot: null };

const els = {
  form: document.querySelector("#passport-form"),
  ensName: document.querySelector("#ensName"),
  currentCity: document.querySelector("#currentCity"),
  destinationCity: document.querySelector("#destinationCity"),
  moveDate: document.querySelector("#moveDate"),
  priority: document.querySelector("#priority"),
  notes: document.querySelector("#notes"),
  ensStatus: document.querySelector("#ensStatus"),
  resolvedName: document.querySelector("#resolvedName"),
  resolvedMessage: document.querySelector("#resolvedMessage"),
  ensRecords: document.querySelector("#ensRecords"),
  streamStatus: document.querySelector("#streamStatus"),
  activityLog: document.querySelector("#activityLog"),
  passportCards: document.querySelector("#passportCards"),
  passportJson: document.querySelector("#passportJson"),
  copyPassport: document.querySelector("#copyPassport"),
};

function readFormPayload() {
  return {
    ensName: els.ensName.value.trim(),
    currentCity: els.currentCity.value.trim(),
    destinationCity: els.destinationCity.value.trim(),
    moveDate: els.moveDate.value,
    priority: els.priority.value,
    notes: els.notes.value.trim(),
  };
}

async function postJson(path, body = {}) {
  const response = await fetch(withSession(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RemAI-Session": sessionId,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Backend request failed");
  if (data.passport || data.ens || data.activity) handleSnapshot(data);
  return data;
}

async function getState() {
  const response = await fetch(withSession("/api/state"), {
    headers: { "X-RemAI-Session": sessionId },
  });
  handleSnapshot(await response.json());
}

function connectEventStream() {
  const events = new EventSource(withSession("/api/events"));
  events.onopen = () => setStreamStatus("Live", "ready");
  events.addEventListener("state", (event) => {
    const payload = JSON.parse(event.data);
    handleSnapshot(payload.state || payload);
  });
  events.addEventListener("activity", (event) => {
    const payload = JSON.parse(event.data);
    handleSnapshot(payload.state || payload);
  });
  events.onerror = () => setStreamStatus("Reconnecting", "pending");
}

function handleSnapshot(snapshot) {
  if (!snapshot) return;
  ui.snapshot = snapshot;
  renderEns(snapshot.ens, snapshot.isResolving);
  renderPassport(snapshot.passport);
  renderActivity(snapshot.activity || []);
}

function renderEns(ens, isResolving) {
  if (isResolving) {
    els.ensStatus.textContent = "Resolving";
    els.ensStatus.className = "status-chip pending";
    return;
  }

  if (!ens) {
    els.ensStatus.textContent = "Waiting";
    els.ensStatus.className = "status-chip pending";
    els.resolvedName.textContent = "No name resolved yet";
    els.resolvedMessage.textContent = "Enter a Sepolia ENS name to begin.";
    els.ensRecords.innerHTML = "";
    return;
  }

  if (!ens.configured) {
    els.ensStatus.textContent = "RPC needed";
    els.ensStatus.className = "status-chip pending";
  } else if (ens.exists) {
    els.ensStatus.textContent = "Verified";
    els.ensStatus.className = "status-chip ready";
  } else {
    els.ensStatus.textContent = "Not registered";
    els.ensStatus.className = "status-chip failed";
  }

  els.resolvedName.textContent = ens.name || "Unknown ENS name";
  els.resolvedMessage.textContent = ens.message || "ENS lookup completed.";
  els.ensRecords.innerHTML = createEnsRecordList(ens);
}

function createEnsRecordList(ens) {
  const records = [
    ["network", ens.network || "sepolia"],
    ["source", ens.source || "unknown"],
    ["owner", ens.owner || "not found"],
    ["resolver", ens.resolver || "not found"],
    ["addr", ens.address || "not set"],
  ];

  if (ens.expiryDate) {
    records.push(["expires", new Date(ens.expiryDate).toLocaleDateString()]);
  }

  if (Array.isArray(ens.textRecords)) {
    for (const record of ens.textRecords) {
      records.push([record.key, record.value || "not set"]);
    }
  }

  return records
    .map(([label, value]) => `<div class="record"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderPassport(passport) {
  if (!passport) {
    els.passportCards.innerHTML = `<article class="empty-card">Create a passport to see RemAI's ENS relocation concept.</article>`;
    els.passportJson.textContent = "Create a passport to generate JSON.";
    return;
  }

  const cards = [
    ["Identity", passport.identityStatus],
    ["Route", passport.route],
    ["Priority", passport.priority],
    ["Move date", passport.moveDate || "not set"],
  ];

  els.passportCards.innerHTML = cards
    .map(([label, value]) => `<article class="passport-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`)
    .join("");

  els.passportJson.textContent = JSON.stringify(passport, null, 2);
}

function renderActivity(activity) {
  if (activity.length === 0) {
    els.activityLog.innerHTML = `<div class="activity-item"><time>Now</time><div><span class="activity-stage info">idle</span><p>Waiting for the first backend event.</p></div></div>`;
    return;
  }

  els.activityLog.innerHTML = activity
    .map((entry) => {
      const time = new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `<div class="activity-item"><time>${time}</time><div><span class="activity-stage ${escapeHtml(entry.status)}">${escapeHtml(entry.stage)}</span><strong>${escapeHtml(entry.status)}</strong><p>${escapeHtml(entry.message)}</p></div></div>`;
    })
    .join("");
}

function setStreamStatus(label, className) {
  els.streamStatus.textContent = label;
  els.streamStatus.className = `status-chip ${className}`;
}

function withSession(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}

function createSessionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createPassport(event) {
  event.preventDefault();
  await safeRun(async () => {
    const snapshot = await postJson("/api/passport", readFormPayload());
    handleSnapshot(snapshot);
    document.querySelector("#ens-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function copyPassport() {
  const text = els.passportJson.textContent;
  try {
    await navigator.clipboard.writeText(text);
    els.copyPassport.textContent = "Copied";
    setTimeout(() => { els.copyPassport.textContent = "Copy JSON"; }, 1200);
  } catch {
    els.copyPassport.textContent = "Select JSON to copy";
  }
}

async function safeRun(action) {
  try {
    await action();
  } catch (error) {
    setStreamStatus("Error", "failed");
    insertActivityError(error.message);
  }
}

function insertActivityError(message) {
  els.activityLog.insertAdjacentHTML("afterbegin", `<div class="activity-item"><time>Now</time><div><span class="activity-stage blocked">error</span><strong>failed</strong><p>${escapeHtml(message)}</p></div></div>`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.form.addEventListener("submit", createPassport);
els.copyPassport.addEventListener("click", copyPassport);
connectEventStream();
getState();
