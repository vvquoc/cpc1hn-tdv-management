import fs from "node:fs";

const HEADERS = ["Quản lý", "NV kinh doanh", "Tên NV KD", "Tỉnh", "Nhóm KH", "Tháng", "Năm", "Mã Kh", "Tên KH", "Ngày chứng từ", "Số Chứng từ ngoại", "Mã HH", "Tên HH", "DVT", "Số Lượng", "Đơn giá", "Doanh thu", "Hệ số", "DOANH SỐ"];
const file = process.argv.find((arg) => arg.endsWith(".csv")) || "data-sale-production.csv";
const checkOnly = process.argv.includes("--check");
const base = process.env.QA_BASE_URL || "https://cpc1hn-tdv-management.netlify.app";
const password = process.env.QA_MANAGER_PASSWORD;
const chunkSize = Number(process.env.QA_CHUNK_SIZE || 200);

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift().map((value) => value.replace(/^\uFEFF/, "").trim());
  return rows.map((cells) => Object.fromEntries(HEADERS.map((header) => [header, cells[headers.indexOf(header)] || ""])));
}

function localeNumber(value, coefficient = false) {
  let raw = String(value || "").replace(/\s/g, "");
  if (!raw || raw === "-") return 0;
  const negative = /^\(.+\)$/.test(raw);
  if (negative) raw = raw.slice(1, -1);
  let normalized = raw;
  if (coefficient) normalized = raw.replace(",", ".");
  else if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(raw)) normalized = raw.replace(",", ".");
  else if (raw.includes(".") && raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  return Number(normalized) * (negative ? -1 : 1);
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${body.error || "Unknown error"}`);
  return body;
}

const rows = parseCsv(fs.readFileSync(file, "utf8"));
const missing = HEADERS.filter((header) => !Object.prototype.hasOwnProperty.call(rows[0] || {}, header));
if (missing.length) throw new Error(`Missing headers: ${missing.join(", ")}`);
const blankCounts = Object.fromEntries(HEADERS.map((header) => [header, rows.filter((row) => !row[header]).length]));
const invalidRows = rows.filter((row) => !Number.isFinite(localeNumber(row["DOANH SỐ"])));
const invalidNumbers = invalidRows.length;
const expectedSales = rows.reduce((sum, row) => sum + localeNumber(row["DOANH SỐ"]), 0);
console.log(JSON.stringify({ file, rows: rows.length, blankCounts, invalidNumbers, invalidSamples: invalidRows.slice(0, 10).map((row) => row["DOANH SỐ"]), expectedSales }));
if (checkOnly) process.exit(invalidNumbers ? 1 : 0);
if (!password) throw new Error("QA_MANAGER_PASSWORD is required");

const login = await request("/api/v1/login", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "15795", password })
});
let batchId = null;
for (let index = 0; index < rows.length; index += chunkSize) {
  const chunk = rows.slice(index, index + chunkSize);
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await request("/api/v1/data-sale-import", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${login.token}` },
        body: JSON.stringify({ batchId, startRow: index + 2, rows: chunk, final: index + chunk.length === rows.length })
      });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  batchId = result.batchId;
  console.log(`Imported ${index + chunk.length}/${rows.length}`);
}

const stats = await request("/api/v1/data-sale-import", { headers: { authorization: `Bearer ${login.token}` } });
const tolerance = Math.max(1, Math.abs(expectedSales) * 1e-9);
if (stats.rowCount !== rows.length || stats.sourceRowCount !== rows.length || stats.minSourceRow !== 2 || stats.maxSourceRow !== rows.length + 1) {
  throw new Error(`Row reconciliation failed: ${JSON.stringify(stats)}`);
}
if (Math.abs(stats.totalSales - expectedSales) > tolerance) throw new Error(`Sales reconciliation failed: expected ${expectedSales}, got ${stats.totalSales}`);
console.log(JSON.stringify({ status: "PASS", expectedRows: rows.length, expectedSales, ...stats }));
