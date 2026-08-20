const { query } = require("./shared/db");
const { isAdmin, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");

function requireManager(user) {
  if (!isAdmin(user)) {
    const error = new Error("Manager permission required");
    error.statusCode = 403;
    error.publicMessage = "Chỉ Quản lý được import/export dữ liệu.";
    throw error;
  }
}

function normalizeRole(role) {
  return ["QuanLy", "Admin", "Manager"].includes(role) ? "QuanLy" : "NhanVien";
}

async function exportData() {
  const [employees, territories, products, customers, employeeTerritories, employeeCustomers, prescriptions, sales, tenders, dailyReports, kpiTargets] = await Promise.all([
    query(
      `select id_nhan_vien as id, ten_nhan_vien as name, email, chuc_vu as role, trang_thai as status
       from tb_nhan_su
       order by ten_nhan_vien`
    ),
    query(
      `select id_dia_ban as id, ten_dia_ban as name, khu_vuc as region
       from tb_dia_ban
       order by ten_dia_ban`
    ),
    query(
      `select id_san_pham as id, ten_san_pham as name, hoat_chat as "activeIngredient",
              dang_bao_che as "dosageCode", mo_ta_dang_bao_che as "dosageForm",
              quy_cach as "packageSpec", gia_ke_don::float as "prescriptionPrice", trang_thai as status
       from tb_san_pham
       order by ten_san_pham`
    ),
    query(
      `select id_khach_hang as id, ten_khach_hang as name, loai_khach_hang as type,
              id_dia_ban as "territoryId", dia_chi as address, dien_thoai as phone, trang_thai as status
       from tb_khach_hang
       order by ten_khach_hang`
    ),
    query(
      `select id_nhan_vien as "employeeId", id_dia_ban as "territoryId", is_primary as "isPrimary"
       from employee_territories
       order by id_nhan_vien, id_dia_ban`
    ),
    query(
      `select id_nhan_vien as "employeeId", id_khach_hang as "customerId"
       from employee_customers
       order by id_nhan_vien, id_khach_hang`
    ),
    query(
      `select ngay_bao_cao::text as date, id_nhan_vien as "employeeId",
              id_khach_hang as "customerId", id_san_pham as "productId", so_luong_ke_don as quantity
       from tb_ke_don
       order by ngay_bao_cao desc, created_at desc`
    ),
    query(
      `select thang_nam as period, id_khach_hang as "customerId",
              id_san_pham as "productId", id_nhan_vien as "employeeId", doanh_so_thuc::float as amount
       from tb_doanh_thu
       order by thang_nam desc, created_at desc`
    ),
    query(
      `select id_goi_thau as id, id_khach_hang as "customerId", id_san_pham as "productId",
              id_nhan_vien as "employeeId", trang_thai as status, han_nop::text as "dueDate",
              so_luong as quantity, gia_du_thau::float as "bidPrice"
       from tb_thau
       order by ngay_cap_nhat desc`
    ),
    query(
      `select report_date::text as date, id_nhan_vien as "employeeId", summary
       from daily_reports
       order by report_date desc`
    ),
    query(
      `select id_nhan_vien as "employeeId", target_month as period,
              target_prescriptions as "targetPrescriptions", target_sales::float as "targetSales"
       from kpi_targets
       order by target_month desc, id_nhan_vien`
    )
  ]);

  return {
    exportedAt: new Date().toISOString(),
    employees,
    territories,
    products,
    customers,
    employeeTerritories,
    employeeCustomers,
    prescriptions,
    sales,
    tenders,
    dailyReports,
    kpiTargets
  };
}

async function importRows(resource, rows) {
  if (!Array.isArray(rows) || !rows.length) return { imported: 0 };

  let imported = 0;
  for (const row of rows) {
    if (resource === "employees") {
      await query(
        `insert into tb_nhan_su (id_nhan_vien, ten_nhan_vien, email, chuc_vu, trang_thai)
         values ($1, $2, lower($3), $4, coalesce($5, 'Active'))
         on conflict (id_nhan_vien)
         do update set ten_nhan_vien = excluded.ten_nhan_vien,
                       email = excluded.email,
                       chuc_vu = excluded.chuc_vu,
                       trang_thai = excluded.trang_thai`,
        [row.id_nhan_vien || row.id, row.ten_nhan_vien || row.name, row.email, normalizeRole(row.chuc_vu || row.role), row.trang_thai || row.status || "Active"]
      );
    } else if (resource === "territories") {
      await query(
        `insert into tb_dia_ban (id_dia_ban, ten_dia_ban, khu_vuc)
         values ($1, $2, $3)
         on conflict (id_dia_ban)
         do update set ten_dia_ban = excluded.ten_dia_ban, khu_vuc = excluded.khu_vuc`,
        [row.id_dia_ban || row.id, row.ten_dia_ban || row.name, row.khu_vuc || row.region]
      );
    } else if (resource === "products") {
      await query(
        `insert into tb_san_pham (id_san_pham, ten_san_pham, hoat_chat, dang_bao_che, mo_ta_dang_bao_che, quy_cach, gia_ke_don, trang_thai)
         values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 'Active'))
         on conflict (id_san_pham)
         do update set ten_san_pham = excluded.ten_san_pham,
                       hoat_chat = excluded.hoat_chat,
                       dang_bao_che = excluded.dang_bao_che,
                       mo_ta_dang_bao_che = excluded.mo_ta_dang_bao_che,
                       quy_cach = excluded.quy_cach,
                       gia_ke_don = excluded.gia_ke_don,
                       trang_thai = excluded.trang_thai`,
        [
          row.id_san_pham || row.id,
          row.ten_san_pham || row.name,
          row.hoat_chat || row.activeIngredient || null,
          row.dang_bao_che || row.dosageCode,
          row.mo_ta_dang_bao_che || row.dosageForm,
          row.quy_cach || row.packageSpec || null,
          Number(row.gia_ke_don || row.prescriptionPrice || 0),
          row.trang_thai || row.status || "Active"
        ]
      );
    } else if (resource === "customers") {
      await query(
        `insert into tb_khach_hang (id_khach_hang, ten_khach_hang, loai_khach_hang, dia_chi, dien_thoai, id_dia_ban, trang_thai)
         values ($1, $2, $3, $4, $5, $6, coalesce($7, 'Active'))
         on conflict (id_khach_hang)
         do update set ten_khach_hang = excluded.ten_khach_hang,
                       loai_khach_hang = excluded.loai_khach_hang,
                       dia_chi = excluded.dia_chi,
                       dien_thoai = excluded.dien_thoai,
                       id_dia_ban = excluded.id_dia_ban,
                       trang_thai = excluded.trang_thai`,
        [
          row.id_khach_hang || row.id,
          row.ten_khach_hang || row.name,
          row.loai_khach_hang || row.type,
          row.dia_chi || row.address || null,
          row.dien_thoai || row.phone || null,
          row.id_dia_ban || row.territoryId,
          row.trang_thai || row.status || "Active"
        ]
      );
    } else if (resource === "employeeTerritories") {
      await query(
        `insert into employee_territories (id_nhan_vien, id_dia_ban, is_primary)
         values ($1, $2, $3)
         on conflict (id_nhan_vien, id_dia_ban)
         do update set is_primary = excluded.is_primary`,
        [row.id_nhan_vien || row.employeeId, row.id_dia_ban || row.territoryId, String(row.is_primary || row.isPrimary || "").toLowerCase() === "true"]
      );
    } else if (resource === "employeeCustomers") {
      await query(
        `insert into employee_customers (id_nhan_vien, id_khach_hang)
         values ($1, $2)
         on conflict (id_nhan_vien, id_khach_hang) do nothing`,
        [row.id_nhan_vien || row.employeeId, row.id_khach_hang || row.customerId]
      );
    } else if (resource === "prescriptions") {
      await query(
        `insert into tb_ke_don (ngay_bao_cao, id_nhan_vien, id_khach_hang, id_san_pham, so_luong_ke_don, doanh_so_phat_sinh)
         values ($1::date, $2, $3, $4, $5, $6)`,
        [
          row.ngay_bao_cao || row.date,
          row.id_nhan_vien || row.employeeId,
          row.id_khach_hang || row.customerId,
          row.id_san_pham || row.productId,
          Number(row.so_luong_ke_don || row.quantity || 0),
          Number(row.doanh_so_phat_sinh || row.amount || 0)
        ]
      );
    } else if (resource === "sales") {
      await query(
        `insert into tb_doanh_thu (thang_nam, id_khach_hang, id_san_pham, id_nhan_vien, doanh_so_thuc, source_note)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (thang_nam, id_khach_hang, id_san_pham)
         do update set id_nhan_vien = excluded.id_nhan_vien,
                       doanh_so_thuc = excluded.doanh_so_thuc,
                       source_note = excluded.source_note`,
        [
          row.thang_nam || row.period,
          row.id_khach_hang || row.customerId,
          row.id_san_pham || row.productId,
          row.id_nhan_vien || row.employeeId,
          Number(row.doanh_so_thuc || row.amount || 0),
          row.source_note || row.sourceNote || null
        ]
      );
    } else if (resource === "tenders") {
      await query(
        `insert into tb_thau (id_goi_thau, id_khach_hang, id_san_pham, so_luong_thau, gia_du_thau, trang_thai, id_nhan_vien, han_nop, ngay_cap_nhat)
         values ($1, $2, $3, $4, $5, $6, $7, nullif($8, '')::date, coalesce(nullif($9, '')::date, current_date))
         on conflict (id_goi_thau)
         do update set id_khach_hang = excluded.id_khach_hang,
                       id_san_pham = excluded.id_san_pham,
                       so_luong_thau = excluded.so_luong_thau,
                       gia_du_thau = excluded.gia_du_thau,
                       trang_thai = excluded.trang_thai,
                       id_nhan_vien = excluded.id_nhan_vien,
                       han_nop = excluded.han_nop,
                       ngay_cap_nhat = excluded.ngay_cap_nhat`,
        [
          row.id_goi_thau || row.id,
          row.id_khach_hang || row.customerId,
          row.id_san_pham || row.productId,
          Number(row.so_luong_thau || row.quantity || 0),
          Number(row.gia_du_thau || row.bidPrice || 0),
          row.trang_thai || row.status || "DangLamHoSo",
          row.id_nhan_vien || row.employeeId,
          row.han_nop || row.dueDate || "",
          row.ngay_cap_nhat || row.updatedDate || ""
        ]
      );
    } else if (resource === "dailyReports") {
      await query(
        `insert into daily_reports (report_date, id_nhan_vien, summary, kpi_note)
         values ($1::date, $2, $3, $4)
         on conflict (report_date, id_nhan_vien)
         do update set summary = excluded.summary, kpi_note = excluded.kpi_note`,
        [
          row.report_date || row.date,
          row.id_nhan_vien || row.employeeId,
          row.summary,
          row.kpi_note || row.kpiNote || null
        ]
      );
    } else if (resource === "kpiTargets") {
      await query(
        `insert into kpi_targets (thang_nam, id_nhan_vien, id_dia_ban, id_san_pham, target_sales, target_prescriptions)
         values ($1, $2, nullif($3, ''), nullif($4, ''), $5, $6)
         on conflict (thang_nam, id_nhan_vien, id_san_pham)
         do update set id_dia_ban = excluded.id_dia_ban,
                       target_sales = excluded.target_sales,
                       target_prescriptions = excluded.target_prescriptions`,
        [
          row.thang_nam || row.period,
          row.id_nhan_vien || row.employeeId,
          row.id_dia_ban || row.territoryId || "",
          row.id_san_pham || row.productId || "",
          Number(row.target_sales || row.targetSales || 0),
          Number(row.target_prescriptions || row.targetPrescriptions || 0)
        ]
      );
    } else {
      const error = new Error(`Unsupported import resource: ${resource}`);
      error.statusCode = 400;
      error.publicMessage = "Loại dữ liệu import chưa được hỗ trợ.";
      throw error;
    }
    imported += 1;
  }

  return { imported };
}

exports.handler = async (event) => {
  try {
    const user = await requireUser(event);
    requireManager(user);

    if (event.httpMethod === "GET") {
      return json(200, await exportData());
    }

    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    const result = await importRows(body.resource, body.rows);
    return json(200, { resource: body.resource, ...result });
  } catch (error) {
    return handleError(error);
  }
};
