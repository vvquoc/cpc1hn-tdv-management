const { one, query } = require("./db");
const crypto = require("node:crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBearerToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function loadUserById(employeeId) {
  const user = await one(
    `select id_nhan_vien, ten_nhan_vien, email, chuc_vu
     from tb_nhan_su
     where id_nhan_vien = $1 and trang_thai = 'Active'`,
    [employeeId]
  );

  if (!user) return null;

  user.territoryIds = (
    await query(
      `select id_dia_ban
       from employee_territories
       where id_nhan_vien = $1`,
      [user.id_nhan_vien]
    )
  ).map((row) => row.id_dia_ban);

  return user;
}

async function requireUser(event) {
  const token = getBearerToken(event);
  if (!token) {
    const error = new Error("Missing user email");
    error.statusCode = 401;
    error.publicMessage = "Vui lòng đăng nhập.";
    throw error;
  }

  const session = await one(
    `select id_nhan_vien
     from auth_sessions
     where token_hash = $1 and expires_at > now()`,
    [hashToken(token)]
  );

  if (!session) {
    const error = new Error("Invalid session");
    error.statusCode = 401;
    error.publicMessage = "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
    throw error;
  }

  const user = await loadUserById(session.id_nhan_vien);
  if (!user) {
    const error = new Error(`Unknown user id: ${session.id_nhan_vien}`);
    error.statusCode = 403;
    error.publicMessage = "Tài khoản chưa được phân quyền trong hệ thống.";
    throw error;
  }

  return user;
}

function isAdmin(user) {
  return ["QuanLy", "Admin", "Manager"].includes(user.chuc_vu);
}

function customerScopeSql(user, alias = "kh", startIndex = 1) {
  if (isAdmin(user)) {
    return { clause: "true", params: [], nextIndex: startIndex };
  }

  return {
    clause: `exists (
      select 1
      from employee_customers ec
      where ec.id_khach_hang = ${alias}.id_khach_hang
        and ec.id_nhan_vien = $${startIndex}
    )`,
    params: [user.id_nhan_vien],
    nextIndex: startIndex + 1
  };
}

async function assertCustomerAccess(user, customerId) {
  const scope = customerScopeSql(user, "kh", 1);
  const rows = await query(
    `select kh.id_khach_hang
     from tb_khach_hang kh
     where ${scope.clause}
       and kh.id_khach_hang = $${scope.nextIndex}
     limit 1`,
    [...scope.params, customerId]
  );

  if (!rows.length) {
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
  hashToken,
  loadUserById
};
