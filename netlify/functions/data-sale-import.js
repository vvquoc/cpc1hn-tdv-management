const crypto = require("node:crypto");
const { isAdmin, requireDatabaseUser } = require("./shared/auth");
const { getPool } = require("./shared/db");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

const SOURCE_SPREADSHEET_ID = "1hyw8e_UNJyfihxJjGcLUOPph_tc2gJm885F5pQabp0U";
const SOURCE_SHEET_ID = 990869057;
const SOURCE_TITLE = "DATA SALE TỪ 01.01.2025 ĐẾN 31.06.2026";
const HEADERS = ["Quản lý", "NV kinh doanh", "Tên NV KD", "Tỉnh", "Nhóm KH", "Tháng", "Năm", "Mã Kh", "Tên KH", "Ngày chứng từ", "Số Chứng từ ngoại", "Mã HH", "Tên HH", "DVT", "Số Lượng", "Đơn giá", "Doanh thu", "Hệ số", "DOANH SỐ"];

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  throw error;
}

function text(row, key) {
  return String(row[key] ?? "").trim();
}

function numeric(value, label) {
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(/,/g, "");
  const result = Number(normalized);
  if (!Number.isFinite(result)) fail(`${label} không phải là số hợp lệ.`);
  return result;
}

function employeeCode(value) {
  const code = String(value ?? "").trim();
  return /^\d{1,6}$/.test(code) ? code.padStart(6, "0") : code;
}

