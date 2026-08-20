const { isAdmin, requireDatabaseUser } = require("./shared/auth");
const { hashPassword } = require("./shared/credentials");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { loadData } = require("./shared/store");

function fail(publicMessage, statusCode = 400) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  throw error;
}

function value(row, aliases) {
  return aliases.map((key) => row[key]).find((item) => item !== undefined && item !== null && String(item).trim() !== "");
}

function text(row, aliases, fallback = "") {
  return String(value(row, aliases) ?? fallback).trim();
}

function number(row, aliases, fallback = 0) {
  const result = Number(value(row, aliases) ?? fallback);
  if (!Number.isFinite(result)) fail(`Giá trị ${aliases[0]} không phải là số hợp lệ.`);
  return result;
}

function bool(row, aliases) {
  return ["true", "1", "yes", "x", "có"].includes(text(row, aliases).toLowerCase());
}

function role(row) {
  return ["QuanLy", "Admin", "Manager"].includes(text(row, ["chuc_vu", "role"])) ? "QuanLy" : "NhanVien";
}

function status(row) {
  return text(row, ["trang_thai", "status"], "Active") === "Inactive" ? "Inactive" : "Active";
}

function validateImportRow(resource, row, rowNumber) {
  const requiredByResource = {
    employees: [["id_nhan_vien", "id"], ["ten_nhan_vien", "name"]],
    territories: [["id_dia_ban", "id"], ["ten_dia_ban", "name"], ["khu_vuc", "region"]],
    products: [["id_san_pham", "id"], ["ten_san_pham", "name"], ["dang_bao_che", "dosageCode"], ["mo_ta_dang_bao_che", "dosageForm"]],
    customers: [["id_khach_hang", "id"], ["ten_khach_hang", "name"], ["loai_khach_hang", "type"], ["id_dia_ban", "territoryId"]],
    employeeTerritories: [["id_nhan_vien", "employeeId"], ["id_dia_ban", "territoryId"]],
    employeeCustomers: [["id_nhan_vien", "employeeId"], ["id_khach_hang", "customerId"]],
    prescriptions: [["ngay_bao_cao", "date"], ["id_nhan_vien", "employeeId"], ["id_khach_hang", "customerId"], ["id_san_pham", "productId"], ["so_luong_ke_don", "quantity"]],
    sales: [["thang_nam", "period"], ["id_nhan_vien", "employeeId"], ["id_khach_hang", "customerId"], ["id_san_pham", "productId"], ["doanh_so_thuc", "amount"]],
    tenders: [["id_goi_thau", "id"], ["id_nhan_vien", "employeeId"], ["id_khach_hang", "customerId"], ["id_san_pham", "productId"]],
    dailyReports: [["report_date", "date"], ["id_nhan_vien", "employeeId"], ["summary"]],
    kpiTargets: [["thang_nam", "period"], ["id_nhan_vien", "employeeId"]]
  };
  const groups = requiredByResource[resource];
  if (!groups) fail("Loại dữ liệu import chưa được hỗ trợ.");
  const missing = groups.find((aliases) => value(row, aliases) === undefined);
  if (missing) fail(`Dòng ${rowNumber} thiếu cột bắt buộc: ${missing.join(" hoặc ")}.`);
}

