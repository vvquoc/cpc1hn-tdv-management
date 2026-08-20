import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error("CODEX_NODE_MODULES is required");
const require = createRequire(path.join(modules, "package.json"));
const { chromium } = require("playwright");
const base = process.env.UI_BASE_URL || "http://127.0.0.1:4173";
const output = path.resolve("outputs");
fs.mkdirSync(output, { recursive: true });

const employees = Array.from({ length: 30 }, (_, index) => ({ id: `NV-${index + 1}`, name: `Nhân viên ${index + 1}`, email: "", role: index ? "NhanVien" : "QuanLy", status: "Active", territoryIds: ["DB-1"] }));
const customers = Array.from({ length: 40 }, (_, index) => ({ id: `KH-${index + 1}`, name: `Phòng mạch có tên dài số ${index + 1}`, type: "PhongMachTu", territoryId: "DB-1", status: "Active" }));
const products = Array.from({ length: 30 }, (_, index) => ({ id: `SP-${index + 1}`, name: `Sản phẩm chuyên biệt ${index + 1}`, dosageForm: "Dạng bào chế chuyên biệt", dosageCode: "Khac", prescriptionPrice: 100000, status: "Active" }));
const pageItems = (page, size, total, make) => Array.from({ length: Math.min(size, Math.max(0, total - (page - 1) * size)) }, (_, index) => make((page - 1) * size + index));

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
});
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      let payload = {};
      if (url.pathname.endsWith("/login")) payload = { token: "uat-token", user: employees[0] };
      else if (url.pathname.endsWith("/bootstrap-data")) payload = { activeUser: employees[0], territories: [{ id: "DB-1", name: "Đà Nẵng", region: "Miền Trung", status: "Active" }], employees, customers, products, prescriptions: [], sales: [], tenders: [], dailyReports: [], kpiTargets: [] };
      else if (url.pathname.endsWith("/admin-data")) payload = { accounts: employees.slice(0, 18).map((item, index) => ({ employeeId: item.id, username: `user${index + 1}` })), employeeTerritories: employees.map((item) => ({ employeeId: item.id, territoryId: "DB-1", isPrimary: true })), employeeCustomers: customers.map((item, index) => ({ employeeId: employees[index % employees.length].id, customerId: item.id })) };
      else if (url.pathname.endsWith("/dashboard")) payload = { period: "2026-06", availablePeriods: ["2026-06", "2026-05", "2026-04"], metrics: { sales: 6462226394, prescriptionQuantity: 1280, prescriptionAmount: 320000000, openTenders: 12, lostSales: 490 } };
      else if (url.pathname.endsWith("/lost-sales-trigger")) payload = { alerts: customers.map((item) => ({ customerId: item.id, customerName: item.name })) };
      else if (url.pathname.endsWith("/daily-reminders")) payload = { reminders: employees.slice(1).map((item) => ({ employeeId: item.id, employeeName: item.name, message: "Chưa có báo cáo hôm nay." })) };
      else {
        const pageNumber = Number(url.searchParams.get("page") || 1);
        const size = Number(url.searchParams.get("pageSize") || 15);
        if (url.pathname.endsWith("/sales")) payload = { page: pageNumber, pageSize: size, total: 180, items: pageItems(pageNumber, size, 180, (index) => ({ period: "2026-06", customerName: customers[index % customers.length].name, productName: products[index % products.length].name, amount: 1000000 + index })) };
        else if (url.pathname.endsWith("/prescriptions")) payload = { page: pageNumber, pageSize: size, total: 80, items: pageItems(pageNumber, size, 80, (index) => ({ date: "2026-06-20", employeeName: employees[index % employees.length].name, customerName: customers[index % customers.length].name, productName: products[index % products.length].name, quantity: 2, amount: 200000 })) };
        else if (url.pathname.endsWith("/tenders")) payload = { page: pageNumber, pageSize: size, total: 45, items: pageItems(pageNumber, size, 45, (index) => ({ id: `GT-${index + 1}`, customerName: customers[index % customers.length].name, productName: products[index % products.length].name, status: "DangLamHoSo", dueDate: "2026-09-30", employeeName: employees[index % employees.length].name })) };
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
    });

    await page.goto(base, { waitUntil: "networkidle" });
    await page.fill("[name='username']", "15795");
    await page.fill("[name='password']", "password");
    await page.click("#loginForm button[type='submit']");
    await page.waitForSelector("#appShell:not([hidden])");
    await page.screenshot({ path: path.join(output, `ui-${viewport.name}-dashboard.png`), fullPage: true });
    await page.click("[data-view='sales']");
    await page.fill("#salesFilter [name='search']", "Phòng mạch 2");
    const filteredRequest = page.waitForRequest((request) => request.url().includes("/api/v1/sales?") && request.url().includes("search=Ph%C3%B2ng+m%E1%BA%A1ch+2"));
    await page.click("#salesFilter button[type='submit']");
    await filteredRequest;
    await page.screenshot({ path: path.join(output, `ui-${viewport.name}-sales.png`), fullPage: true });
    await page.click("[data-view='admin']");
    await page.click("[data-admin-tab='assignment']");
    await page.screenshot({ path: path.join(output, `ui-${viewport.name}-admin.png`), fullPage: true });
    await page.click("[data-view='alerts']");
    await page.click("#runLostSale");
    await page.waitForTimeout(50);
    await page.screenshot({ path: path.join(output, `ui-${viewport.name}-alerts.png`), fullPage: true });

    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      visiblePanels: [...document.querySelectorAll("[data-view-panel]")].filter((item) => !item.hidden).length,
      lostRows: document.querySelectorAll("#lostSaleList li").length,
      reminderRows: document.querySelectorAll("#reminderList li").length,
      assignmentRows: document.querySelectorAll("#customerAssignmentList li").length
    }));
    if (result.overflow) throw new Error(`${viewport.name}: horizontal page overflow`);
    if (result.visiblePanels !== 1) throw new Error(`${viewport.name}: expected one visible screen`);
    if (result.lostRows > 6 || result.reminderRows > 6 || result.assignmentRows > 6) throw new Error(`${viewport.name}: an unbounded list was rendered`);
    console.log(`PASS ${viewport.name}: ${JSON.stringify(result)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
