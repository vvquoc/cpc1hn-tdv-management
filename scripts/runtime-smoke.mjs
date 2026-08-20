import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const password = process.env.QA_MANAGER_PASSWORD;
if (!password) throw new Error("QA_MANAGER_PASSWORD is required");

const login = require("../netlify/functions/login.js");
const bootstrap = require("../netlify/functions/bootstrap-data.js");
const dataSaleImport = require("../netlify/functions/data-sale-import.js");
const { getPool } = require("../netlify/functions/shared/db.js");

const loginResponse = await login.handler({
  httpMethod: "POST",
  headers: {},
  body: JSON.stringify({ username: "15795", password })
});
if (loginResponse.statusCode !== 200) throw new Error(`Login failed: ${loginResponse.statusCode} ${loginResponse.body}`);

const loginBody = JSON.parse(loginResponse.body);
const bootstrapResponse = await bootstrap.handler({
  httpMethod: "GET",
  headers: { authorization: `Bearer ${loginBody.token}` }
});
if (bootstrapResponse.statusCode !== 200) throw new Error(`Bootstrap failed: ${bootstrapResponse.statusCode} ${bootstrapResponse.body}`);

const data = JSON.parse(bootstrapResponse.body);
const sampleRow = {
  "Quản lý": "Trương Anh Tú", "NV kinh doanh": "015795", "Tên NV KD": "Nguyễn Ngọc Phương Thảo",
  "Tỉnh": "Quảng Nam", "Nhóm KH": "BV Kê đơn", "Tháng": "1", "Năm": "2025", "Mã Kh": "KC01287",
  "Tên KH": "Công Ty TNHH Y Khoa Minh Trí Hội An", "Ngày chứng từ": "2025-01-02", "Số Chứng từ ngoại": "FB2531/00025",
  "Mã HH": "W00504", "Tên HH": "Hylaform 0,1% 10ml", "DVT": "ONG", "Số Lượng": "40", "Đơn giá": "30714.286",
  "Doanh thu": "1228571", "Hệ số": "1.5", "DOANH SỐ": "1842856.5"
};

for (let attempt = 0; attempt < 2; attempt += 1) {
  const importResponse = await dataSaleImport.handler({
    httpMethod: "POST",
    headers: { authorization: `Bearer ${loginBody.token}` },
    body: JSON.stringify({ startRow: 2, rows: [sampleRow], final: true })
  });
  if (importResponse.statusCode !== 200) throw new Error(`DATA SALE import failed: ${importResponse.statusCode} ${importResponse.body}`);
}
const imported = await getPool().query("select count(*)::int as count, sum(doanh_so)::numeric as sales from data_sale_transactions where source_row_number=2");
if (imported.rows[0].count !== 1 || Number(imported.rows[0].sales) !== 1842856.5) throw new Error("DATA SALE idempotency check failed");

console.log(JSON.stringify({
  login: "PASS",
  user: data.activeUser?.id,
  role: data.activeUser?.role,
  territories: data.territories?.length || 0,
  employees: data.employees?.length || 0,
  customers: data.customers?.length || 0,
  products: data.products?.length || 0,
  sales: data.sales?.length || 0,
  dataSaleImport: "PASS",
  dataSaleRows: imported.rows[0].count
}));
