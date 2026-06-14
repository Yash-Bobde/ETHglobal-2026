const path = require("path");
const { loadLocalEnv } = require("../src/backend/env");
const { createPassportEngine } = require("../src/backend/agent-engine");

loadLocalEnv(path.resolve(__dirname, ".."));

const sessions = global.__remaiSessions || new Map();
global.__remaiSessions = sessions;

function getSessionId(request) {
  const raw = request.query?.sessionId || request.headers["x-remai-session"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(raw)) return raw;
  return "default";
}

function getEngine(request) {
  const sessionId = getSessionId(request);
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createPassportEngine());
  }
  return sessions.get(sessionId);
}

function sendJson(response, data, statusCode = 200) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(data));
}

function sendError(response, error) {
  sendJson(response, { error: error.message || "Request failed" }, error.statusCode || 500);
}

function readJson(request) {
  if (request.body && typeof request.body === "object") return Promise.resolve(request.body);
  if (typeof request.body === "string" && request.body.trim()) {
    try {
      return Promise.resolve(JSON.parse(request.body));
    } catch {
      const error = new Error("Invalid JSON body.");
      error.statusCode = 400;
      return Promise.reject(error);
    }
  }

  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function allowMethods(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader("Allow", methods.join(", "));
  sendJson(response, { error: "Method not allowed" }, 405);
  return false;
}

module.exports = { allowMethods, getEngine, readJson, sendError, sendJson };