function isoDate(value) {
  if (typeof value === "number" || /^\d{5}(?:\.\d+)?$/.test(String(value || "").trim())) {
    const serial = Number(value);
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) fail("Ngày chứng từ không hợp lệ.");
  const first = Number(match[1]);
  const second = Number(match[2]);
  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;
  const result = `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (dateValueIsInvalid(result)) fail("Ngày chứng từ không tồn tại.");
  return result;
}

function dateValueIsInvalid(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value;
}

function slug(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28);
}

function customerType(group) {
  const normalized = slug(group);
  if (normalized.includes("PHONG_MACH") || normalized.includes("PHONG_KHAM")) return "PhongMachTu";
  if (normalized.includes("SO_Y_TE")) return "SoYTe";
  return "BenhVien";
}

function normalizeRow(row, rowNumber) {
  const missing = HEADERS.find((header) => !Object.prototype.hasOwnProperty.call(row, header));
  if (missing) fail(`Dòng ${rowNumber} thiếu cột ${missing}.`);
  const month = numeric(row["Tháng"], "Tháng");
  const year = numeric(row["Năm"], "Năm");
  if (!Number.isInteger(month) || month < 1 || month > 12) fail(`Dòng ${rowNumber}: Tháng không hợp lệ.`);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) fail(`Dòng ${rowNumber}: Năm không hợp lệ.`);
  const normalized = {
    managerName: text(row, "Quản lý"), employeeCode: employeeCode(row["NV kinh doanh"]), employeeName: text(row, "Tên NV KD"),
    province: text(row, "Tỉnh"), customerGroup: text(row, "Nhóm KH"), month, year,
    customerCode: text(row, "Mã Kh"), customerName: text(row, "Tên KH"), documentDate: isoDate(row["Ngày chứng từ"]),
    externalDocument: text(row, "Số Chứng từ ngoại"), productCode: text(row, "Mã HH"), productName: text(row, "Tên HH"),
    unit: text(row, "DVT"), quantity: numeric(row["Số Lượng"], "Số Lượng"), unitPrice: numeric(row["Đơn giá"], "Đơn giá"),
    revenue: numeric(row["Doanh thu"], "Doanh thu"), coefficient: numeric(row["Hệ số"], "Hệ số"), sales: numeric(row["DOANH SỐ"], "DOANH SỐ")
  };
  for (const [key, value] of Object.entries(normalized)) if (typeof value === "string" && !value) fail(`Dòng ${rowNumber}: ${key} không được để trống.`);
  normalized.rowHash = crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return normalized;
}

async function upsertMasters(client, row, cache) {
  const territoryId = `SALE_DB_${slug(row.province)}`;
  if (!cache.territories.has(territoryId)) {
    await client.query("insert into tb_dia_ban (id_dia_ban,ten_dia_ban,khu_vuc) values ($1,$2,'DATA SALE') on conflict (id_dia_ban) do update set ten_dia_ban=excluded.ten_dia_ban", [territoryId, row.province]);
    cache.territories.add(territoryId);
  }

  let employeeId = cache.employees.get(row.employeeCode);
  if (!employeeId) {
    const employee = await client.query("select id_nhan_vien from tb_nhan_su where ma_nhan_vien_sale=$1", [row.employeeCode]);
    employeeId = employee.rows[0]?.id_nhan_vien || `SALE_NV_${slug(row.employeeCode)}`;
    if (!employee.rows.length) await client.query("insert into tb_nhan_su (id_nhan_vien,ten_nhan_vien,email,chuc_vu,ma_nhan_vien_sale) values ($1,$2,$3,'NhanVien',$4) on conflict (id_nhan_vien) do update set ten_nhan_vien=excluded.ten_nhan_vien,ma_nhan_vien_sale=excluded.ma_nhan_vien_sale", [employeeId,row.employeeName,`sale-${slug(row.employeeCode).toLowerCase()}@cpc1hn.local`,row.employeeCode]);
    cache.employees.set(row.employeeCode, employeeId);
  }
  const territoryAssignment = `${employeeId}|${territoryId}`;
  if (!cache.employeeTerritories.has(territoryAssignment)) {
    await client.query("insert into employee_territories (id_nhan_vien,id_dia_ban,is_primary) values ($1,$2,true) on conflict (id_nhan_vien,id_dia_ban) do nothing", [employeeId,territoryId]);
    cache.employeeTerritories.add(territoryAssignment);
  }

  let customerId = cache.customers.get(row.customerCode);
  if (!customerId) {
    const customer = await client.query("select id_khach_hang from tb_khach_hang where ma_khach_hang_sale=$1", [row.customerCode]);
    customerId = customer.rows[0]?.id_khach_hang || `SALE_KH_${slug(row.customerCode)}`;
    await client.query("insert into tb_khach_hang (id_khach_hang,ten_khach_hang,loai_khach_hang,id_dia_ban,ma_khach_hang_sale,nhom_khach_hang_sale) values ($1,$2,$3,$4,$5,$6) on conflict (id_khach_hang) do update set ten_khach_hang=excluded.ten_khach_hang,loai_khach_hang=excluded.loai_khach_hang,id_dia_ban=excluded.id_dia_ban,nhom_khach_hang_sale=excluded.nhom_khach_hang_sale", [customerId,row.customerName,customerType(row.customerGroup),territoryId,row.customerCode,row.customerGroup]);
    cache.customers.set(row.customerCode, customerId);
  }
  const customerAssignment = `${employeeId}|${customerId}`;
  if (!cache.employeeCustomers.has(customerAssignment)) {
    await client.query("insert into employee_customers (id_nhan_vien,id_khach_hang) values ($1,$2) on conflict do nothing", [employeeId,customerId]);
    cache.employeeCustomers.add(customerAssignment);
  }

  let productId = cache.products.get(row.productCode);
  if (!productId) {
    const product = await client.query("select id_san_pham from tb_san_pham where ma_hang_hoa_sale=$1", [row.productCode]);
    productId = product.rows[0]?.id_san_pham || `SALE_SP_${slug(row.productCode)}`;
    await client.query("insert into tb_san_pham (id_san_pham,ten_san_pham,dang_bao_che,mo_ta_dang_bao_che,gia_ke_don,ma_hang_hoa_sale,don_vi_tinh_sale) values ($1,$2,'Khac','Chưa phân loại từ DATA SALE',$3,$4,$5) on conflict (id_san_pham) do update set ten_san_pham=excluded.ten_san_pham,gia_ke_don=excluded.gia_ke_don,don_vi_tinh_sale=excluded.don_vi_tinh_sale", [productId,row.productName,Math.max(0,row.unitPrice),row.productCode,row.unit]);
    cache.products.set(row.productCode, productId);
  }
  return { territoryId, employeeId, customerId, productId };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();
  try {
    const user = await requireDatabaseUser(event);
    if (!isAdmin(user)) fail("Chỉ Quản lý được nhập DATA SALE.", 403);
    const body = parseBody(event);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length || rows.length > 1000) fail("Mỗi lượt nhập DATA SALE cần từ 1 đến 1.000 dòng.");
    const startRow = Number(body.startRow || 2);
    if (!Number.isInteger(startRow) || startRow < 2) fail("Số dòng bắt đầu không hợp lệ.");
    const normalizedRows = rows.map((row, index) => normalizeRow(row, startRow + index));
    const client = await getPool().connect();
    let batchId = body.batchId || null;
    try {
      await client.query("begin");
      if (!batchId) {
        const batch = await client.query("insert into data_sale_import_batches (source_spreadsheet_id,source_sheet_id,source_title,imported_by) values ($1,$2,$3,$4) returning id", [SOURCE_SPREADSHEET_ID,SOURCE_SHEET_ID,SOURCE_TITLE,user.id]);
        batchId = batch.rows[0].id;
      } else {
        const batch = await client.query("select id from data_sale_import_batches where id=$1 and status='Processing' for update", [batchId]);
        if (!batch.rows.length) fail("Phiên import không còn hiệu lực.", 409);
      }
      const cache = { territories: new Set(), employees: new Map(), customers: new Map(), products: new Map(), employeeTerritories: new Set(), employeeCustomers: new Set() };
      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];
        const ids = await upsertMasters(client, row, cache);
        await client.query(`insert into data_sale_transactions (import_batch_id,source_spreadsheet_id,source_sheet_id,source_row_number,row_hash,ten_quan_ly,ma_nhan_vien,ten_nhan_vien,tinh,nhom_khach_hang,thang,nam,ma_khach_hang,ten_khach_hang,ngay_chung_tu,so_chung_tu_ngoai,ma_hang_hoa,ten_hang_hoa,don_vi_tinh,so_luong,don_gia,doanh_thu,he_so,doanh_so,id_nhan_vien,id_khach_hang,id_san_pham)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
          on conflict (source_spreadsheet_id,source_sheet_id,source_row_number) do update set import_batch_id=excluded.import_batch_id,row_hash=excluded.row_hash,ten_quan_ly=excluded.ten_quan_ly,ma_nhan_vien=excluded.ma_nhan_vien,ten_nhan_vien=excluded.ten_nhan_vien,tinh=excluded.tinh,nhom_khach_hang=excluded.nhom_khach_hang,thang=excluded.thang,nam=excluded.nam,ma_khach_hang=excluded.ma_khach_hang,ten_khach_hang=excluded.ten_khach_hang,ngay_chung_tu=excluded.ngay_chung_tu,so_chung_tu_ngoai=excluded.so_chung_tu_ngoai,ma_hang_hoa=excluded.ma_hang_hoa,ten_hang_hoa=excluded.ten_hang_hoa,don_vi_tinh=excluded.don_vi_tinh,so_luong=excluded.so_luong,don_gia=excluded.don_gia,doanh_thu=excluded.doanh_thu,he_so=excluded.he_so,doanh_so=excluded.doanh_so,id_nhan_vien=excluded.id_nhan_vien,id_khach_hang=excluded.id_khach_hang,id_san_pham=excluded.id_san_pham,updated_at=now()`, [batchId,SOURCE_SPREADSHEET_ID,SOURCE_SHEET_ID,startRow+index,row.rowHash,row.managerName,row.employeeCode,row.employeeName,row.province,row.customerGroup,row.month,row.year,row.customerCode,row.customerName,row.documentDate,row.externalDocument,row.productCode,row.productName,row.unit,row.quantity,row.unitPrice,row.revenue,row.coefficient,row.sales,ids.employeeId,ids.customerId,ids.productId]);
      }
      await client.query("update data_sale_import_batches set row_count=row_count+$2, status=case when $3 then 'Completed' else status end, finished_at=case when $3 then now() else finished_at end where id=$1", [batchId,rows.length,Boolean(body.final)]);
      await client.query("update app_state_revision set revision=revision+1,updated_at=now() where id=1");
      await client.query("commit");
      return json(200, { batchId, imported: rows.length, nextRow: startRow + rows.length, completed: Boolean(body.final) });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleError(error);
  }
};
