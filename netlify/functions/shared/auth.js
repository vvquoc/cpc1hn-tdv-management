const crypto = require("node:crypto");
const { hasCustomerAccess, isManager, loadData, withTerritories } = require("./store");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
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

  const data = await loadData();
  const tokenHash = hashToken(token);
  const session = (data.sessions || []).find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt).getTime() > Date.now());
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
  hashToken
};
