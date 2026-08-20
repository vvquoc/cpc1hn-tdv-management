const crypto = require("node:crypto");
const { one, query } = require("./db");
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
  if (!payload || !signature) return null;
  const expected = Buffer.from(signPayload(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

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

async function requireUser(event, existingData) {
  const token = getBearerToken(event);
  if (!token) {
    const error = new Error("Missing token");
    error.statusCode = 401;
    error.publicMessage = "Vui lòng đăng nhập.";
    throw error;
  }

  const data = existingData || await loadData(event);
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

async function requireDatabaseUser(event) {
  const session = verifyToken(getBearerToken(event));
  if (!session) {
    const error = new Error("Invalid session");
    error.statusCode = 401;
    error.publicMessage = "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
    throw error;
  }
  const employee = await one("select id_nhan_vien,ten_nhan_vien,email,chuc_vu,trang_thai from tb_nhan_su where id_nhan_vien=$1 and trang_thai='Active'", [session.employeeId]);
  if (!employee) {
    const error = new Error("Unknown database user");
    error.statusCode = 403;
    error.publicMessage = "Tài khoản chưa được phân quyền trong hệ thống.";
    throw error;
  }
  const territories = await query("select id_dia_ban from employee_territories where id_nhan_vien=$1", [session.employeeId]);
  return { id: employee.id_nhan_vien, name: employee.ten_nhan_vien, email: employee.email, role: employee.chuc_vu, status: employee.trang_thai, territoryIds: territories.map((row) => row.id_dia_ban) };
}

function isAdmin(user) {
  return isManager(user);
}

function customerScopeSql() {
  return { clause: "true", params: [], nextIndex: 1 };
}

function assertCustomerAccess(data, user, customerId) {
  if (!hasCustomerAccess(data, user, customerId)) {
    const error = new Error(`Customer outside scope: ${customerId}`);
    error.statusCode = 403;
    error.publicMessage = "Khách hàng không thuộc phạm vi phụ trách.";
    throw error;
  }
}

async function assertDatabaseCustomerAccess(user, customerId, client) {
  if (isManager(user)) return;
  const sql = `select 1 from employee_customers ec
    join tb_khach_hang k on k.id_khach_hang=ec.id_khach_hang and k.trang_thai='Active'
    where ec.id_nhan_vien=$1 and ec.id_khach_hang=$2`;
  const rows = client ? (await client.query(sql, [user.id, customerId])).rows : await query(sql, [user.id, customerId]);
  if (!rows.length) {
    const error = new Error(`Customer outside scope: ${customerId}`);
    error.statusCode = 403;
    error.publicMessage = "Khách hàng không thuộc phạm vi phụ trách.";
    throw error;
  }
}

module.exports = {
  requireUser,
  requireDatabaseUser,
  isAdmin,
  customerScopeSql,
  assertCustomerAccess,
  assertDatabaseCustomerAccess,
  createToken,
  verifyToken
};
