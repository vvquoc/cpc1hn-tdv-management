function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function methodNotAllowed() {
  return json(405, { error: "Method not allowed" });
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    error.publicMessage = "Dữ liệu gửi lên không đúng định dạng.";
    throw error;
  }
}

function handleError(error) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error(error);
  return json(statusCode, {
    error: error.publicMessage || "Internal server error"
  });
}

module.exports = {
  json,
  methodNotAllowed,
  parseBody,
  handleError
};
