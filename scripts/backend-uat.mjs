import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
process.env.AUTH_TOKEN_SECRET = "backend-uat-only-secret";

let appData = {
  revision: 0,
  employees: [
    { id: "QL-01", name: "QA Manager", email: "manager@example.test", role: "QuanLy", status: "Active" }
  ],
  credentials: [],
  sessions: [],
  territories: [
    { id: "DB-A", name: "Khu vực A", region: "QA", status: "Active" },
    { id: "DB-B", name: "Khu vực B", region: "QA", status: "Active" }
  ],
  products: [],
  customers: [
    { id: "KH-B", name: "Khách hàng B", type: "PhongMachTu", territoryId: "DB-B", status: "Active" }
  ],
  employeeTerritories: [{ employeeId: "QL-01", territoryId: "DB-A", isPrimary: true }],
  employeeCustomers: [],
  prescriptions: [],
  sales: [],
  tenders: [],
  dailyReports: [],
  kpiTargets: []
};

function credential(username, employeeId, password) {
  const passwordSalt = "0123456789abcdef0123456789abcdef";
  const iterations = 1000;
  const passwordHash = crypto.pbkdf2Sync(password, passwordSalt, iterations, 32, "sha256").toString("hex");
  return { username, employeeId, passwordSalt, passwordHash, iterations };
}

appData.credentials.push(credential("manager", "QL-01", "Manager@123"));

const storePath = require.resolve("../netlify/functions/shared/store.js");
const store = require(storePath);
store.loadData = async () => appData;
store.saveData = async (nextData) => {
  appData = nextData;
  return appData;
};

delete require.cache[require.resolve("../netlify/functions/shared/auth.js")];
const auth = require("../netlify/functions/shared/auth.js");
const login = require("../netlify/functions/login.js");
const admin = require("../netlify/functions/admin-data.js");
const bootstrap = require("../netlify/functions/bootstrap-data.js");
const prescriptions = require("../netlify/functions/prescriptions.js");
const sales = require("../netlify/functions/sales.js");
const tenders = require("../netlify/functions/tenders.js");

function event(method, body, token) {
  return {
    httpMethod: method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? null : JSON.stringify(body)
  };
}

function payload(response) {
  return JSON.parse(response.body || "{}");
}

async function expect(name, promise, statusCode) {
  const response = await promise;
  if (response.statusCode !== statusCode) {
    throw new Error(`${name}: expected ${statusCode}, got ${response.statusCode} ${response.body}`);
  }
  console.log(`PASS ${name}`);
  return payload(response);
}

const badLogin = await expect(
  "BACKEND-01 rejects invalid login",
  login.handler(event("POST", { username: "manager", password: "wrong-password" })),
  401
);
if (!badLogin.error) throw new Error("BACKEND-01 did not return a public error");

const managerLogin = await expect(
  "BACKEND-02 accepts manager login",
  login.handler(event("POST", { username: "manager", password: "Manager@123" })),
  200
);
const managerToken = managerLogin.token;

await expect("BACKEND-03 rejects malformed JSON", admin.handler({ httpMethod: "POST", headers: { authorization: `Bearer ${managerToken}` }, body: "{" }), 400);

await expect("BACKEND-04 creates product", admin.handler(event("POST", {
  resource: "product",
  data: { id: "SP-QA", name: "Sản phẩm QA", dosageCode: "BFS", dosageForm: "BFS", prescriptionPrice: 10000, status: "Active" }
}, managerToken)), 200);

await expect("BACKEND-05 creates customer", admin.handler(event("POST", {
  resource: "customer",
  data: { id: "KH-A", name: "Khách hàng A", type: "PhongMachTu", territoryId: "DB-A", status: "Active" }
}, managerToken)), 200);

await expect("BACKEND-06 creates employee account", admin.handler(event("POST", {
  resource: "employee",
  data: { id: "NV-A", name: "Nhân viên A", email: "employee@example.test", username: "employee", password: "Employee@123", role: "NhanVien", status: "Active" }
}, managerToken)), 200);

await expect("BACKEND-07 assigns territory", admin.handler(event("POST", {
  resource: "employee_territory",
  data: { employeeId: "NV-A", territoryId: "DB-A", isPrimary: true }
}, managerToken)), 200);

await expect("BACKEND-08 assigns customer", admin.handler(event("POST", {
  resource: "employee_customer",
  data: { employeeId: "NV-A", customerId: "KH-A" }
}, managerToken)), 200);

const employeeLogin = await expect(
  "BACKEND-09 accepts employee login",
  login.handler(event("POST", { username: "employee", password: "Employee@123" })),
  200
);
const employeeToken = employeeLogin.token;

const employeeData = await expect("BACKEND-10 filters employee scope", bootstrap.handler(event("GET", undefined, employeeToken)), 200);
if (employeeData.customers.length !== 1 || employeeData.customers[0].id !== "KH-A") {
  throw new Error("BACKEND-10 returned customers outside employee scope");
}

await expect("BACKEND-11 creates prescription", prescriptions.handler(event("POST", {
  date: "2026-08-20", customerId: "KH-A", productId: "SP-QA", quantity: 2
}, employeeToken)), 201);

await expect("BACKEND-12 creates sale", sales.handler(event("POST", {
  period: "2026-08", customerId: "KH-A", productId: "SP-QA", amount: 250000
}, employeeToken)), 201);

await expect("BACKEND-13 creates tender", tenders.handler(event("POST", {
  id: "GT-QA", customerId: "KH-A", productId: "SP-QA", status: "DangLamHoSo"
}, employeeToken)), 200);

await expect("BACKEND-14 rejects cross-scope write", prescriptions.handler(event("POST", {
  date: "2026-08-20", customerId: "KH-B", productId: "SP-QA", quantity: 1
}, employeeToken)), 403);

await expect("BACKEND-15 rejects cross-scope tender overwrite", tenders.handler(event("POST", {
  id: "GT-QA", customerId: "KH-B", productId: "SP-QA", status: "TrungThau"
}, employeeToken)), 403);

await expect("BACKEND-16 blocks deleting current manager", admin.handler(event("POST", {
  resource: "employee", action: "deactivate", data: { id: "QL-01" }
}, managerToken)), 400);

await expect("BACKEND-17 deactivates employee", admin.handler(event("POST", {
  resource: "employee", action: "deactivate", data: { id: "NV-A" }
}, managerToken)), 200);

await expect(
  "BACKEND-18 rejects inactive employee login",
  login.handler(event("POST", { username: "employee", password: "Employee@123" })),
  401
);

console.log("18 backend UAT checks passed.");
