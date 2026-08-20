const password = process.env.QA_MANAGER_PASSWORD;
if (!password) throw new Error("QA_MANAGER_PASSWORD is required");

const invoke = async (name, { method = "GET", token, body, query = {} } = {}) => {
  const module = await import(`../netlify/functions/${name}.js`);
  const response = await module.default.handler({
    httpMethod: method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
    queryStringParameters: query
  });
  const payload = JSON.parse(response.body || "{}");
  if (response.statusCode >= 400) throw new Error(`${name}: ${response.statusCode} ${payload.error}`);
  return payload;
};

const login = await invoke("login", { method: "POST", body: { username: "15795", password } });
const token = login.token;
const [bootstrap, admin, dashboard, sales, prescriptions, tenders, alerts] = await Promise.all([
  invoke("bootstrap-data", { token }),
  invoke("admin-data", { token }),
  invoke("dashboard", { token }),
  invoke("sales", { token, query: { page: "1", pageSize: "20", period: "2026-06" } }),
  invoke("prescriptions", { token, query: { page: "1", pageSize: "20", period: "2026-06" } }),
  invoke("tenders", { token, query: { page: "1", pageSize: "20" } }),
  invoke("lost-sales-trigger", { token })
]);

if (bootstrap.sales.length || bootstrap.prescriptions.length || bootstrap.tenders.length) throw new Error("Bootstrap still contains unpaginated operations");
if (sales.items.length > 20) throw new Error("Sales endpoint is not paginated");
if (dashboard.period !== "2026-06") throw new Error(`Unexpected latest reporting period ${dashboard.period}`);
if (dashboard.metrics.sales <= 0) throw new Error(`Sales reconciliation failed: ${dashboard.metrics.sales}`);
let detailSales = 0;
for (let page = 1; page <= Math.ceil(sales.total / 100); page += 1) {
  const result = await invoke("sales", { token, query: { page: String(page), pageSize: "100", period: "2026-06" } });
  detailSales += result.items.reduce((sum, item) => sum + item.amount, 0);
}
if (detailSales !== dashboard.metrics.sales) throw new Error(`Dashboard/detail mismatch: ${dashboard.metrics.sales} vs ${detailSales}`);

console.log(JSON.stringify({
  managerLogin: "PASS",
  employeeProfiles: bootstrap.employees.length,
  loginAccounts: admin.accounts.length,
  reportingPeriod: dashboard.period,
  dashboardMetrics: dashboard.metrics,
  reconciledSalesDetail: detailSales,
  salesPage: { returned: sales.items.length, total: sales.total, pageSize: sales.pageSize },
  prescriptions: prescriptions.total,
  tenders: tenders.total,
  lostSaleAlerts: alerts.alerts.length,
  lightweightBootstrap: "PASS"
}, null, 2));