async function importEmployee(client, row) {
  const id = text(row, ["id_nhan_vien", "id"]);
  const email = text(row, ["email"]) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Email của nhân viên ${id} không hợp lệ.`);
  await client.query(`insert into tb_nhan_su (id_nhan_vien,ten_nhan_vien,email,chuc_vu,trang_thai)
    values ($1,$2,$3,$4,$5) on conflict (id_nhan_vien) do update set ten_nhan_vien=excluded.ten_nhan_vien,
    email=excluded.email,chuc_vu=excluded.chuc_vu,trang_thai=excluded.trang_thai`,
  [id, text(row, ["ten_nhan_vien", "name"]), email, role(row), status(row)]);
  const username = text(row, ["tai_khoan", "username"]);
  const password = text(row, ["mat_khau", "password"]);
  if (username || password) {
    if (!username || !password) fail(`Nhân viên ${id} phải có đủ tài khoản và mật khẩu.`);
    const duplicate = await client.query("select 1 from auth_credentials where username=$1 and id_nhan_vien<>$2", [username, id]);
    if (duplicate.rows.length) fail(`Tài khoản ${username} đã được sử dụng.`, 409);
    const hashed = hashPassword(password);
    await client.query("delete from auth_credentials where id_nhan_vien=$1", [id]);
    await client.query("insert into auth_credentials (username,id_nhan_vien,password_salt,password_hash,iterations) values ($1,$2,$3,$4,$5)",
      [username, id, hashed.passwordSalt, hashed.passwordHash, hashed.iterations]);
  }
}

async function importRow(client, resource, row) {
  if (resource === "employees") return importEmployee(client, row);
  if (resource === "territories") return client.query(`insert into tb_dia_ban (id_dia_ban,ten_dia_ban,khu_vuc,trang_thai) values ($1,$2,$3,$4)
    on conflict (id_dia_ban) do update set ten_dia_ban=excluded.ten_dia_ban,khu_vuc=excluded.khu_vuc,trang_thai=excluded.trang_thai`,
  [text(row, ["id_dia_ban", "id"]), text(row, ["ten_dia_ban", "name"]), text(row, ["khu_vuc", "region"]), status(row)]);
  if (resource === "products") return client.query(`insert into tb_san_pham (id_san_pham,ten_san_pham,hoat_chat,dang_bao_che,mo_ta_dang_bao_che,quy_cach,gia_ke_don,trang_thai)
    values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id_san_pham) do update set ten_san_pham=excluded.ten_san_pham,
    hoat_chat=excluded.hoat_chat,dang_bao_che=excluded.dang_bao_che,mo_ta_dang_bao_che=excluded.mo_ta_dang_bao_che,
    quy_cach=excluded.quy_cach,gia_ke_don=excluded.gia_ke_don,trang_thai=excluded.trang_thai`,
  [text(row, ["id_san_pham", "id"]), text(row, ["ten_san_pham", "name"]), text(row, ["hoat_chat", "activeIngredient"]) || null,
    text(row, ["dang_bao_che", "dosageCode"]), text(row, ["mo_ta_dang_bao_che", "dosageForm"]), text(row, ["quy_cach", "packageSpec"]) || null,
    number(row, ["gia_ke_don", "prescriptionPrice"]), status(row)]);
  if (resource === "customers") return client.query(`insert into tb_khach_hang (id_khach_hang,ten_khach_hang,loai_khach_hang,dia_chi,dien_thoai,id_dia_ban,trang_thai)
    values ($1,$2,$3,$4,$5,$6,$7) on conflict (id_khach_hang) do update set ten_khach_hang=excluded.ten_khach_hang,
    loai_khach_hang=excluded.loai_khach_hang,dia_chi=excluded.dia_chi,dien_thoai=excluded.dien_thoai,id_dia_ban=excluded.id_dia_ban,trang_thai=excluded.trang_thai`,
  [text(row, ["id_khach_hang", "id"]), text(row, ["ten_khach_hang", "name"]), text(row, ["loai_khach_hang", "type"]),
    text(row, ["dia_chi", "address"]) || null, text(row, ["dien_thoai", "phone"]) || null, text(row, ["id_dia_ban", "territoryId"]), status(row)]);
  if (resource === "employeeTerritories") return client.query(`insert into employee_territories (id_nhan_vien,id_dia_ban,is_primary) values ($1,$2,$3)
    on conflict (id_nhan_vien,id_dia_ban) do update set is_primary=excluded.is_primary`,
  [text(row, ["id_nhan_vien", "employeeId"]), text(row, ["id_dia_ban", "territoryId"]), bool(row, ["is_primary", "isPrimary"])]);
  if (resource === "employeeCustomers") return client.query("insert into employee_customers (id_nhan_vien,id_khach_hang) values ($1,$2) on conflict do nothing",
    [text(row, ["id_nhan_vien", "employeeId"]), text(row, ["id_khach_hang", "customerId"])]);
  if (resource === "prescriptions") return client.query(`insert into tb_ke_don (ngay_bao_cao,id_nhan_vien,id_khach_hang,id_san_pham,so_luong_ke_don,doanh_so_phat_sinh)
    values ($1,$2,$3,$4,$5,$6)`, [text(row, ["ngay_bao_cao", "date"]), text(row, ["id_nhan_vien", "employeeId"]),
    text(row, ["id_khach_hang", "customerId"]), text(row, ["id_san_pham", "productId"]), number(row, ["so_luong_ke_don", "quantity"]), number(row, ["doanh_so_phat_sinh", "amount"])]);
  if (resource === "sales") return client.query(`insert into tb_doanh_thu (thang_nam,id_nhan_vien,id_khach_hang,id_san_pham,doanh_so_thuc,source_note)
    values ($1,$2,$3,$4,$5,'Import website') on conflict (thang_nam,id_khach_hang,id_san_pham) do update set
    id_nhan_vien=excluded.id_nhan_vien,doanh_so_thuc=excluded.doanh_so_thuc,source_note=excluded.source_note`,
  [text(row, ["thang_nam", "period"]), text(row, ["id_nhan_vien", "employeeId"]), text(row, ["id_khach_hang", "customerId"]),
    text(row, ["id_san_pham", "productId"]), number(row, ["doanh_so_thuc", "amount"])]);
  if (resource === "tenders") return client.query(`insert into tb_thau (id_goi_thau,id_nhan_vien,id_khach_hang,id_san_pham,so_luong_thau,gia_du_thau,trang_thai,han_nop,ngay_cap_nhat)
    values ($1,$2,$3,$4,$5,$6,$7,$8,current_date) on conflict (id_goi_thau) do update set id_nhan_vien=excluded.id_nhan_vien,
    id_khach_hang=excluded.id_khach_hang,id_san_pham=excluded.id_san_pham,so_luong_thau=excluded.so_luong_thau,
    gia_du_thau=excluded.gia_du_thau,trang_thai=excluded.trang_thai,han_nop=excluded.han_nop,ngay_cap_nhat=current_date`,
  [text(row, ["id_goi_thau", "id"]), text(row, ["id_nhan_vien", "employeeId"]), text(row, ["id_khach_hang", "customerId"]),
    text(row, ["id_san_pham", "productId"]), number(row, ["so_luong_thau", "quantity"]), number(row, ["gia_du_thau", "bidPrice"]),
    text(row, ["trang_thai", "status"], "DangLamHoSo"), text(row, ["han_nop", "dueDate"]) || null]);
  if (resource === "dailyReports") return client.query(`insert into daily_reports (report_date,id_nhan_vien,summary,kpi_note) values ($1,$2,$3,$4)
    on conflict (report_date,id_nhan_vien) do update set summary=excluded.summary,kpi_note=excluded.kpi_note`,
  [text(row, ["report_date", "date"]), text(row, ["id_nhan_vien", "employeeId"]), text(row, ["summary"]), text(row, ["kpi_note", "kpiNote"]) || null]);
  if (resource === "kpiTargets") {
    const values = [text(row, ["thang_nam", "period"]), text(row, ["id_nhan_vien", "employeeId"]), text(row, ["id_dia_ban", "territoryId"]) || null,
      text(row, ["id_san_pham", "productId"]) || null, number(row, ["target_sales", "targetSales"]), number(row, ["target_prescriptions", "targetPrescriptions"])];
    const updated = await client.query(`update kpi_targets set id_dia_ban=$3,target_sales=$5,target_prescriptions=$6
      where thang_nam=$1 and id_nhan_vien=$2 and id_san_pham is not distinct from $4`, values);
    if (!updated.rowCount) await client.query("insert into kpi_targets (thang_nam,id_nhan_vien,id_dia_ban,id_san_pham,target_sales,target_prescriptions) values ($1,$2,$3,$4,$5,$6)", values);
    return;
  }
  fail("Loại dữ liệu import chưa được hỗ trợ.");
}

function databaseFailure(error) {
  if (error.statusCode) return error;
  if (error.code === "23505") return Object.assign(error, { statusCode: 409, publicMessage: "Dữ liệu import bị trùng mã hoặc tài khoản." });
  if (error.code === "23503") return Object.assign(error, { statusCode: 400, publicMessage: "Dữ liệu import tham chiếu đến mã chưa tồn tại." });
  if (error.code === "22P02" || error.code === "23514" || error.code === "22007") return Object.assign(error, { statusCode: 400, publicMessage: "Dữ liệu import có ngày, số hoặc trạng thái không hợp lệ." });
  return error;
}

exports.handler = async (event) => {
  try {
    const user = await requireDatabaseUser(event);
    if (!isAdmin(user)) fail("Chỉ Quản lý được import/export dữ liệu.", 403);
    if (event.httpMethod === "GET") {
      const { credentials, sessions, ...exportable } = await loadData();
      return json(200, { exportedAt: new Date().toISOString(), ...exportable });
    }
    if (event.httpMethod !== "POST") return methodNotAllowed();
    const body = parseBody(event);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) fail("File import không có dòng dữ liệu.");
    if (rows.length > 1000) fail("Mỗi lượt chỉ được import tối đa 1.000 dòng.");
    rows.forEach((row, index) => validateImportRow(body.resource, row, Number(body.startRow || 2) + index));

    const client = await getPool().connect();
    try {
      await client.query("begin");
      for (const row of rows) await importRow(client, body.resource, row);
      await client.query("update app_state_revision set revision=revision+1,updated_at=now() where id=1");
      await client.query("commit");
      return json(200, { resource: body.resource, imported: rows.length });
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
