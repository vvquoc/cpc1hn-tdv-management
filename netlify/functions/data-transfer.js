const { isAdmin, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { loadData, saveData } = require("./shared/store");

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

function bool(value) {
  return String(value || "").toLowerCase() === "true";
}

function upsert(items, row, match) {
  const index = items.findIndex(match);
  if (index >= 0) items[index] = { ...items[index], ...row };
  else items.push(row);
}

function importRow(data, resource, row) {
  if (resource === "employees") {
    upsert(data.employees, {
      id: row.id_nhan_vien || row.id,
      name: row.ten_nhan_vien || row.name,
      email: row.email,
      role: normalizeRole(row.chuc_vu || row.role),
      status: row.trang_thai || row.status || "Active"
    }, (item) => item.id === (row.id_nhan_vien || row.id));
  } else if (resource === "territories") {
    upsert(data.territories, {
      id: row.id_dia_ban || row.id,
      name: row.ten_dia_ban || row.name,
      region: row.khu_vuc || row.region
    }, (item) => item.id === (row.id_dia_ban || row.id));
  } else if (resource === "products") {
    upsert(data.products, {
      id: row.id_san_pham || row.id,
      name: row.ten_san_pham || row.name,
      activeIngredient: row.hoat_chat || row.activeIngredient || "",
      dosageCode: row.dang_bao_che || row.dosageCode,
      dosageForm: row.mo_ta_dang_bao_che || row.dosageForm,
      packageSpec: row.quy_cach || row.packageSpec || "",
      prescriptionPrice: Number(row.gia_ke_don || row.prescriptionPrice || 0),
      status: row.trang_thai || row.status || "Active"
    }, (item) => item.id === (row.id_san_pham || row.id));
  } else if (resource === "customers") {
    upsert(data.customers, {
      id: row.id_khach_hang || row.id,
      name: row.ten_khach_hang || row.name,
      type: row.loai_khach_hang || row.type,
      address: row.dia_chi || row.address || "",
      phone: row.dien_thoai || row.phone || "",
      territoryId: row.id_dia_ban || row.territoryId,
      status: row.trang_thai || row.status || "Active"
    }, (item) => item.id === (row.id_khach_hang || row.id));
  } else if (resource === "employeeTerritories") {
    const assignment = { employeeId: row.id_nhan_vien || row.employeeId, territoryId: row.id_dia_ban || row.territoryId, isPrimary: bool(row.is_primary || row.isPrimary) };
    upsert(data.employeeTerritories, assignment, (item) => item.employeeId === assignment.employeeId && item.territoryId === assignment.territoryId);
  } else if (resource === "employeeCustomers") {
    const assignment = { employeeId: row.id_nhan_vien || row.employeeId, customerId: row.id_khach_hang || row.customerId };
    upsert(data.employeeCustomers, assignment, (item) => item.employeeId === assignment.employeeId && item.customerId === assignment.customerId);
  } else if (resource === "prescriptions") {
    data.prescriptions.push({
      date: row.ngay_bao_cao || row.date,
      employeeId: row.id_nhan_vien || row.employeeId,
      customerId: row.id_khach_hang || row.customerId,
      productId: row.id_san_pham || row.productId,
      quantity: Number(row.so_luong_ke_don || row.quantity || 0),
      amount: Number(row.doanh_so_phat_sinh || row.amount || 0)
    });
  } else if (resource === "sales") {
    const sale = {
      period: row.thang_nam || row.period,
      customerId: row.id_khach_hang || row.customerId,
      productId: row.id_san_pham || row.productId,
      employeeId: row.id_nhan_vien || row.employeeId,
      amount: Number(row.doanh_so_thuc || row.amount || 0)
    };
    upsert(data.sales, sale, (item) => item.period === sale.period && item.customerId === sale.customerId && item.productId === sale.productId);
  } else if (resource === "tenders") {
    upsert(data.tenders, {
      id: row.id_goi_thau || row.id,
      customerId: row.id_khach_hang || row.customerId,
      productId: row.id_san_pham || row.productId,
      quantity: Number(row.so_luong_thau || row.quantity || 0),
      bidPrice: Number(row.gia_du_thau || row.bidPrice || 0),
      status: row.trang_thai || row.status || "DangLamHoSo",
      employeeId: row.id_nhan_vien || row.employeeId,
      dueDate: row.han_nop || row.dueDate || ""
    }, (item) => item.id === (row.id_goi_thau || row.id));
  } else if (resource === "dailyReports") {
    const report = { date: row.report_date || row.date, employeeId: row.id_nhan_vien || row.employeeId, summary: row.summary || "", kpiNote: row.kpi_note || row.kpiNote || "" };
    upsert(data.dailyReports, report, (item) => item.date === report.date && item.employeeId === report.employeeId);
  } else if (resource === "kpiTargets") {
    const kpi = {
      period: row.thang_nam || row.period,
      employeeId: row.id_nhan_vien || row.employeeId,
      territoryId: row.id_dia_ban || row.territoryId || "",
      productId: row.id_san_pham || row.productId || "",
      targetSales: Number(row.target_sales || row.targetSales || 0),
      targetPrescriptions: Number(row.target_prescriptions || row.targetPrescriptions || 0)
    };
    upsert(data.kpiTargets, kpi, (item) => item.period === kpi.period && item.employeeId === kpi.employeeId && item.productId === kpi.productId);
  } else {
    const error = new Error(`Unsupported import resource: ${resource}`);
    error.statusCode = 400;
    error.publicMessage = "Loại dữ liệu import chưa được hỗ trợ.";
    throw error;
  }
}

exports.handler = async (event) => {
  try {
    const user = await requireUser(event);
    requireManager(user);
    const data = await loadData();

    if (event.httpMethod === "GET") {
      const { credentials, sessions, ...exportable } = data;
      return json(200, { exportedAt: new Date().toISOString(), ...exportable });
    }

    if (event.httpMethod !== "POST") return methodNotAllowed();
    const body = parseBody(event);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    for (const row of rows) importRow(data, body.resource, row);
    await saveData(data);
    return json(200, { resource: body.resource, imported: rows.length });
  } catch (error) {
    return handleError(error);
  }
};
