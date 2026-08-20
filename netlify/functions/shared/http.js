function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

function methodNotAllowed() {
  return json(405, { error: "Method not allowed" });
}

function parseBody(event) {
  if (!event.body) return {};
  return JSON.parse(event.body);
}

function handleError(error) {
  console.error(error);
  return json(error.statusCode || 500, {
    error: error.publicMessage || "Internal server error"
  });
}

module.exports = {
  json,
  methodNotAllowed,
  parseBody,
  handleError
};
