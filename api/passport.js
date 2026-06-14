const { allowMethods, getEngine, readJson, sendError, sendJson } = require("./_engine");

module.exports = async function handler(request, response) {
  if (!allowMethods(request, response, ["POST"])) return;
  try {
    sendJson(response, await getEngine(request).createPassport(await readJson(request)));
  } catch (error) {
    sendError(response, error);
  }
};
