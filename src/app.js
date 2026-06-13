const ui = { snapshot: null };

const els = {
  moveForm: document.querySelector("#moveForm"),
  currentCity: document.querySelector("#currentCity"),
  destinationCity: document.querySelector("#destinationCity"),
  officeLocation: document.querySelector("#officeLocation"),
  moveDate: document.querySelector("#moveDate"),
  budget: document.querySelector("#budget"),
  spendCap: document.querySelector("#spendCap"),
  commute: document.querySelector("#commute"),
  items: document.querySelector("#items"),
  createAgent: document.querySelector("#createAgent"),
  authorizeWallet: document.querySelector("#authorizeWallet"),
  runTasks: document.querySelector("#runTasks"),
  runFullDemo: document.querySelector("#runFullDemo"),
  resetDemo: document.querySelector("#resetDemo"),
  copyPacket: document.querySelector("#copyPacket"),
  agentStatus: document.querySelector("#agentStatus"),
  agentName: document.querySelector("#agentName"),
  agentSubtitle: document.querySelector("#agentSubtitle"),
  ensRecords: document.querySelector("#ensRecords"),
  walletAddress: document.querySelector("#walletAddress"),
  walletPolicy: document.querySelector("#walletPolicy"),
  taskGrid: document.querySelector("#taskGrid"),
  receiptRows: document.querySelector("#receiptRows"),
  judgePacket: document.querySelector("#judgePacket"),
  activityLog: document.querySelector("#activityLog"),
  streamStatus: document.querySelector("#streamStatus"),
};

function readFormPayload() {
  return {
    current: els.currentCity.value.trim(),
    destination: els.destinationCity.value.trim(),
    office: els.officeLocation.value.trim(),
    moveDate: els.moveDate.value,
    budget: Number(els.budget.value),
    spendCap: Number(els.spendCap.value),
    commute: Number(els.commute.value),
    items: els.items.value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
  };
}

async function api(path, body = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Backend request failed");
  handleSnapshot(data);
  return data;
}

async function getState() {
  const response = await fetch("/api/state");
  const data = await response.json();
  handleSnapshot(data);
}

function connectEventStream() {
  const events = new EventSource("/api/events");

  events.onopen = () => {
    setStreamStatus("Live", "ready");
  };

  events.addEventListener("state", (event) => {
    const payload = JSON.parse(event.data);
    handleSnapshot(payload.state || payload);
  });

  events.addEventListener("activity", (event) => {
    const payload = JSON.parse(event.data);
    handleSnapshot(payload.state);
  });

  events.onerror = () => {
    setStreamStatus("Reconnecting", "pending");
  };
}

function handleSnapshot(snapshot) {
  if (!snapshot) return;
  ui.snapshot = snapshot;
  renderAgent(snapshot);
  renderTasks(snapshot);
  renderReceipts(snapshot);
  renderActivity(snapshot.activity || []);
  renderJudgePacket(snapshot.judgePacket);
  setBusy(Boolean(snapshot.isRunning));
}

function renderAgent(snapshot) {
  const plan = snapshot.plan;
  if (!plan) {
    els.agentName.textContent = "move-agent.flyta.eth";
    els.agentSubtitle.textContent = "Waiting for relocation intake.";
    els.agentStatus.textContent = "Not created";
    els.agentStatus.className = "status-chip pending";
    els.walletAddress.textContent = "Not authorized";
    els.walletPolicy.textContent = "Spend cap pending";
    els.ensRecords.innerHTML = "";
    return;
  }

  els.agentName.textContent = plan.agentEns;
  els.agentSubtitle.textContent = snapshot.agentCreated
    ? `Public service records describe what this agent can do for ${plan.destination}.`
    : `${plan.route}. Optimizing for ${plan.commute} minute commute and ${plan.budget.toLocaleString()} USD rent.`;

  if (snapshot.ensVerification?.configured && snapshot.ensVerification?.exists) {
    els.agentStatus.textContent = "Sepolia verified";
    els.agentStatus.className = "status-chip ready";
  } else if (snapshot.ensVerification?.configured && !snapshot.ensVerification?.exists) {
    els.agentStatus.textContent = "Register on Sepolia";
    els.agentStatus.className = "status-chip pending";
  } else if (snapshot.walletAuthorized) {
    els.agentStatus.textContent = "Agent active";
    els.agentStatus.className = "status-chip ready";
  } else if (snapshot.agentCreated) {
    els.agentStatus.textContent = "ENS RPC needed";
    els.agentStatus.className = "status-chip pending";
  } else {
    els.agentStatus.textContent = "Intake ready";
    els.agentStatus.className = "status-chip pending";
  }

  els.walletAddress.textContent = snapshot.walletAddress || "Not authorized";
  els.walletPolicy.textContent = snapshot.walletAuthorized
    ? `Dynamic policy: max ${plan.spendCap} USDC across approved relocation tasks`
    : `Spend cap pending: ${plan.spendCap} USDC`;

  els.ensRecords.innerHTML = (snapshot.ensRecords || [])
    .map((record) => `<div class="record"><span>${escapeHtml(record.label)}</span><strong>${escapeHtml(record.value)}</strong></div>`)
    .join("");
}

