const { resolveEnsAgent } = require("./ens-sepolia");
const tasks = [
  {
    id: "vendor-data",
    title: "Buy verified mover quote data",
    description: "Agent pays a data provider for fresh quote ranges on the selected route.",
    rail: "Arc USDC",
    amount: 4.75,
    outcome: "3 quote bands returned with confidence score",
  },
  {
    id: "storage-hold",
    title: "Reserve storage quote window",
    description: "Agent places a small refundable hold with a storage vendor under the user cap.",
    rail: "Dynamic wallet",
    amount: 12,
    outcome: "48 hour hold created for a 5x10 unit",
  },
  {
    id: "commute-api",
    title: "Purchase premium commute check",
    description: "Agent pays an API endpoint for commute and transit reliability details.",
    rail: "Arc USDC",
    amount: 2.2,
    outcome: "Commute risk score added to neighborhood ranking",
  },
];

const neighborhoods = [
  { name: "Astoria", rent: 3150, commute: 28, fit: 92 },
  { name: "Prospect Heights", rent: 3500, commute: 34, fit: 86 },
  { name: "Jersey City", rent: 3050, commute: 31, fit: 84 },
];

function createAgentEngine(emit = () => {}) {
  let state = initialState();

  function snapshot() {
    const walletAddress = state.walletAuthorized && state.plan ? mockWalletAddress(state.plan.agentEns) : null;
    const paidUsdc = Number(state.receipts.reduce((total, receipt) => total + receipt.amount, 0).toFixed(2));
    return {
      ...state,
      tasks,
      walletAddress,
      ensRecords: state.plan ? createEnsRecords(state.plan, walletAddress, state.ensVerification) : [],
      judgePacket: state.plan ? createJudgePacket(state, walletAddress, paidUsdc) : null,
      paidUsdc,
    };
  }

  function publish(event, payload = {}) {
    emit(event, { ...payload, state: snapshot() });
  }

  function log(stage, message, status = "info", details = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      stage,
      status,
      message,
      details,
    };
    state.activity = [entry, ...state.activity].slice(0, 25);
    publish("activity", { entry });
  }

  function createPlan(input) {
    const plan = normalizePlan(input);
    state = {
      ...initialState(),
      plan,
    };
    log("plan", `Move plan created for ${plan.route}.`, "ready", {
      neighborhoods: plan.neighborhoods.map((item) => item.name),
    });
    publish("state", {});
    return snapshot();
  }

  async function createAgent() {
    assertPlan(state.plan);
    state.agentCreated = true;
    state.ensVerification = await resolveEnsAgent(state.plan.agentEns);
    const status = state.ensVerification.configured && state.ensVerification.exists ? "ready" : "info";
    log("ens", state.ensVerification.message, status, {
      name: state.plan.agentEns,
      network: "sepolia",
      configured: state.ensVerification.configured,
      exists: state.ensVerification.exists,
    });
    publish("state", {});
    return snapshot();
  }

  function authorizeWallet() {
    assertPlan(state.plan);
    state.agentCreated = true;
    state.walletAuthorized = true;
    const walletAddress = mockWalletAddress(state.plan.agentEns);
    log("dynamic", `Wallet authorized with ${state.plan.spendCap} USDC user cap.`, "ready", {
      walletAddress,
      spendCap: state.plan.spendCap,
    });
    publish("state", {});
    return snapshot();
  }

  async function runTasks() {
    assertPlan(state.plan);
    if (state.isRunning) return snapshot();
    if (!state.walletAuthorized) authorizeWallet();

    state.isRunning = true;
    state.receipts = [];
    log("agent", "Relocation agent started paid task queue.", "running");

    let cumulative = 0;
    for (const task of tasks) {
      await delay(650);
      if (cumulative + task.amount > state.plan.spendCap) {
        log("policy", `${task.title} skipped because it would exceed the spend cap.`, "blocked", {
          amount: task.amount,
          cap: state.plan.spendCap,
        });
        continue;
      }

      cumulative += task.amount;
      const receipt = {
        taskId: task.id,
        title: task.title,
        rail: task.rail,
        amount: task.amount,
        status: "confirmed",
        hash: mockTxHash(state.receipts.length),
        outcome: task.outcome,
        createdAt: new Date().toISOString(),
      };
      state.receipts.push(receipt);
      log("payment", `${task.title} confirmed on ${task.rail}.`, "confirmed", receipt);
    }

    state.isRunning = false;
    log("agent", "Paid relocation workflow completed.", "ready", {
      receipts: state.receipts.length,
      paidUsdc: state.receipts.reduce((total, receipt) => total + receipt.amount, 0),
    });
    publish("state", {});
    return snapshot();
  }

  function reset() {
    state = initialState();
    log("system", "Backend state reset.", "ready");
    publish("state", {});
    return snapshot();
  }

  return {
    createPlan,
    createAgent,
    authorizeWallet,
    runTasks,
    reset,
    snapshot,
  };
}

