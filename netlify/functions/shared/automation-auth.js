function requireAutomationSecret(event) {
  const expected = process.env.N8N_AUTOMATION_SECRET;
  const provided =
    event.headers["x-automation-secret"] ||
    event.headers["X-Automation-Secret"];

  if (!expected) {
    const error = new Error("N8N_AUTOMATION_SECRET is not configured");
    error.statusCode = 500;
    error.publicMessage = "Chưa cấu hình secret cho n8n.";
    throw error;
  }

  if (!provided || provided !== expected) {
    const error = new Error("Invalid automation secret");
    error.statusCode = 401;
    error.publicMessage = "Sai secret automation.";
    throw error;
  }
}

module.exports = {
  requireAutomationSecret
};
