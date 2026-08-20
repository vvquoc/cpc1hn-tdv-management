const { getPool } = require("./db");

function isManager(user) {
  return ["QuanLy", "Admin", "Manager"].includes(user.role || user.chuc_vu);
}

function dateValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function numberValue(value) {
  return Number(value || 0);
}

async function loadData() {
  const pool = getPool();
  const results = await Promise.all([
    pool.query("select revision from app_state_revision where id = 1"),
    pool.query("select id_dia_ban, ten_dia_ban, khu_vuc, trang_thai from tb_dia_ban order by ten_dia_ban"),
    pool.query("select id_nhan_vien, ten_nhan_vien, email, chuc_vu, trang_thai, ma_nhan_vien_sale from tb_nhan_su order by ten_nhan_vien"),
    pool.query("select id_san_pham, ten_san_pham, hoat_chat, dang_bao_che, mo_ta_dang_bao_che, quy_cach, gia_ke_don, trang_thai, ma_hang_hoa_sale, don_vi_tinh_sale from tb_san_pham order by ten_san_pham"),
    pool.query("select id_khach_hang, ten_khach_hang, loai_khach_hang, dia_chi, dien_thoai, id_dia_ban, trang_thai, ma_khach_hang_sale, nhom_khach_hang_sale from tb_khach_hang order by ten_khach_hang"),
    pool.query("select id_nhan_vien, id_dia_ban, is_primary from employee_territories"),
    pool.query("select id_nhan_vien, id_khach_hang from employee_customers"),
    pool.query("select id_giao_dich, ngay_bao_cao, id_nhan_vien, id_khach_hang, id_san_pham, so_luong_ke_don, doanh_so_phat_sinh from tb_ke_don order by ngay_bao_cao desc limit 2000"),
    pool.query("select id_doanh_thu, thang_nam, id_khach_hang, id_san_pham, id_nhan_vien, doanh_so_thuc from tb_doanh_thu order by thang_nam desc limit 5000"),
    pool.query(`select thang_nam, id_khach_hang, id_san_pham, id_nhan_vien, sum(tong_doanh_so) as doanh_so_thuc
      from vw_data_sale_monthly
      where id_khach_hang is not null and id_san_pham is not null and id_nhan_vien is not null
      group by thang_nam, id_khach_hang, id_san_pham, id_nhan_vien
      order by thang_nam desc limit 10000`),
    pool.query("select id_goi_thau, id_khach_hang, id_san_pham, so_luong_thau, gia_du_thau, trang_thai, id_nhan_vien, han_nop from tb_thau order by ngay_cap_nhat desc limit 2000"),
    pool.query("select id, report_date, id_nhan_vien, summary, kpi_note from daily_reports order by report_date desc limit 2000"),
    pool.query("select id, thang_nam, id_nhan_vien, id_dia_ban, id_san_pham, target_sales, target_prescriptions from kpi_targets order by thang_nam desc limit 2000"),
    pool.query("select username, id_nhan_vien, password_salt, password_hash, iterations from auth_credentials")
  ]);
  const [revisionResult, territoriesResult, employeesResult, productsResult, customersResult, employeeTerritoriesResult, employeeCustomersResult, prescriptionsResult, manualSalesResult, dataSaleResult, tendersResult, dailyReportsResult, kpiTargetsResult, credentialsResult] = results;
  const dataSaleKeys = new Set(dataSaleResult.rows.map((row) => `${row.thang_nam}|${row.id_khach_hang}|${row.id_san_pham}`));
  const salesRows = manualSalesResult.rows.filter((row) => !dataSaleKeys.has(`${row.thang_nam}|${row.id_khach_hang}|${row.id_san_pham}`));
  salesRows.push(...dataSaleResult.rows.map((row) => ({ ...row, source: "DATA_SALE" })));

  return {
    revision: Number(revisionResult.rows[0]?.revision || 0),
    territories: territoriesResult.rows.map((r) => ({ id: r.id_dia_ban, name: r.ten_dia_ban, region: r.khu_vuc, status: r.trang_thai })),
    employees: employeesResult.rows.map((r) => ({ id: r.id_nhan_vien, name: r.ten_nhan_vien, email: r.email, role: r.chuc_vu, status: r.trang_thai, saleCode: r.ma_nhan_vien_sale })),
    products: productsResult.rows.map((r) => ({ id: r.id_san_pham, name: r.ten_san_pham, activeIngredient: r.hoat_chat || "", dosageCode: r.dang_bao_che, dosageForm: r.mo_ta_dang_bao_che, packageSpec: r.quy_cach || "", prescriptionPrice: numberValue(r.gia_ke_don), status: r.trang_thai, saleCode: r.ma_hang_hoa_sale, unit: r.don_vi_tinh_sale })),
    customers: customersResult.rows.map((r) => ({ id: r.id_khach_hang, name: r.ten_khach_hang, type: r.loai_khach_hang, territoryId: r.id_dia_ban, address: r.dia_chi || "", phone: r.dien_thoai || "", status: r.trang_thai, saleCode: r.ma_khach_hang_sale, saleGroup: r.nhom_khach_hang_sale })),
    employeeTerritories: employeeTerritoriesResult.rows.map((r) => ({ employeeId: r.id_nhan_vien, territoryId: r.id_dia_ban, isPrimary: r.is_primary })),
    employeeCustomers: employeeCustomersResult.rows.map((r) => ({ employeeId: r.id_nhan_vien, customerId: r.id_khach_hang })),
    prescriptions: prescriptionsResult.rows.map((r) => ({ id: r.id_giao_dich, date: dateValue(r.ngay_bao_cao), employeeId: r.id_nhan_vien, customerId: r.id_khach_hang, productId: r.id_san_pham, quantity: Number(r.so_luong_ke_don), amount: numberValue(r.doanh_so_phat_sinh) })),
    sales: salesRows.map((r) => ({ id: r.id_doanh_thu, source: r.source, period: r.thang_nam, customerId: r.id_khach_hang, productId: r.id_san_pham, employeeId: r.id_nhan_vien, amount: numberValue(r.doanh_so_thuc) })),
    tenders: tendersResult.rows.map((r) => ({ id: r.id_goi_thau, customerId: r.id_khach_hang, productId: r.id_san_pham, quantity: Number(r.so_luong_thau || 0), bidPrice: numberValue(r.gia_du_thau), status: r.trang_thai, employeeId: r.id_nhan_vien, dueDate: dateValue(r.han_nop) })),
    dailyReports: dailyReportsResult.rows.map((r) => ({ id: r.id, date: dateValue(r.report_date), employeeId: r.id_nhan_vien, summary: r.summary, kpiNote: r.kpi_note || "" })),
    kpiTargets: kpiTargetsResult.rows.map((r) => ({ id: r.id, period: r.thang_nam, employeeId: r.id_nhan_vien, territoryId: r.id_dia_ban || "", productId: r.id_san_pham || "", targetSales: numberValue(r.target_sales), targetPrescriptions: Number(r.target_prescriptions) })),
    credentials: credentialsResult.rows.map((r) => ({ username: r.username, employeeId: r.id_nhan_vien, passwordSalt: r.password_salt, passwordHash: r.password_hash, iterations: r.iterations })),
    sessions: []
  };
}

