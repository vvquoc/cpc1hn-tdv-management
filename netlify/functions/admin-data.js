const { isAdmin, requireDatabaseUser } = require("./shared/auth");
const { hashPassword } = require("./shared/credentials");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

function fail(publicMessage, statusCode = 400) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  throw error;
}

function requireManager(user) {
  if (!isAdmin(user)) fail("Chỉ Quản lý được quản trị dữ liệu.", 403);
}

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) fail(`${label} là bắt buộc.`);
  return result;
}

function optional(value) {
  const result = String(value || "").trim();
  return result || null;
}

function normalizeRole(role) {
  return ["QuanLy", "Admin", "Manager"].includes(role) ? "QuanLy" : "NhanVien";
}

function normalizeStatus(status) {
  return status === "Inactive" ? "Inactive" : "Active";
}

function databaseFailure(error) {
  if (error.statusCode) return error;
  if (error.code === "23505") return Object.assign(error, { statusCode: 409, publicMessage: "Mã, tài khoản hoặc Email đã được sử dụng." });
  if (error.code === "23503") return Object.assign(error, { statusCode: 400, publicMessage: "Dữ liệu liên quan không tồn tại hoặc vẫn đang được sử dụng." });
  if (error.code === "22P02" || error.code === "23514") return Object.assign(error, { statusCode: 400, publicMessage: "Giá trị dữ liệu không hợp lệ." });
  return error;
}

async function getAdminData() {
  const pool = getPool();
  const [territories, customers, accounts] = await Promise.all([
    pool.query("select id_nhan_vien,id_dia_ban,is_primary from employee_territories order by id_nhan_vien,id_dia_ban"),
    pool.query("select id_nhan_vien,id_khach_hang from employee_customers order by id_nhan_vien,id_khach_hang"),
    pool.query("select id_nhan_vien,username from auth_credentials order by username")
  ]);
  return {
    employeeTerritories: territories.rows.map((row) => ({ employeeId: row.id_nhan_vien, territoryId: row.id_dia_ban, isPrimary: row.is_primary })),
    employeeCustomers: customers.rows.map((row) => ({ employeeId: row.id_nhan_vien, customerId: row.id_khach_hang })),
    accounts: accounts.rows.map((row) => ({ employeeId: row.id_nhan_vien, username: row.username }))
  };
}

async function saveEmployee(client, payload) {
  const id = required(payload.id, "Mã nhân viên");
  const name = required(payload.name, "Họ tên");
  const email = optional(payload.email)?.toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Email không hợp lệ.");
  const existing = await client.query("select id_nhan_vien from tb_nhan_su where id_nhan_vien=$1 for update", [id]);
  const credential = await client.query("select username from auth_credentials where id_nhan_vien=$1 for update", [id]);
  const username = optional(payload.username) || credential.rows[0]?.username || null;
  const password = String(payload.password || "");
  if (!existing.rows.length && (!username || !password)) fail("Nhân viên mới cần có tài khoản và mật khẩu.");
  if (password && !username) fail("Tài khoản là bắt buộc khi đặt mật khẩu.");
  if (username && !password && !credential.rows.length) fail("Cần nhập mật khẩu để tạo tài khoản mới.");

  await client.query(`insert into tb_nhan_su (id_nhan_vien,ten_nhan_vien,email,chuc_vu,trang_thai)
    values ($1,$2,$3,$4,$5)
    on conflict (id_nhan_vien) do update set ten_nhan_vien=excluded.ten_nhan_vien,email=excluded.email,
      chuc_vu=excluded.chuc_vu,trang_thai=excluded.trang_thai`,
  [id, name, email, normalizeRole(payload.role), normalizeStatus(payload.status)]);

  if (username) {
    const duplicate = await client.query("select 1 from auth_credentials where username=$1 and id_nhan_vien<>$2", [username, id]);
    if (duplicate.rows.length) fail("Tên tài khoản đã được sử dụng.", 409);
    if (password) {
      const hashed = hashPassword(password);
      await client.query("delete from auth_credentials where id_nhan_vien=$1", [id]);
      await client.query(`insert into auth_credentials (username,id_nhan_vien,password_salt,password_hash,iterations)
        values ($1,$2,$3,$4,$5)`, [username, id, hashed.passwordSalt, hashed.passwordHash, hashed.iterations]);
    } else if (credential.rows.length && username !== credential.rows[0].username) {
      await client.query("update auth_credentials set username=$1,updated_at=now() where id_nhan_vien=$2", [username, id]);
    }
  }
  return id;
}

async function deactivate(client, resource, payload, user) {
  const id = required(payload.id, "Mã dữ liệu");
  const tableByResource = {
    employee: ["tb_nhan_su", "id_nhan_vien"], territory: ["tb_dia_ban", "id_dia_ban"],
    product: ["tb_san_pham", "id_san_pham"], customer: ["tb_khach_hang", "id_khach_hang"]
  };
  const target = tableByResource[resource];
  if (!target) fail("Thao tác xóa không hợp lệ.");
  if (resource === "employee") {
    if (id === user.id) fail("Không thể vô hiệu hóa tài khoản đang đăng nhập.");
    const employee = await client.query("select chuc_vu from tb_nhan_su where id_nhan_vien=$1 for update", [id]);
    if (!employee.rows.length) fail("Không tìm thấy dữ liệu cần xóa.", 404);
    if (normalizeRole(employee.rows[0].chuc_vu) === "QuanLy") {
      const managers = await client.query("select count(*)::int as count from tb_nhan_su where trang_thai='Active' and chuc_vu in ('QuanLy','Admin','Manager')");
      if (managers.rows[0].count <= 1) fail("Hệ thống phải còn ít nhất một tài khoản Quản lý.");
    }
  }
  const result = await client.query(`update ${target[0]} set trang_thai='Inactive' where ${target[1]}=$1`, [id]);
  if (!result.rowCount) fail("Không tìm thấy dữ liệu cần xóa.", 404);
  return id;
}

