const { one, query } = require("./shared/db");
const { isAdmin, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const crypto = require("node:crypto");

function requireAdmin(user) {
  if (!isAdmin(user)) {
    const error = new Error("Admin permission required");
    error.statusCode = 403;
    error.publicMessage = "Chỉ Quản lý được quản trị dữ liệu.";
    throw error;
  }
}

async function upsertTerritory(data) {
  return one(
    `insert into tb_dia_ban (id_dia_ban, ten_dia_ban, khu_vuc)
     values ($1, $2, $3)
     on conflict (id_dia_ban)
     do update set ten_dia_ban = excluded.ten_dia_ban,
                   khu_vuc = excluded.khu_vuc
     returning id_dia_ban as id`,
    [data.id, data.name, data.region]
  );
}

async function upsertEmployee(data) {
  const role = ["QuanLy", "Admin", "Manager"].includes(data.role) ? "QuanLy" : "NhanVien";
  const employee = await one(
    `insert into tb_nhan_su (id_nhan_vien, ten_nhan_vien, email, chuc_vu, trang_thai)
     values ($1, $2, lower($3), $4, coalesce($5, 'Active'))
     on conflict (id_nhan_vien)
     do update set ten_nhan_vien = excluded.ten_nhan_vien,
                   email = excluded.email,
                   chuc_vu = excluded.chuc_vu,
                   trang_thai = excluded.trang_thai
     returning id_nhan_vien as id`,
    [data.id, data.name, data.email, role, data.status || "Active"]
  );

  if (data.username && data.password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const iterations = 210000;
    const passwordHash = crypto.pbkdf2Sync(String(data.password), salt, iterations, 32, "sha256").toString("hex");
    await query(
      `insert into auth_credentials (username, id_nhan_vien, password_salt, password_hash, iterations)
       values ($1, $2, $3, $4, $5)
       on conflict (username)
       do update set id_nhan_vien = excluded.id_nhan_vien,
                     password_salt = excluded.password_salt,
                     password_hash = excluded.password_hash,
                     iterations = excluded.iterations,
                     updated_at = now()`,
      [String(data.username).trim(), data.id, salt, passwordHash, iterations]
    );
  }

  return employee;
}

async function upsertProduct(data) {
  return one(
    `insert into tb_san_pham (
       id_san_pham, ten_san_pham, hoat_chat, dang_bao_che, mo_ta_dang_bao_che, quy_cach, gia_ke_don, trang_thai
     ) values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 'Active'))
     on conflict (id_san_pham)
     do update set ten_san_pham = excluded.ten_san_pham,
                   hoat_chat = excluded.hoat_chat,
                   dang_bao_che = excluded.dang_bao_che,
                   mo_ta_dang_bao_che = excluded.mo_ta_dang_bao_che,
                   quy_cach = excluded.quy_cach,
                   gia_ke_don = excluded.gia_ke_don,
                   trang_thai = excluded.trang_thai
     returning id_san_pham as id`,
    [
      data.id,
      data.name,
      data.activeIngredient || null,
      data.dosageCode,
      data.dosageForm,
      data.packageSpec || null,
      Number(data.prescriptionPrice || 0),
      data.status || "Active"
    ]
  );
}

async function upsertCustomer(data) {
  return one(
    `insert into tb_khach_hang (
       id_khach_hang, ten_khach_hang, loai_khach_hang, dia_chi, dien_thoai, id_dia_ban, trang_thai
     ) values ($1, $2, $3, $4, $5, $6, coalesce($7, 'Active'))
     on conflict (id_khach_hang)
     do update set ten_khach_hang = excluded.ten_khach_hang,
                   loai_khach_hang = excluded.loai_khach_hang,
                   dia_chi = excluded.dia_chi,
                   dien_thoai = excluded.dien_thoai,
                   id_dia_ban = excluded.id_dia_ban,
                   trang_thai = excluded.trang_thai
     returning id_khach_hang as id`,
    [data.id, data.name, data.type, data.address || null, data.phone || null, data.territoryId, data.status || "Active"]
  );
}

async function assignTerritory(data) {
  return one(
    `insert into employee_territories (id_nhan_vien, id_dia_ban, is_primary)
     values ($1, $2, $3)
     on conflict (id_nhan_vien, id_dia_ban)
     do update set is_primary = excluded.is_primary
     returning id_nhan_vien || ':' || id_dia_ban as id`,
    [data.employeeId, data.territoryId, Boolean(data.isPrimary)]
  );
}

async function assignCustomer(data) {
  return one(
    `insert into employee_customers (id_nhan_vien, id_khach_hang)
     values ($1, $2)
     on conflict (id_nhan_vien, id_khach_hang) do nothing
     returning id_nhan_vien || ':' || id_khach_hang as id`,
    [data.employeeId, data.customerId]
  );
}

async function deactivate(resource, id) {
  const tableByResource = {
    employee: ["tb_nhan_su", "id_nhan_vien"],
    product: ["tb_san_pham", "id_san_pham"],
    customer: ["tb_khach_hang", "id_khach_hang"]
  };
  const target = tableByResource[resource];
  if (!target) return null;
  const [table, idColumn] = target;
  return one(
    `update ${table}
     set trang_thai = 'Inactive'
     where ${idColumn} = $1
     returning ${idColumn} as id`,
    [id]
  );
}

async function removeAssignment(resource, data) {
  if (resource === "employee_territory") {
    await query(
      `delete from employee_territories
       where id_nhan_vien = $1 and id_dia_ban = $2`,
      [data.employeeId, data.territoryId]
    );
    return { id: `${data.employeeId}:${data.territoryId}` };
  }

  if (resource === "employee_customer") {
    await query(
      `delete from employee_customers
       where id_nhan_vien = $1 and id_khach_hang = $2`,
      [data.employeeId, data.customerId]
    );
    return { id: `${data.employeeId}:${data.customerId}` };
  }

  return null;
}

async function getAssignments() {
  const [employeeTerritories, employeeCustomers] = await Promise.all([
    query(
      `select id_nhan_vien as "employeeId", id_dia_ban as "territoryId", is_primary as "isPrimary"
       from employee_territories
       order by id_nhan_vien, id_dia_ban`
    ),
    query(
      `select id_nhan_vien as "employeeId", id_khach_hang as "customerId"
       from employee_customers
       order by id_nhan_vien, id_khach_hang`
    )
  ]);

  return { employeeTerritories, employeeCustomers };
}

exports.handler = async (event) => {
  try {
    const user = await requireUser(event);
    requireAdmin(user);

    if (event.httpMethod === "GET") {
      return json(200, await getAssignments());
    }

    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    const { resource, action = "upsert", data = {} } = body;
    let result;

    if (action === "deactivate") {
      result = await deactivate(resource, data.id);
    } else if (action === "remove") {
      result = await removeAssignment(resource, data);
    } else if (resource === "territory") {
      result = await upsertTerritory(data);
    } else if (resource === "employee") {
      result = await upsertEmployee(data);
    } else if (resource === "product") {
      result = await upsertProduct(data);
    } else if (resource === "customer") {
      result = await upsertCustomer(data);
    } else if (resource === "employee_territory") {
      result = await assignTerritory(data);
    } else if (resource === "employee_customer") {
      result = await assignCustomer(data);
    }

    if (!result) return json(400, { error: "Thao tác quản trị không hợp lệ." });
    return json(200, { resource, action, id: result.id });
  } catch (error) {
    return handleError(error);
  }
};
