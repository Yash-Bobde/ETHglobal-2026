const { allowMethods, getEngine } = require("./_engine");

module.exports = function handler(request, response) {
  if (!allowMethods(request, response, ["GET"])) return;
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.end(`event: state\ndata: ${JSON.stringify({ state: getEngine(request).snapshot() })}\n\n`);
};
