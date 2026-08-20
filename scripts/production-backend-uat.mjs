const base = process.env.QA_BASE_URL || "https://cpc1hn-tdv-management.netlify.app";
const managerPassword = process.env.QA_MANAGER_PASSWORD;
const employeePassword = process.env.QA_EMPLOYEE_PASSWORD;
if (!managerPassword || !employeePassword) throw new Error("QA_MANAGER_PASSWORD and QA_EMPLOYEE_PASSWORD are required");

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${payload.error || "Unknown error"}`);
  return { status: response.status, payload };
}

async function login(username, password) {
  return (await request("/api/v1/login", { method: "POST", body: { username, password } })).payload;
}

const manager = await login("15795", managerPassword);
const token = manager.token;
const admin = (resource, data, action = "upsert") => request("/api/v1/admin-data", { token, method: "POST", body: { resource, action, data } });

await admin("territory", { id: "UAT-E2E-DB", name: "Địa bàn UAT", region: "Backend", status: "Active" });
await admin("product", { id: "UAT-E2E-SP", name: "Sản phẩm UAT", dosageCode: "Khac", dosageForm: "Dạng UAT", prescriptionPrice: 1000, status: "Active" });
await admin("customer", { id: "UAT-E2E-KH", name: "Khách hàng UAT", type: "PhongMachTu", territoryId: "UAT-E2E-DB", status: "Active" });
await admin("employee", { id: "UAT-E2E-NV", name: "Nhân viên UAT", email: "", username: "uat_employee", password: employeePassword, role: "NhanVien", status: "Active" });
await admin("employee_territory", { employeeId: "UAT-E2E-NV", territoryId: "UAT-E2E-DB", isPrimary: true });
await admin("employee_customer", { employeeId: "UAT-E2E-NV", customerId: "UAT-E2E-KH" });

const deviceA = await login("uat_employee", employeePassword);
const deviceB = await login("uat_employee", employeePassword);
const [bootstrapA, bootstrapB] = await Promise.all([
  request("/api/v1/bootstrap-data", { token: deviceA.token }),
  request("/api/v1/bootstrap-data", { token: deviceB.token })
]);
for (const result of [bootstrapA, bootstrapB]) {
  if (!result.payload.customers.some((item) => item.id === "UAT-E2E-KH")) throw new Error("Employee scope is missing on an independent login");
}

await request("/api/v1/prescriptions", { token: deviceA.token, method: "POST", body: { date: new Date().toISOString().slice(0, 10), customerId: "UAT-E2E-KH", productId: "UAT-E2E-SP", quantity: 2 } });
await request("/api/v1/sales", { token: deviceB.token, method: "POST", body: { period: new Date().toISOString().slice(0, 7), customerId: "UAT-E2E-KH", productId: "UAT-E2E-SP", amount: 250000 } });
await request("/api/v1/tenders", { token: deviceA.token, method: "POST", body: { id: "UAT-E2E-GT", customerId: "UAT-E2E-KH", productId: "UAT-E2E-SP", status: "DangLamHoSo", quantity: 10, bidPrice: 900 } });

await request("/api/v1/data-transfer", { token, method: "POST", body: { resource: "products", rows: [{ id_san_pham: "UAT-IMPORT-SP", ten_san_pham: "Sản phẩm import UAT", dang_bao_che: "Khac", mo_ta_dang_bao_che: "Import", gia_ke_don: "2000", trang_thai: "Active" }] } });
const period = new Date().toISOString().slice(0, 7);
const [finalData, finalAdmin, prescriptions, sales, tenders, dashboard] = await Promise.all([
  request("/api/v1/bootstrap-data", { token }),
  request("/api/v1/admin-data", { token }),
  request(`/api/v1/prescriptions?period=${period}&search=Kh%C3%A1ch%20h%C3%A0ng%20UAT&page=1&pageSize=20`, { token }),
  request(`/api/v1/sales?period=${period}&search=Kh%C3%A1ch%20h%C3%A0ng%20UAT&page=1&pageSize=20`, { token }),
  request("/api/v1/tenders?search=UAT-E2E-GT&page=1&pageSize=20", { token }),
  request(`/api/v1/dashboard?period=${period}`, { token })
]);
if (!finalData.payload.products.some((item) => item.id === "UAT-IMPORT-SP")) throw new Error("Imported product is missing after reload");
if (!finalAdmin.payload.accounts.some((item) => item.employeeId === "UAT-E2E-NV" && item.username === "uat_employee")) throw new Error("Employee login account was not persisted");
if (!prescriptions.payload.items.some((item) => item.employeeId === "UAT-E2E-NV" && item.customerId === "UAT-E2E-KH")) throw new Error("Employee prescription was not persisted in the paginated report");
if (!sales.payload.items.some((item) => item.employeeId === "UAT-E2E-NV" && item.customerId === "UAT-E2E-KH" && item.amount === 250000)) throw new Error("Employee sale was not persisted in the paginated report");
if (!tenders.payload.items.some((item) => item.id === "UAT-E2E-GT" && item.employeeId === "UAT-E2E-NV")) throw new Error("Employee tender was not persisted in the paginated report");
if (dashboard.payload.metrics.sales < 250000 || dashboard.payload.metrics.prescriptionQuantity < 2 || dashboard.payload.metrics.openTenders < 1) {
  throw new Error(`Dashboard did not reconcile persisted operations: ${JSON.stringify(dashboard.payload.metrics)}`);
}

console.log(JSON.stringify({
  managerLogin: "PASS", manualCrud: "PASS", accountWithoutEmail: "PASS", independentEmployeeLogins: 2,
  employeeWrites: ["prescription", "sale", "tender"], standardImport: "PASS", persistedAfterReload: "PASS",
  paginatedReports: "PASS", dashboardReconciliation: "PASS"
}));
