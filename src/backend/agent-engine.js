const { resolveEnsAgent } = require("./ens-sepolia");

function createPassportEngine(emit = () => {}) {
  let state = initialState();

  function snapshot() {
    return { ...state };
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
    state.activity = [entry, ...state.activity].slice(0, 20);
    publish("activity", { entry });
  }

  async function createPassport(input = {}) {
    const move = normalizeMove(input);
    state.isResolving = true;
    state.error = null;
    state.move = move;
    publish("state");
    log("input", `Creating RemAI passport for ${move.ensName}.`, "running", move);

    const ens = await resolveEnsAgent(move.ensName);
    const passport = buildPassport(move, ens);

    state = {
      ...state,
      isResolving: false,
      ens,
      passport,
    };

    log("ens", ens.message, ens.exists ? "ready" : ens.configured ? "blocked" : "info", {
      name: move.ensName,
      network: "sepolia",
      configured: ens.configured,
      exists: ens.exists,
    });
    log("passport", `Relocation passport generated for ${move.destinationCity}.`, "ready", {
      checklistItems: passport.checklist.length,
    });
    publish("state");
    return snapshot();
  }

  async function resolveName(name) {
    const ensName = String(name || "").trim();
    if (!ensName) {
      const error = new Error("ENS name is required.");
      error.statusCode = 400;
      throw error;
    }
    const ens = await resolveEnsAgent(ensName);
    log("ens", ens.message, ens.exists ? "ready" : ens.configured ? "blocked" : "info", {
      name: ensName,
      network: "sepolia",
    });
    return ens;
  }

  function reset() {
    state = initialState();
    log("system", "Passport state reset.", "ready");
    publish("state");
    return snapshot();
  }

  return { createPassport, resolveName, reset, snapshot };
}

function initialState() {
  return {
    move: null,
    ens: null,
    passport: null,
    activity: [],
    isResolving: false,
    error: null,
  };
}

function normalizeMove(input) {
  return {
    ensName: stringValue(input.ensName, ""),
    currentCity: stringValue(input.currentCity, ""),
    destinationCity: stringValue(input.destinationCity, ""),
    moveDate: stringValue(input.moveDate, ""),
    priority: stringValue(input.priority, "commute"),
    notes: stringValue(input.notes, ""),
  };
}

function buildPassport(move, ens) {
  const identityStatus = ens.configured
    ? ens.exists
      ? "Sepolia ENS verified"
      : "ENS name not registered on Sepolia yet"
    : "Sepolia RPC not configured";

  const textRecordSummary = Array.isArray(ens.textRecords)
    ? ens.textRecords.filter((record) => record.value).map((record) => `${record.key}: ${record.value}`)
    : [];

  return {
    title: "RemAI ENS Relocation Passport",
    identityStatus,
    ensName: move.ensName,
    owner: ens.owner || null,
    resolvedAddress: ens.address || null,
    resolver: ens.resolver || null,
    route: `${move.currentCity} to ${move.destinationCity}`,
    destinationCity: move.destinationCity,
    moveDate: move.moveDate,
    priority: move.priority,
    notes: move.notes,
    publicProfile: textRecordSummary,
    checklist: createChecklist(move, ens),
    demoProof: {
      ensNetwork: "sepolia",
      usesEnsSpecificCode: true,
      userProvidedEnsName: move.ensName,
      hasHardcodedUserValues: false,
    },
  };
}

function createChecklist(move, ens) {
  const checklist = [
    `Use ${move.ensName} as the public identity for this move.`,
    `Share the route summary: ${move.currentCity} to ${move.destinationCity}.`,
    `Prioritize ${formatPriority(move.priority)} while comparing neighborhoods.`,
  ];

  if (ens.exists) {
    checklist.push("Include the resolved ENS owner/address in the demo proof.");
  } else if (ens.configured) {
    checklist.push("Register or update the ENS name on Sepolia before recording the final demo.");
  } else {
    checklist.push("Add SEPOLIA_RPC_URL to .env.local before recording the final demo.");
  }

  checklist.push("Record a short video showing ENS lookup and passport generation.");
  return checklist;
}

function formatPriority(priority) {
  return String(priority).replace(/-/g, " ");
}

function stringValue(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

module.exports = { createPassportEngine };
