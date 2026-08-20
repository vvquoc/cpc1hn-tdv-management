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
  const databaseErrors = {
    "23505": [409, "Dữ liệu đã tồn tại."],
    "23503": [400, "Dữ liệu liên quan không tồn tại hoặc vẫn đang được sử dụng."],
    "23514": [400, "Giá trị dữ liệu không hợp lệ."],
    "22P02": [400, "Định dạng dữ liệu không hợp lệ."],
    "22007": [400, "Ngày tháng không hợp lệ."]
  };
  const mapped = databaseErrors[error.code];
  const statusCode = error.statusCode || mapped?.[0] || 500;
  if (statusCode >= 500) console.error(error);
  return json(statusCode, {
    error: error.publicMessage || mapped?.[1] || "Internal server error"
  });
}

module.exports = {
  json,
  methodNotAllowed,
  parseBody,
  handleError
};
