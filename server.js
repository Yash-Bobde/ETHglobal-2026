const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadLocalEnv } = require("./src/backend/env");
const { createPassportEngine } = require("./src/backend/agent-engine");

const root = __dirname;
loadLocalEnv(root);

const port = Number(process.env.PORT || 3018);
const sessions = new Map();
const sessionClients = new Map();
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function broadcast(sessionId, event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sessionClients.get(sessionId) || []) client.write(message);
}

function getEngine(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(
      sessionId,
      createPassportEngine((event, payload) => {
        broadcast(sessionId, event, payload);
      }),
    );
  }
  return sessions.get(sessionId);
}

function getSessionId(request, url) {
  const raw = url.searchParams.get("sessionId") || request.headers["x-remai-session"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(raw)) return raw;
  return "default";
}

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent((requestPath || "/").split("?")[0]);
  const target = decoded === "/" ? "index.html" : `.${decoded}`;
  const resolved = path.resolve(base, target);
  return resolved.startsWith(base) ? resolved : path.join(base, "index.html");
}

function sendJson(response, data, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function sendError(response, error) {
  sendJson(response, { error: error.message || "Request failed" }, error.statusCode || 500);
}

function readJson(request) {
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

function handleEvents(request, response, sessionId) {
  const engine = getEngine(sessionId);
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.write(`event: state\ndata: ${JSON.stringify({ state: engine.snapshot() })}\n\n`);
  if (!sessionClients.has(sessionId)) sessionClients.set(sessionId, new Set());
  sessionClients.get(sessionId).add(response);
  request.on("close", () => {
    const clients = sessionClients.get(sessionId);
    if (!clients) return;
    clients.delete(response);
    if (clients.size === 0) sessionClients.delete(sessionId);
  });
}

async function handleApi(request, response, url) {
  const pathname = url.pathname;
  const sessionId = getSessionId(request, url);
  const engine = getEngine(sessionId);

  try {
    if (request.method === "GET" && pathname === "/api/state") {
      sendJson(response, engine.snapshot());
      return;
    }

    if (request.method === "GET" && pathname === "/api/events") {
      handleEvents(request, response, sessionId);
      return;
    }

    if (request.method === "GET" && pathname === "/api/ens/config") {
      sendJson(response, {
        network: "sepolia",
        configured: Boolean(process.env.SEPOLIA_RPC_URL),
      });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, { error: "Method not allowed" }, 405);
      return;
    }

    if (pathname === "/api/passport") {
      sendJson(response, await engine.createPassport(await readJson(request)));
      return;
    }

    if (pathname === "/api/ens/resolve") {
      const body = await readJson(request);
      sendJson(response, await engine.resolveName(body.name || body.ensName));
      return;
    }

    if (pathname === "/api/reset") {
      sendJson(response, engine.reset());
      return;
    }

    sendJson(response, { error: "API route not found" }, 404);
  } catch (error) {
    sendError(response, error);
  }
}

function handleStatic(request, response) {
  const filePath = safeJoin(root, request.url);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(request, response, url);
    return;
  }
  handleStatic(request, response);
});

server.listen(port, () => {
  console.log(`RemAI ENS Passport running at http://localhost:${port}`);
  console.log(`ENS API ready at http://localhost:${port}/api/ens/config`);
});
