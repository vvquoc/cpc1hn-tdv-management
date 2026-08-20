const { getPool } = require("./shared/db");
const { requireAutomationSecret } = require("./shared/automation-auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

const importers = {
  tb_dia_ban: {
    columns: ["id_dia_ban", "ten_dia_ban", "khu_vuc"],
    required: ["id_dia_ban", "ten_dia_ban", "khu_vuc"],
    conflict: ["id_dia_ban"]
  },
  tb_nhan_su: {
    columns: ["id_nhan_vien", "ten_nhan_vien", "email", "chuc_vu", "trang_thai"],
    required: ["id_nhan_vien", "ten_nhan_vien", "email", "chuc_vu"],
    conflict: ["id_nhan_vien"],
    defaults: { trang_thai: "Active" }
  },
  employee_territories: {
    columns: ["id_nhan_vien", "id_dia_ban", "is_primary"],
    required: ["id_nhan_vien", "id_dia_ban"],
    conflict: ["id_nhan_vien", "id_dia_ban"],
    defaults: { is_primary: false }
  },
  tb_san_pham: {
    columns: ["id_san_pham", "ten_san_pham", "hoat_chat", "dang_bao_che", "mo_ta_dang_bao_che", "quy_cach", "gia_ke_don", "trang_thai"],
    required: ["id_san_pham", "ten_san_pham", "dang_bao_che", "mo_ta_dang_bao_che", "gia_ke_don"],
    conflict: ["id_san_pham"],
    defaults: { trang_thai: "Active" }
  },
  tb_khach_hang: {
    columns: ["id_khach_hang", "ten_khach_hang", "loai_khach_hang", "dia_chi", "dien_thoai", "id_dia_ban", "trang_thai"],
    required: ["id_khach_hang", "ten_khach_hang", "loai_khach_hang", "id_dia_ban"],
    conflict: ["id_khach_hang"],
    defaults: { trang_thai: "Active" }
  },
  employee_customers: {
    columns: ["id_nhan_vien", "id_khach_hang"],
    required: ["id_nhan_vien", "id_khach_hang"],
    conflict: ["id_nhan_vien", "id_khach_hang"]
  },
  tb_ke_don: {
    columns: ["ngay_bao_cao", "id_nhan_vien", "id_khach_hang", "id_san_pham", "so_luong_ke_don", "doanh_so_phat_sinh"],
    required: ["ngay_bao_cao", "id_nhan_vien", "id_khach_hang", "id_san_pham", "so_luong_ke_don"],
    insertOnly: true
  },
  tb_doanh_thu: {
    columns: ["thang_nam", "id_khach_hang", "id_san_pham", "id_nhan_vien", "doanh_so_thuc", "source_note"],
    required: ["thang_nam", "id_khach_hang", "id_san_pham", "id_nhan_vien", "doanh_so_thuc"],
    conflict: ["thang_nam", "id_khach_hang", "id_san_pham"]
  },
  tb_thau: {
    columns: ["id_goi_thau", "id_khach_hang", "id_san_pham", "so_luong_thau", "gia_du_thau", "trang_thai", "id_nhan_vien", "han_nop", "ngay_cap_nhat"],
    required: ["id_goi_thau", "id_khach_hang", "id_san_pham", "trang_thai", "id_nhan_vien"],
    conflict: ["id_goi_thau"]
  },
  daily_reports: {
    columns: ["report_date", "id_nhan_vien", "summary", "kpi_note"],
    required: ["report_date", "id_nhan_vien", "summary"],
    conflict: ["report_date", "id_nhan_vien"]
  },
  kpi_targets: {
    columns: ["thang_nam", "id_nhan_vien", "id_dia_ban", "id_san_pham", "target_sales", "target_prescriptions"],
    required: ["thang_nam", "id_nhan_vien", "target_sales", "target_prescriptions"],
    conflict: ["thang_nam", "id_nhan_vien", "id_san_pham"],
    defaults: { target_sales: 0, target_prescriptions: 0 }
  }
};

const numericColumns = new Set([
  "gia_ke_don",
  "so_luong_ke_don",
  "doanh_so_phat_sinh",
  "doanh_so_thuc",
  "so_luong_thau",
  "gia_du_thau",
  "target_sales",
  "target_prescriptions"
]);

function normalizeValue(column, value) {
  if (value === undefined || value === "") return null;
  if (column === "is_primary") {
    return value === true || String(value).toLowerCase() === "true" || String(value) === "1";
  }
  if (numericColumns.has(column)) {
    return Number(String(value).replaceAll(",", ""));
  }
  return String(value).trim();
}

function normalizeRow(config, row, rowIndex) {
  const normalized = {};

  for (const column of config.columns) {
    const raw = Object.prototype.hasOwnProperty.call(row, column)
      ? row[column]
      : config.defaults && Object.prototype.hasOwnProperty.call(config.defaults, column)
        ? config.defaults[column]
        : null;
    normalized[column] = normalizeValue(column, raw);
  }

  for (const column of config.required) {
    if (normalized[column] === null || normalized[column] === undefined || normalized[column] === "") {
      throw new Error(`Dòng ${rowIndex}: thiếu cột bắt buộc ${column}`);
    }
  }

  if (normalized.doanh_so_phat_sinh == null && normalized.so_luong_ke_don != null) {
    normalized.doanh_so_phat_sinh = 0;
  }

  return normalized;
}

function buildUpsertSql(table, config, rowCount) {
  const columns = config.columns;
  const tuples = [];
  let param = 1;

  for (let row = 0; row < rowCount; row += 1) {
    const placeholders = columns.map(() => `$${param++}`).join(", ");
    tuples.push(`(${placeholders})`);
  }

  const insert = `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")}`;
  if (config.insertOnly) return insert;

  const updateColumns = columns.filter((column) => !config.conflict.includes(column));
  const updateSet = updateColumns.map((column) => `${column} = excluded.${column}`).join(", ");
  return `${insert} on conflict (${config.conflict.join(", ")}) do update set ${updateSet}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();

  try {
    requireAutomationSecret(event);

    const body = parseBody(event);
    const table = body.table;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const config = importers[table];

    if (!config) return json(400, { error: "Bảng import không được hỗ trợ." });
    if (!rows.length) return json(200, { table, imported: 0, message: "Không có dòng để import." });
    if (rows.length > 500) return json(400, { error: "Mỗi request chỉ import tối đa 500 dòng." });

    const normalizedRows = rows.map((row, index) => normalizeRow(config, row, index + 2));
    const params = normalizedRows.flatMap((row) => config.columns.map((column) => row[column]));

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("begin");

      if (table === "tb_ke_don") {
        await client.query(
          `update tb_san_pham
           set gia_ke_don = gia_ke_don
           where id_san_pham in (${normalizedRows.map((_, i) => `$${i + 1}`).join(", ")})`,
          normalizedRows.map((row) => row.id_san_pham)
        );
      }

      await client.query(buildUpsertSql(table, config, normalizedRows.length), params);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return json(200, {
      table,
      imported: normalizedRows.length
    });
  } catch (error) {
    return handleError(error);
  }
};
