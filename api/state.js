const { allowMethods, getEngine, sendJson } = require("./_engine");

module.exports = function handler(request, response) {
  if (!allowMethods(request, response, ["GET"])) return;
  sendJson(response, getEngine(request).snapshot());
};