function renderTasks(snapshot) {
  const receipts = snapshot.receipts || [];
  els.taskGrid.innerHTML = (snapshot.tasks || [])
    .map((task) => {
      const receipt = receipts.find((item) => item.taskId === task.id);
      const status = receipt ? "Paid" : snapshot.walletAuthorized ? "Ready" : "Locked";
      return `<article class="task-card"><div class="task-meta"><span>${escapeHtml(task.rail)}</span><span>${task.amount.toFixed(2)} USDC</span><span>${status}</span></div><h3>${escapeHtml(task.title)}</h3><p class="muted">${escapeHtml(task.description)}</p><strong>${escapeHtml(receipt ? receipt.outcome : "Waiting for authorization")}</strong></article>`;
    })
    .join("");
}

function renderReceipts(snapshot) {
  const receipts = snapshot.receipts || [];
  if (receipts.length === 0) {
    els.receiptRows.innerHTML = `<tr><td colspan="5">No receipts yet. Authorize the wallet, then run paid tasks.</td></tr>`;
    return;
  }

  els.receiptRows.innerHTML = receipts
    .map((receipt) => `<tr><td>${escapeHtml(receipt.title)}</td><td>${escapeHtml(receipt.rail)}</td><td>${receipt.amount.toFixed(2)} USDC</td><td><span class="status-chip ready">${escapeHtml(receipt.status)}</span></td><td><a class="receipt-link" href="#judge" title="Mock explorer hash">${escapeHtml(receipt.hash.slice(0, 10))}...</a></td></tr>`)
    .join("");
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

function renderJudgePacket(packet) {
  els.judgePacket.textContent = packet ? JSON.stringify(packet, null, 2) : "Create a move plan to generate the judge packet.";
}

function setStreamStatus(label, className) {
  els.streamStatus.textContent = label;
  els.streamStatus.className = `status-chip ${className}`;
}

function setBusy(isBusy) {
  els.runTasks.disabled = isBusy;
  els.runFullDemo.disabled = isBusy;
  els.runTasks.textContent = isBusy ? "Running..." : "Run paid tasks";
}

async function createPlan(event) {
  event?.preventDefault();
  await safeRun(() => api("/api/plan", readFormPayload()));
}

async function createAgent() {
  await safeRun(() => api("/api/agent"));
}

async function authorizeWallet() {
  await safeRun(() => api("/api/wallet/authorize"));
}

async function runPaidTasks() {
  await safeRun(() => api("/api/tasks/run"));
}

async function runFullDemo() {
  await safeRun(async () => {
    await api("/api/plan", readFormPayload());
    await api("/api/agent");
    await api("/api/wallet/authorize");
    await api("/api/tasks/run");
    document.querySelector("#receipts").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function resetDemo() {
  await safeRun(async () => {
    await api("/api/reset");
    await api("/api/plan", readFormPayload());
  });
}

async function copyPacket() {
  const text = els.judgePacket.textContent;
  try {
    await navigator.clipboard.writeText(text);
    els.copyPacket.textContent = "Copied";
    setTimeout(() => { els.copyPacket.textContent = "Copy judge packet"; }, 1200);
  } catch {
    els.copyPacket.textContent = "Select packet to copy";
  }
}

async function safeRun(action) {
  try {
    await action();
  } catch (error) {
    setStreamStatus("Error", "failed");
    els.activityLog.insertAdjacentHTML("afterbegin", `<div class="activity-item"><time>Now</time><div><span class="activity-stage blocked">error</span><strong>failed</strong><p>${escapeHtml(error.message)}</p></div></div>`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.moveForm.addEventListener("submit", createPlan);
els.createAgent.addEventListener("click", createAgent);
els.authorizeWallet.addEventListener("click", authorizeWallet);
els.runTasks.addEventListener("click", runPaidTasks);
els.runFullDemo.addEventListener("click", runFullDemo);
els.resetDemo.addEventListener("click", resetDemo);
els.copyPacket.addEventListener("click", copyPacket);

connectEventStream();
getState().then(() => {
  if (!ui.snapshot?.plan) createPlan();
});

