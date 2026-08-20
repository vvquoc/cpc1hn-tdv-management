const { hashToken } = require("./shared/auth");
const { loadData, saveData } = require("./shared/store");
const { handleError, json, methodNotAllowed } = require("./shared/http");

function getBearerToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const token = getBearerToken(event);
    if (token) {
      const data = await loadData();
      const tokenHash = hashToken(token);
      data.sessions = data.sessions.filter((session) => session.tokenHash !== tokenHash);
      await saveData(data);
    }
    return json(200, { ok: true });
  } catch (error) {
    return handleError(error);
  }
};