async function saveData(data) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const lock = await client.query("select revision from app_state_revision where id = 1 for update");
    if (Number(lock.rows[0]?.revision || 0) !== Number(data.revision || 0)) {
      const error = new Error("Concurrent data update");
      error.statusCode = 409;
      error.publicMessage = "Dữ liệu vừa được người khác cập nhật. Vui lòng tải lại trang và thử lại.";
      throw error;
    }
    for (const r of data.territories) await client.query("insert into tb_dia_ban (id_dia_ban,ten_dia_ban,khu_vuc,trang_thai) values ($1,$2,$3,$4) on conflict (id_dia_ban) do update set ten_dia_ban=excluded.ten_dia_ban,khu_vuc=excluded.khu_vuc,trang_thai=excluded.trang_thai", [r.id,r.name,r.region,r.status || "Active"]);
    for (const r of data.employees) await client.query("insert into tb_nhan_su (id_nhan_vien,ten_nhan_vien,email,chuc_vu,trang_thai,ma_nhan_vien_sale) values ($1,$2,$3,$4,$5,$6) on conflict (id_nhan_vien) do update set ten_nhan_vien=excluded.ten_nhan_vien,email=excluded.email,chuc_vu=excluded.chuc_vu,trang_thai=excluded.trang_thai,ma_nhan_vien_sale=coalesce(excluded.ma_nhan_vien_sale,tb_nhan_su.ma_nhan_vien_sale)", [r.id,r.name,r.email,r.role,r.status || "Active",r.saleCode || null]);
    for (const r of data.products) await client.query("insert into tb_san_pham (id_san_pham,ten_san_pham,hoat_chat,dang_bao_che,mo_ta_dang_bao_che,quy_cach,gia_ke_don,trang_thai,ma_hang_hoa_sale,don_vi_tinh_sale) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (id_san_pham) do update set ten_san_pham=excluded.ten_san_pham,hoat_chat=excluded.hoat_chat,dang_bao_che=excluded.dang_bao_che,mo_ta_dang_bao_che=excluded.mo_ta_dang_bao_che,quy_cach=excluded.quy_cach,gia_ke_don=excluded.gia_ke_don,trang_thai=excluded.trang_thai", [r.id,r.name,r.activeIngredient || null,r.dosageCode,r.dosageForm,r.packageSpec || null,numberValue(r.prescriptionPrice),r.status || "Active",r.saleCode || null,r.unit || null]);
    for (const r of data.customers) await client.query("insert into tb_khach_hang (id_khach_hang,ten_khach_hang,loai_khach_hang,dia_chi,dien_thoai,id_dia_ban,trang_thai,ma_khach_hang_sale,nhom_khach_hang_sale) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id_khach_hang) do update set ten_khach_hang=excluded.ten_khach_hang,loai_khach_hang=excluded.loai_khach_hang,dia_chi=excluded.dia_chi,dien_thoai=excluded.dien_thoai,id_dia_ban=excluded.id_dia_ban,trang_thai=excluded.trang_thai", [r.id,r.name,r.type,r.address || null,r.phone || null,r.territoryId,r.status || "Active",r.saleCode || null,r.saleGroup || null]);
    await client.query("delete from employee_territories");
    for (const r of data.employeeTerritories) await client.query("insert into employee_territories (id_nhan_vien,id_dia_ban,is_primary) values ($1,$2,$3)", [r.employeeId,r.territoryId,Boolean(r.isPrimary)]);
    await client.query("delete from employee_customers");
    for (const r of data.employeeCustomers) await client.query("insert into employee_customers (id_nhan_vien,id_khach_hang) values ($1,$2)", [r.employeeId,r.customerId]);
    for (const r of data.prescriptions) await client.query("insert into tb_ke_don (id_giao_dich,ngay_bao_cao,id_nhan_vien,id_khach_hang,id_san_pham,so_luong_ke_don,doanh_so_phat_sinh) values (coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7) on conflict (id_giao_dich) do nothing", [r.id || null,r.date,r.employeeId,r.customerId,r.productId,r.quantity,numberValue(r.amount)]);
    for (const r of data.sales.filter((item) => item.source !== "DATA_SALE")) await client.query("insert into tb_doanh_thu (thang_nam,id_khach_hang,id_san_pham,id_nhan_vien,doanh_so_thuc,source_note) values ($1,$2,$3,$4,$5,'Website') on conflict (thang_nam,id_khach_hang,id_san_pham) do update set id_nhan_vien=excluded.id_nhan_vien,doanh_so_thuc=excluded.doanh_so_thuc,source_note='Website'", [r.period,r.customerId,r.productId,r.employeeId,numberValue(r.amount)]);
    for (const r of data.tenders) await client.query("insert into tb_thau (id_goi_thau,id_khach_hang,id_san_pham,so_luong_thau,gia_du_thau,trang_thai,id_nhan_vien,han_nop,ngay_cap_nhat) values ($1,$2,$3,$4,$5,$6,$7,$8,current_date) on conflict (id_goi_thau) do update set id_khach_hang=excluded.id_khach_hang,id_san_pham=excluded.id_san_pham,so_luong_thau=excluded.so_luong_thau,gia_du_thau=excluded.gia_du_thau,trang_thai=excluded.trang_thai,id_nhan_vien=excluded.id_nhan_vien,han_nop=excluded.han_nop,ngay_cap_nhat=current_date", [r.id,r.customerId,r.productId,r.quantity,r.bidPrice,r.status,r.employeeId,r.dueDate || null]);
    for (const r of data.dailyReports) await client.query("insert into daily_reports (report_date,id_nhan_vien,summary,kpi_note) values ($1,$2,$3,$4) on conflict (report_date,id_nhan_vien) do update set summary=excluded.summary,kpi_note=excluded.kpi_note", [r.date,r.employeeId,r.summary,r.kpiNote || null]);
    for (const r of data.credentials) await client.query("insert into auth_credentials (username,id_nhan_vien,password_salt,password_hash,iterations) values ($1,$2,$3,$4,$5) on conflict (username) do update set id_nhan_vien=excluded.id_nhan_vien,password_salt=excluded.password_salt,password_hash=excluded.password_hash,iterations=excluded.iterations,updated_at=now()", [r.username,r.employeeId,r.passwordSalt,r.passwordHash,r.iterations]);
    await client.query("update app_state_revision set revision=revision+1,updated_at=now() where id=1");
    await client.query("commit");
    data.revision += 1;
    return data;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function withTerritories(data, employee) {
  return { ...employee, territoryIds: data.employeeTerritories.filter((r) => r.employeeId === employee.id).map((r) => r.territoryId) };
}

function scopedCustomers(data, user) {
  if (isManager(user)) return data.customers;
  const ids = new Set(data.employeeCustomers.filter((r) => r.employeeId === user.id).map((r) => r.customerId));
  return data.customers.filter((r) => ids.has(r.id));
}

function hasCustomerAccess(data, user, customerId) {
  return scopedCustomers(data, user).some((r) => r.id === customerId);
}

module.exports = { loadData, saveData, isManager, withTerritories, scopedCustomers, hasCustomerAccess };
