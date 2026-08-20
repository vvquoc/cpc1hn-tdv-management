const { hashToken } = require("./shared/auth");
const { query } = require("./shared/db");
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
      await query(`delete from auth_sessions where token_hash = $1`, [hashToken(token)]);
    }
    return json(200, { ok: true });
  } catch (error) {
    return handleError(error);
  }
};