function initialState() {
  return {
    plan: null,
    agentCreated: false,
    walletAuthorized: false,
    receipts: [],
    activity: [],
    isRunning: false,
    ensVerification: null,
  };
}

function normalizePlan(input = {}) {
  const current = stringValue(input.current, "Washington, DC");
  const destination = stringValue(input.destination, "New York, NY");
  const office = stringValue(input.office, "Union Square");
  const budget = positiveNumber(input.budget, 3400);
  const spendCap = positiveNumber(input.spendCap, 35);
  const commute = positiveNumber(input.commute, 30);
  const items = Array.isArray(input.items)
    ? input.items.map(String).map((item) => item.trim()).filter(Boolean)
    : stringValue(input.items, "Couch, desk, bed frame, TV, dining table").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

  return {
    current,
    destination,
    office,
    moveDate: stringValue(input.moveDate, "2026-08-20"),
    budget,
    spendCap,
    commute,
    items,
    agentEns: createAgentName(destination),
    route: `${current} to ${destination}`,
    neighborhoods: neighborhoods.map((neighborhood) => ({
      ...neighborhood,
      fit: Math.max(65, neighborhood.fit - Math.max(0, neighborhood.rent - budget) / 100),
    })),
  };
}

function createEnsRecords(plan, walletAddress, ensVerification) {
  return [
    ["name", plan.agentEns],
    ["addr", walletAddress || "Pending Dynamic wallet"],
    ["url", "https://flyta.local/agent"],
    ["capabilities", "neighborhood_rank,pay_quote,storage_hold,item_decision"],
    ["route", plan.route],
    ["policy", `${plan.spendCap} USDC user cap`],
    ["sepolia", ensVerification?.configured ? (ensVerification.exists ? "verified" : "not registered") : "rpc not configured"],
  ].map(([label, value]) => ({ label, value }));
}

function createJudgePacket(state, walletAddress, paidUsdc) {
  return {
    project: "Flyta Move Agent",
    hackathon: "ETHGlobal New York 2026",
    maxPrizeTargets: ["ENS", "Dynamic", "Arc"],
    excludedTracks: ["Sui", "Hedera"],
    userProblem: "Job movers need trusted agent help to compare neighborhoods, coordinate vendors, and pay for relocation services under user control.",
    agent: {
      ens: state.plan.agentEns,
      wallet: walletAddress || "not authorized",
      route: state.plan.route,
      spendCapUsdc: state.plan.spendCap,
      capabilities: ["rank neighborhoods", "request quote data", "hold storage quote", "create item decisions", "produce receipts"],
    },
    relocationPlan: {
      office: state.plan.office,
      moveDate: state.plan.moveDate,
      itemDecisionsNeeded: state.plan.items,
      topNeighborhoods: state.plan.neighborhoods.map((item) => ({
        name: item.name,
        commuteMinutes: item.commute,
        fit: Math.round(item.fit),
      })),
    },
    demoProof: {
      receiptsCreated: state.receipts.length,
      paidUsdc,
      receiptHashes: state.receipts.map((receipt) => receipt.hash),
    },
  };
}

function createAgentName(destination) {
  const city = destination.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "move";
  const baseDomain = (process.env.ENS_AGENT_BASE_DOMAIN || "flyta.eth").replace(/^\.+|\.+$/g, "");
  return `${city}-move-agent.${baseDomain}`;
}

function mockWalletAddress(agentEns) {
  let seed = 0;
  for (const char of agentEns) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const hex = seed.toString(16).padStart(8, "0");
  return `0x${(`f17a${hex}${hex}${hex}${hex}${hex}`).slice(0, 40)}`;
}

function mockTxHash(index) {
  const source = `${Date.now()}-${index}-${Math.random()}`;
  let hash = "";
  for (let i = 0; i < source.length; i += 1) hash += source.charCodeAt(i).toString(16);
  return `0x${hash.padEnd(64, "0").slice(0, 64)}`;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function stringValue(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function assertPlan(plan) {
  if (!plan) {
    const error = new Error("Create a move plan before running this action.");
    error.statusCode = 409;
    throw error;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { createAgentEngine };



