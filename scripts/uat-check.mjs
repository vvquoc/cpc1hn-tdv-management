import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(import.meta.url);

const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function check(id, name, run) {
  try {
    const detail = run();
    checks.push({ id, name, status: "PASS", detail: detail || "" });
  } catch (error) {
    checks.push({ id, name, status: "FAIL", detail: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

check("UAT-AUTO-01", "Netlify build config publishes dist and uses Node 22", () => {
  const toml = read("netlify.toml");
  assert(toml.includes('command = "npm run build"'), "Missing build command");
  assert(toml.includes('publish = "dist"'), "Missing dist publish directory");
  assert(toml.includes('NODE_VERSION = "22"'), "Missing Node 22 production setting");
});

check("UAT-AUTO-02", "Public API routes are mapped to Netlify functions", () => {
  const toml = read("netlify.toml");
  const routes = [
    "bootstrap-data",
    "login",
    "logout",
    "prescriptions",
    "sales",
    "tenders",
    "admin-data",
    "data-transfer",
    "data-sale-import",
    "lost-sales-trigger",
    "daily-reminders",
    "health"
  ];
  for (const route of routes) {
    assert(toml.includes(`/api/v1/${route}`), `Missing API route ${route}`);
    assert(exists(`netlify/functions/${route}.js`), `Missing function ${route}.js`);
  }
});

check("UAT-AUTO-03", "Database migration contains core business tables", () => {
  const sql = read("netlify/database/migrations/001_core_schema.sql");
  const tables = [
    "tb_nhan_su",
    "tb_dia_ban",
    "tb_san_pham",
    "tb_khach_hang",
    "tb_ke_don",
    "tb_doanh_thu",
    "tb_thau",
    "daily_reports",
    "kpi_targets",
    "employee_territories",
    "employee_customers"
  ];
  for (const table of tables) {
    assert(sql.includes(table), `Missing table ${table}`);
  }
});

check("UAT-AUTO-04", "Role scope helpers are present", () => {
  const auth = read("netlify/functions/shared/auth.js");
  const store = read("netlify/functions/shared/store.js");
  assert(auth.includes("requireUser"), "Missing requireUser");
  assert(auth.includes("isAdmin"), "Missing isAdmin");
  assert(auth.includes("customerScopeSql"), "Missing customerScopeSql");
  assert(auth.includes("assertCustomerAccess"), "Missing assertCustomerAccess");
  assert(store.includes("isManager"), "Missing manager role helper");
  assert(store.includes("QuanLy"), "Missing simplified manager role model");
  assert(store.includes("Admin") && store.includes("Manager"), "Missing legacy manager role compatibility");
});

check("UAT-AUTO-05", "Admin management forms exist in the UI", () => {
  const html = read("src/index.html");
  const forms = [
    "employeeForm",
    "territoryForm",
    "productForm",
    "customerForm",
    "territoryAssignForm",
    "customerAssignForm"
  ];
  for (const form of forms) {
    assert(html.includes(`id="${form}"`), `Missing ${form}`);
  }
  assert(html.includes('data-admin-only'), "Missing admin-only UI marker");
});

check("UAT-AUTO-06", "Website writes operational data through role-scoped APIs", () => {
  const app = read("src/app.js");
  const endpoints = ["/api/v1/prescriptions", "/api/v1/sales", "/api/v1/tenders", "/api/v1/admin-data", "/api/v1/data-transfer"];
  for (const endpoint of endpoints) {
    assert(app.includes(endpoint), `Missing frontend call to ${endpoint}`);
  }
  assert(app.includes("authorization"), "Missing bearer token header");
  assert(app.includes("canAdmin"), "Missing admin visibility guard");
});

check("UAT-AUTO-07", "n8n import workflow is no longer part of the app path", () => {
  const files = [
    "netlify/functions/sync-from-n8n.js",
    "docs/n8n-workflow.md",
    "n8n-workflow.json"
  ];
  for (const file of files) {
    assert(!exists(file), `${file} should not exist in current no-n8n plan`);
  }
});

check("UAT-AUTO-08", "Data import templates are ready for real data", () => {
  const files = [
    "data-templates/cpc1hn_data_import_template.xlsx",
    "data-templates/csv/tb_nhan_su.csv",
    "data-templates/csv/tb_dia_ban.csv",
    "data-templates/csv/tb_san_pham.csv",
    "data-templates/csv/tb_khach_hang.csv",
    "data-templates/csv/tb_ke_don.csv",
    "data-templates/csv/tb_doanh_thu.csv",
    "data-templates/csv/tb_thau.csv",
    "data-templates/csv/daily_reports.csv",
    "data-templates/csv/kpi_targets.csv"
  ];
  for (const file of files) {
    assert(exists(file), `Missing data template ${file}`);
  }
});

check("UAT-AUTO-09", "Netlify functions can be loaded by Node", () => {
  const functions = [
    "bootstrap-data",
    "login",
    "logout",
    "prescriptions",
    "sales",
    "tenders",
    "admin-data",
    "data-transfer",
    "lost-sales-trigger",
    "daily-reminders",
    "health"
  ];
  for (const fn of functions) {
    const mod = require(path.join(root, "netlify", "functions", `${fn}.js`));
    assert(typeof mod.handler === "function", `${fn}.js does not export handler`);
  }
});

check("UAT-AUTO-10", "Async forms keep stable form references before reset", () => {
  const app = read("src/app.js");
  assert(!app.includes("event.currentTarget.reset()"), "Forms must not reset through event.currentTarget after async work");
});

check("UAT-AUTO-11", "Operational store uses PostgreSQL and optimistic concurrency control", () => {
  const store = read("netlify/functions/shared/store.js");
  assert(store.includes('require("./db")'), "Operational store must use the shared PostgreSQL connection");
  assert(store.includes("app_state_revision"), "Missing persisted revision check");
  assert(store.includes("for update"), "Missing concurrency lock");
});

check("UAT-AUTO-12", "Admin UI exposes full master-data controls", () => {
  const html = read("src/index.html");
  const app = read("src/app.js");
  assert(html.includes('id="territoryAdminList"'), "Missing territory management list");
  assert(app.includes("data-edit-territory"), "Missing territory edit action");
  assert(app.includes("data-deactivate-territory"), "Missing territory delete action");
  assert(app.includes("Đã lưu dữ liệu."), "Missing successful save feedback");
});

check("UAT-AUTO-13", "DATA SALE schema preserves the 19-column source grain", () => {
  const migration = read("netlify/database/migrations/006_data_sale_detail.sql");
  const csvHeader = read("data-templates/csv/data_sale_transactions.csv").split(/\r?\n/)[0];
  const sourceHeaders = ["Quản lý", "NV kinh doanh", "Tên NV KD", "Tỉnh", "Nhóm KH", "Tháng", "Năm", "Mã Kh", "Tên KH", "Ngày chứng từ", "Số Chứng từ ngoại", "Mã HH", "Tên HH", "DVT", "Số Lượng", "Đơn giá", "Doanh thu", "Hệ số", "DOANH SỐ"];
  assert(csvHeader === sourceHeaders.join(","), "DATA SALE CSV header does not match source A:S");
  for (const column of ["ma_nhan_vien", "ma_khach_hang", "ngay_chung_tu", "so_chung_tu_ngoai", "ma_hang_hoa", "so_luong", "don_gia", "doanh_thu", "he_so", "doanh_so"]) {
    assert(migration.includes(column), `Missing DATA SALE column ${column}`);
  }
  assert(migration.includes("vw_data_sale_monthly"), "Missing monthly DATA SALE summary view");
  assert(exists("netlify/functions/data-sale-import.js"), "Missing DATA SALE chunk import endpoint");
  assert(exists("docs/cpc1-tdv-management/dbdiagram/cpc1-tdv-management.sql"), "Missing generated PostgreSQL schema");
});

const failed = checks.filter((item) => item.status === "FAIL");
for (const item of checks) {
  const detail = item.detail ? ` - ${item.detail}` : "";
  console.log(`${item.status} ${item.id}: ${item.name}${detail}`);
}

if (failed.length) {
  console.error(`\n${failed.length} automated UAT check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} automated UAT check(s) passed.`);
