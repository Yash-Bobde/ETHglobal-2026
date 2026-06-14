const { allowMethods, sendJson } = require("../_engine");

module.exports = function handler(request, response) {
  if (!allowMethods(request, response, ["GET"])) return;
  sendJson(response, {
    network: "sepolia",
    configured: Boolean(process.env.SEPOLIA_RPC_URL),
  });
};
