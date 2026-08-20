import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.AUTH_TOKEN_SECRET = "backend-uat-only-secret-with-enough-entropy";

const { hashPassword, verifyPassword } = require("../netlify/functions/shared/credentials.js");
const { createToken, verifyToken } = require("../netlify/functions/shared/auth.js");
const { parseBody } = require("../netlify/functions/shared/http.js");
const dataSale = require("../netlify/functions/data-sale-import.js")._test;

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, status: "FAIL", error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
function assert(value, message) {
  if (!value) throw new Error(message);
}
function source(file) {
  return fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

check("BACKEND-01 hashes and verifies a password", () => {
  const credential = hashPassword("Employee@123");
  assert(verifyPassword("Employee@123", credential), "valid password rejected");
  assert(!verifyPassword("Wrong@123", credential), "invalid password accepted");
});

check("BACKEND-02 rejects short passwords", () => {
  let rejected = false;
  try { hashPassword("short"); } catch (error) { rejected = error.statusCode === 400; }
  assert(rejected, "short password was accepted");
});

check("BACKEND-03 creates portable stateless tokens", () => {
  const token = createToken("NV-UAT");
  assert(verifyToken(token)?.employeeId === "NV-UAT", "token cannot be verified independently");
});

check("BACKEND-04 rejects modified tokens", () => {
  const token = createToken("NV-UAT");
  assert(verifyToken(`${token}x`) === null, "modified token accepted");
});

check("BACKEND-05 parses JSON requests", () => {
  assert(parseBody({ body: '{"ok":true}' }).ok === true, "valid JSON rejected");
});

check("BACKEND-06 rejects malformed JSON", () => {
  let rejected = false;
  try { parseBody({ body: "{" }); } catch (error) { rejected = error.statusCode === 400; }
  assert(rejected, "malformed JSON accepted");
});

check("BACKEND parses Vietnamese DATA SALE numbers exactly", () => {
  assert(dataSale.numeric("1.111.111", "DOANH SỐ") === 1111111, "thousand separators failed");
  assert(dataSale.numeric("30.714,286", "Đơn giá") === 30714.286, "decimal separators failed");
  assert(dataSale.numeric("1,5", "Hệ số") === 1.5, "coefficient failed");
  assert(dataSale.numeric("-", "DOANH SỐ") === 0, "accounting zero failed");
  assert(dataSale.numeric("(895.238)", "DOANH SỐ") === -895238, "accounting negative failed");
});

const migration = source("netlify/database/migrations/009_lightweight_crud_auth.sql");
check("BACKEND-07 makes Email optional", () => assert(migration.includes("email drop not null"), "Email remains mandatory"));
check("BACKEND-08 enforces one login per employee", () => assert(migration.includes("uq_auth_credentials_employee"), "credential uniqueness missing"));

const cleanup = source("netlify/database/migrations/010_remove_demo_uat_data.sql");
check("BACKEND cleanup removes only known demo and UAT IDs", () => {
  assert(cleanup.includes("UAT-E2E-NV") && cleanup.includes("NV-DN-01"), "known demo IDs missing");
  assert(!cleanup.includes("SALE_KH_") && !cleanup.includes("SALE_SP_"), "real DATA SALE IDs must be preserved");
});

const store = source("netlify/functions/shared/store.js");
check("BACKEND reports do not truncate stored data", () => assert(!/order by[^\n]+limit\s+\d+/i.test(store), "report query still has a fixed row limit"));

const admin = source("netlify/functions/admin-data.js");
check("BACKEND-09 admin CRUD uses direct database writes", () => {
  assert(admin.includes("requireDatabaseUser") && admin.includes("getPool"), "direct database path missing");
  assert(!admin.includes("saveData"), "admin still rewrites the full database");
});
check("BACKEND-10 employee creation does not require Email", () => {
  assert(!admin.includes('required(payload.email'), "Email is still required");
  assert(admin.includes("Nhân viên mới cần có tài khoản và mật khẩu"), "account requirement missing");
});
check("BACKEND-11 credentials are persisted in the same transaction", () => {
  assert(admin.includes("insert into auth_credentials") && admin.includes('client.query("commit")'), "credential transaction missing");
});
check("BACKEND-12 manager cannot deactivate the active account", () => assert(admin.includes("Không thể vô hiệu hóa tài khoản đang đăng nhập"), "manager protection missing"));

const transfer = source("netlify/functions/data-transfer.js");
check("BACKEND-13 standard import uses direct transactions", () => {
  assert(transfer.includes("requireDatabaseUser") && transfer.includes('client.query("begin")'), "transactional import missing");
  assert(!transfer.includes("saveData"), "import still rewrites the full database");
});
check("BACKEND-14 employee import supports login credentials", () => {
  assert(transfer.includes('"tai_khoan", "username"') && transfer.includes('"mat_khau", "password"'), "credential columns missing");
});

for (const endpoint of ["prescriptions", "sales", "tenders"]) {
  check(`BACKEND direct write: ${endpoint}`, () => {
    const code = source(`netlify/functions/${endpoint}.js`);
    assert(code.includes("requireDatabaseUser") && code.includes("assertDatabaseCustomerAccess"), "portable auth or scope check missing");
    assert(!code.includes("saveData"), "endpoint still rewrites the full database");
  });
}

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length) process.exit(1);
console.log(`${checks.length} backend UAT checks passed.`);
