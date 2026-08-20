const { handleError, json, methodNotAllowed } = require("./shared/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();

  try {
    return json(200, { ok: true });
  } catch (error) {
    return handleError(error);
  }
};
