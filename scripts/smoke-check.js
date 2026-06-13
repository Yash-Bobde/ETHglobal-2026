const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = [
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

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "src/backend/agent-engine.js"), "utf8");
const ens = fs.readFileSync(path.join(root, "src/backend/ens-sepolia.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const bundle = `${html}\n${app}\n${server}\n${engine}\n${ens}\n${readme}`;
const checks = [
  ["ENS prize target", bundle.includes("ENS")],
  ["Dynamic prize target", bundle.includes("Dynamic")],
  ["Arc prize target", bundle.includes("Arc")],
  ["Banned tracks are exclusion-only", engine.includes("excludedTracks") && readme.includes("intentionally excluded")],
  ["Backend API routes", server.includes("/api/plan") && server.includes("/api/events")],
  ["Sepolia ENS adapter", ens.includes("ENS_SEPOLIA") && ens.includes("0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5")],
  ["ENS resolve route", server.includes("/api/ens/resolve")],
  ["Real-time EventSource client", app.includes("EventSource")],
  ["Agent receipts", engine.includes("receipts")],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length > 0) {
  failed.forEach(([label]) => console.error(`Failed: ${label}`));
  process.exit(1);
}
console.log("Smoke check passed: backend API, live stream, and hackathon prize focus are present.");

