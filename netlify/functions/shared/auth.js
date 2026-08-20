const crypto = require("node:crypto");
const { hasCustomerAccess, isManager, loadData, withTerritories } = require("./store");

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signPayload(payload) {
  if (!process.env.AUTH_TOKEN_SECRET) {
    const error = new Error("Missing AUTH_TOKEN_SECRET");
    error.statusCode = 500;
    error.publicMessage = "Hệ thống chưa cấu hình khóa đăng nhập.";
    throw error;
  }
  return crypto.createHmac("sha256", process.env.AUTH_TOKEN_SECRET).update(payload).digest("base64url");
}

function createToken(employeeId) {
  const payload = base64Url({
    employeeId,
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000
  });
  return `${payload}.${signPayload(payload)}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || signature !== signPayload(payload)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.employeeId || Number(data.expiresAt) <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function getBearerToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function requireUser(event) {
  const token = getBearerToken(event);
  if (!token) {
    const error = new Error("Missing token");
    error.statusCode = 401;
    error.publicMessage = "Vui lòng đăng nhập.";
    throw error;
  }

  const data = await loadData(event);
  const session = verifyToken(token);
  if (!session) {
    const error = new Error("Invalid session");
    error.statusCode = 401;
    error.publicMessage = "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
    throw error;
  }

  const employee = data.employees.find((item) => item.id === session.employeeId && item.status !== "Inactive");
  if (!employee) {
    const error = new Error(`Unknown user id: ${session.employeeId}`);
    error.statusCode = 403;
    error.publicMessage = "Tài khoản chưa được phân quyền trong hệ thống.";
    throw error;
  }

  return withTerritories(data, employee);
}

function isAdmin(user) {
  return isManager(user);
}

function customerScopeSql() {
  return { clause: "true", params: [], nextIndex: 1 };
}

async function assertCustomerAccess(user, customerId) {
  const data = await loadData();
  if (!hasCustomerAccess(data, user, customerId)) {
    const error = new Error(`Customer outside scope: ${customerId}`);
    error.statusCode = 403;
    error.publicMessage = "Khách hàng không thuộc phạm vi phụ trách.";
    throw error;
  }
}

module.exports = {
  requireUser,
  isAdmin,
  customerScopeSql,
  assertCustomerAccess,
  createToken,
  verifyToken
};
