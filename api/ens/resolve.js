const { allowMethods, getEngine, readJson, sendError, sendJson } = require("../_engine");

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;
  try {
    const body = await readJson(request);
    sendJson(response, await getEngine(request).resolveName(body.name || body.ensName));
  } catch (error) {
    sendError(response, error);
  }
};
