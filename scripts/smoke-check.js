const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = [
  "assets/remai-logo.svg",
  "index.html",
  "server.js",
  "src/app.js",
  "src/styles.css",
  "src/backend/agent-engine.js",
  "src/backend/ens-sepolia.js",
  "src/backend/env.js",
  "README.md",
  "package.json",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error(`Missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

const files = Object.fromEntries(
  required.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]),
);
const bundle = Object.values(files).join("\n");
const checks = [
  ["RemAI branding", files["index.html"].includes("RemAI") && files["README.md"].includes("RemAI ENS Passport")],
  ["RemAI logo wired", files["index.html"].includes("assets/remai-logo.svg")],
  ["Sepolia ENS adapter", files["src/backend/ens-sepolia.js"].includes("ENS_SEPOLIA")],
  ["app.ens.dev v2 fallback", files["src/backend/ens-sepolia.js"].includes("app-ens-dev-v2-registry")],
  ["ENS v2 dev registry address", files["src/backend/ens-sepolia.js"].includes("0xdedb92913a25abe1f7bcdd85d8a344a43b398b67")],
  ["ENS resolve route", files["server.js"].includes("/api/ens/resolve")],
  ["Passport route", files["server.js"].includes("/api/passport")],
  ["Real-time EventSource client", files["src/app.js"].includes("EventSource")],
  ["Per-page session IDs", files["src/app.js"].includes("createSessionId")],
  ["Session-isolated backend state", files["server.js"].includes("getSessionId") && files["server.js"].includes("sessions = new Map")],
  ["No extra sponsor routes", !bundle.includes("/api/world") && !bundle.includes("World" + " ID")],
  ["No old multi-track routes", !bundle.includes("/api/" + "tasks/run") && !bundle.includes("/api/" + "wallet/authorize")],
  ["README pool-prize scope", files["README.md"].includes("Integrate ENS")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length > 0) {
  failed.forEach(([label]) => console.error(`Failed: ${label}`));
  process.exit(1);
}

console.log("Smoke check passed: RemAI ENS passport app is present.");