async function saveResource(client, resource, payload) {
  if (resource === "employee") return saveEmployee(client, payload);
  if (resource === "territory") {
    const id = required(payload.id, "Mã địa bàn");
    await client.query(`insert into tb_dia_ban (id_dia_ban,ten_dia_ban,khu_vuc,trang_thai) values ($1,$2,$3,$4)
      on conflict (id_dia_ban) do update set ten_dia_ban=excluded.ten_dia_ban,khu_vuc=excluded.khu_vuc,trang_thai=excluded.trang_thai`,
    [id, required(payload.name, "Tên địa bàn"), required(payload.region, "Khu vực"), normalizeStatus(payload.status)]);
    return id;
  }
  if (resource === "product") {
    const id = required(payload.id, "Mã sản phẩm");
    const price = Number(payload.prescriptionPrice);
    if (!Number.isFinite(price) || price < 0) fail("Giá kê đơn không hợp lệ.");
    await client.query(`insert into tb_san_pham (id_san_pham,ten_san_pham,hoat_chat,dang_bao_che,mo_ta_dang_bao_che,quy_cach,gia_ke_don,trang_thai)
      values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id_san_pham) do update set ten_san_pham=excluded.ten_san_pham,
      hoat_chat=excluded.hoat_chat,dang_bao_che=excluded.dang_bao_che,mo_ta_dang_bao_che=excluded.mo_ta_dang_bao_che,
      quy_cach=excluded.quy_cach,gia_ke_don=excluded.gia_ke_don,trang_thai=excluded.trang_thai`,
    [id, required(payload.name, "Tên sản phẩm"), optional(payload.activeIngredient), required(payload.dosageCode, "Dạng bào chế"), required(payload.dosageForm, "Mô tả dạng bào chế"), optional(payload.packageSpec), price, normalizeStatus(payload.status)]);
    return id;
  }
  if (resource === "customer") {
    const id = required(payload.id, "Mã khách hàng");
    await client.query(`insert into tb_khach_hang (id_khach_hang,ten_khach_hang,loai_khach_hang,dia_chi,dien_thoai,id_dia_ban,trang_thai)
      values ($1,$2,$3,$4,$5,$6,$7) on conflict (id_khach_hang) do update set ten_khach_hang=excluded.ten_khach_hang,
      loai_khach_hang=excluded.loai_khach_hang,dia_chi=excluded.dia_chi,dien_thoai=excluded.dien_thoai,
      id_dia_ban=excluded.id_dia_ban,trang_thai=excluded.trang_thai`,
    [id, required(payload.name, "Tên khách hàng"), required(payload.type, "Loại khách hàng"), optional(payload.address), optional(payload.phone), required(payload.territoryId, "Địa bàn"), normalizeStatus(payload.status)]);
    return id;
  }
  if (resource === "employee_territory") {
    const employeeId = required(payload.employeeId, "Nhân viên");
    const territoryId = required(payload.territoryId, "Địa bàn");
    await client.query(`insert into employee_territories (id_nhan_vien,id_dia_ban,is_primary) values ($1,$2,$3)
      on conflict (id_nhan_vien,id_dia_ban) do update set is_primary=excluded.is_primary`, [employeeId, territoryId, Boolean(payload.isPrimary)]);
    return `${employeeId}:${territoryId}`;
  }
  if (resource === "employee_customer") {
    const employeeId = required(payload.employeeId, "Nhân viên");
    const customerId = required(payload.customerId, "Khách hàng");
    await client.query("insert into employee_customers (id_nhan_vien,id_khach_hang) values ($1,$2) on conflict do nothing", [employeeId, customerId]);
    return `${employeeId}:${customerId}`;
  }
  fail("Thao tác quản trị không hợp lệ.");
}

async function removeAssignment(client, resource, payload) {
  let result;
  let id;
  if (resource === "employee_territory") {
    id = `${required(payload.employeeId, "Nhân viên")}:${required(payload.territoryId, "Địa bàn")}`;
    result = await client.query("delete from employee_territories where id_nhan_vien=$1 and id_dia_ban=$2", [payload.employeeId, payload.territoryId]);
  } else if (resource === "employee_customer") {
    id = `${required(payload.employeeId, "Nhân viên")}:${required(payload.customerId, "Khách hàng")}`;
    result = await client.query("delete from employee_customers where id_nhan_vien=$1 and id_khach_hang=$2", [payload.employeeId, payload.customerId]);
  } else {
    fail("Thao tác xóa phân công không hợp lệ.");
  }
  if (!result.rowCount) fail("Không tìm thấy phân công.", 404);
  return id;
}

exports.handler = async (event) => {
  try {
    const user = await requireDatabaseUser(event);
    requireManager(user);
    if (event.httpMethod === "GET") return json(200, await getAdminData());
    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    const resource = body.resource;
    const action = body.action || "upsert";
    const payload = body.data || {};
    const client = await getPool().connect();
    try {
      await client.query("begin");
      let id;
      if (action === "deactivate") id = await deactivate(client, resource, payload, user);
      else if (action === "remove") id = await removeAssignment(client, resource, payload);
      else if (action === "upsert") id = await saveResource(client, resource, payload);
      else fail("Thao tác quản trị không hợp lệ.");
      await client.query("update app_state_revision set revision=revision+1,updated_at=now() where id=1");
      await client.query("commit");
      return json(200, { resource, action, id });
    } catch (error) {
      await client.query("rollback");
      throw databaseFailure(error);
    } finally {
      client.release();
    }
  } catch (error) {
    return handleError(error);
  }
};
