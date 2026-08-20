const { one, query } = require("./db");

function getEmail(event) {
  const headerEmail = event.headers["x-user-email"] || event.headers["X-User-Email"];
  const queryEmail = event.queryStringParameters && event.queryStringParameters.email;
  return String(headerEmail || queryEmail || "").trim().toLowerCase();
}

async function requireUser(event) {
  const email = getEmail(event);
  if (!email) {
    const error = new Error("Missing user email");
    error.statusCode = 401;
    error.publicMessage = "Thiếu email đăng nhập.";
    throw error;
  }

  const user = await one(
    `select id_nhan_vien, ten_nhan_vien, email, chuc_vu
     from tb_nhan_su
     where lower(email) = $1 and trang_thai = 'Active'`,
    [email]
  );

  if (!user) {
    const error = new Error(`Unknown user: ${email}`);
    error.statusCode = 403;
    error.publicMessage = "Tài khoản chưa được phân quyền trong hệ thống.";
    throw error;
  }

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
  assertCustomerAccess
};
