const STORAGE_TOKEN_KEY = "cpc1hn-tdv-auth-token";
const STORAGE_USER_KEY = "cpc1hn-tdv-auth-user";
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

const statusLabel = {
  DangLamHoSo: "Đang làm hồ sơ",
  ChoKetQua: "Chờ kết quả",
  TrungThau: "Trúng thầu",
  TruotThau: "Trượt thầu"
};

let state = structuredClone(window.CPC1_SEED);
let apiReady = false;
let authToken = localStorage.getItem(STORAGE_TOKEN_KEY) || "";
let authUser;
const pageSize = 20;
const operationState = {
  prescriptions: { page: 1, total: 0, items: [] },
  sales: { page: 1, total: 0, items: [] },
  tenders: { page: 1, total: 0, items: [] }
};
const adminState = {
  activeTab: "employee",
  pageSize: 15,
  pages: { employee: 1, product: 1, customer: 1, territory: 1 },
  searches: { employee: "", product: "", customer: "", territory: "" }
};
let dashboardState = { period: "", availablePeriods: [], metrics: {} };
try {
  authUser = JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || "null");
} catch {
  localStorage.removeItem(STORAGE_USER_KEY);
  authUser = null;
}

const roleLabel = {
  NhanVien: "Nhân viên",
  QuanLy: "Quản lý",
  MR: "Nhân viên",
  Supervisor: "Nhân viên",
  Manager: "Quản lý",
  Admin: "Quản lý"
};

const sampleCsvByResource = {
  employees: "tb_nhan_su.csv",
  territories: "tb_dia_ban.csv",
  products: "tb_san_pham.csv",
  customers: "tb_khach_hang.csv",
  employeeTerritories: "employee_territories.csv",
  employeeCustomers: "employee_customers.csv",
  prescriptions: "tb_ke_don.csv",
  sales: "tb_doanh_thu.csv",
  dataSale: "data_sale_transactions.csv",
  tenders: "tb_thau.csv",
  dailyReports: "daily_reports.csv",
  kpiTargets: "kpi_targets.csv"
};

function currentDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function currentPeriod() {
  return currentDate().slice(0, 7);
}

function activeEmployee() {
  return state.activeUser || authUser || state.employees[0];
}

function canAdmin() {
  const employee = activeEmployee();
  return employee && ["QuanLy", "Admin", "Manager"].includes(employee.role);
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      signal: options.signal || AbortSignal.timeout(45000),
      headers: {
        "content-type": "application/json",
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    const message = error.name === "TimeoutError"
      ? "Máy chủ phản hồi quá lâu. Vui lòng thử lại."
      : "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.";
    const networkError = new Error(message);
    networkError.status = 0;
    throw networkError;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Máy chủ không xử lý được yêu cầu.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function byId(collection, id) {
  return collection.find((item) => item.id === id);
}

function html(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function latestPeriods(count) {
  const periods = new Set(state.sales.map((sale) => sale.period));
  return [...periods].sort().slice(-count);
}

function computeLostSales(customers) {
  const periods = latestPeriods(4);
  if (periods.length < 4) return [];

  return customers.filter((customer) => {
    if (customer.type !== "PhongMachTu") return false;
    const customerSales = state.sales.filter((sale) => sale.customerId === customer.id);
    const hadEarlierSale = customerSales.some((sale) => !periods.includes(sale.period) && sale.amount > 0);
    const recentTotal = customerSales
      .filter((sale) => periods.includes(sale.period))
      .reduce((sum, sale) => sum + Number(sale.amount), 0);
    return hadEarlierSale && recentTotal === 0;
  });
}

function setOptions(select, items, labelFor) {
  select.innerHTML = items.map((item) => `<option value="${html(item.id || item.email)}">${html(labelFor(item))}</option>`).join("");
}

function showNotice(message) {
  let notice = document.querySelector("#notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "notice";
    notice.className = "notice";
    document.querySelector("main").prepend(notice);
  }
  notice.textContent = message;
  notice.hidden = !message;
}

function showLogin(message = "") {
  document.querySelector("#loginScreen").hidden = false;
  document.querySelector("#appShell").hidden = true;
  document.querySelector("#loginMessage").textContent = message;
}

function showApp() {
  document.querySelector("#loginScreen").hidden = true;
  document.querySelector("#appShell").hidden = false;
}

async function loadData() {
  if (!authToken) return showLogin();
  try {
    const data = await api("/api/v1/bootstrap-data");
    state = data;
    authUser = data.activeUser;
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser));
    apiReady = true;
    if (["QuanLy", "Admin", "Manager"].includes(state.activeUser?.role)) {
      const assignments = await api("/api/v1/admin-data");
      state.employeeTerritories = assignments.employeeTerritories || [];
      state.employeeCustomers = assignments.employeeCustomers || [];
      state.accounts = assignments.accounts || [];
    }
    await loadDashboard();
    await Promise.all([
      loadOperationPage("prescriptions", 1),
      loadOperationPage("sales", 1),
      loadOperationPage("tenders", 1)
    ]);
    showApp();
    showNotice("");
  } catch (error) {
    apiReady = false;
    if (error.status === 401 || error.status === 403) {
      authToken = "";
      authUser = null;
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    }
    showLogin(error.message);
    return;
  }
  render();
}

async function loadDashboard(period = "") {
  const query = period ? `?period=${encodeURIComponent(period)}` : "";
  dashboardState = await api(`/api/v1/dashboard${query}`);
}

async function loadOperationPage(resource, page = 1) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (dashboardState.period && resource !== "tenders") params.set("period", dashboardState.period);
  const payload = await api(`/api/v1/${resource}?${params}`);
  operationState[resource] = { page: payload.page, total: payload.total, items: payload.items || [] };
}

async function refreshReporting(period = dashboardState.period) {
  await loadDashboard(period);
  await Promise.all([
    loadOperationPage("prescriptions", 1),
    loadOperationPage("sales", 1),
    loadOperationPage("tenders", 1)
  ]);
  render();
}

function paginationMarkup(resource, data, admin = false) {
  const size = admin ? adminState.pageSize : pageSize;
  const pages = Math.max(1, Math.ceil(data.total / size));
  const page = Math.min(data.page, pages);
  return `<span>${html(data.total)} bản ghi · Trang ${page}/${pages}</span>
    <button type="button" class="secondary-button" data-page-resource="${resource}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Trang trước">‹</button>
    <button type="button" class="secondary-button" data-page-resource="${resource}" data-page="${page + 1}" ${page >= pages ? "disabled" : ""} aria-label="Trang sau">›</button>`;
}

function render() {
  const employee = activeEmployee();
  const customers = state.customers || [];
  const activeCustomers = customers.filter((customer) => customer.status !== "Inactive");
  const activeProducts = (state.products || []).filter((product) => product.status !== "Inactive");
  const prescriptions = operationState.prescriptions.items;
  const sales = operationState.sales.items;
  const tenders = operationState.tenders.items;
  const metrics = dashboardState.metrics || {};

  document.querySelector("#activeAccount").textContent = `${employee.name} · ${roleLabel[employee.role] || employee.role}`;
  document.querySelector("#scopeLabel").textContent = `${employee.name} · ${roleLabel[employee.role] || employee.role} · ${(employee.territoryIds || []).join(", ")}`;
  document.querySelector("#metricSales").textContent = currency.format(metrics.sales || 0);
  document.querySelector("#metricRx").textContent = Number(metrics.prescriptionQuantity || 0).toLocaleString("vi-VN");
  document.querySelector("#metricTenders").textContent = metrics.openTenders || 0;
  document.querySelector("#metricLostSales").textContent = metrics.lostSales || 0;
  const reportingPeriod = document.querySelector("#reportingPeriod");
  reportingPeriod.innerHTML = (dashboardState.availablePeriods || []).map((period) => `<option value="${html(period)}">${html(period)}</option>`).join("") || `<option value="${html(dashboardState.period)}">${html(dashboardState.period)}</option>`;
  reportingPeriod.value = dashboardState.period;

  document.querySelectorAll("form:not(#customerAssignForm) select[name='customerId']").forEach((select) => {
    setOptions(select, activeCustomers, (customer) => customer.name);
  });
  document.querySelectorAll("select[name='productId']").forEach((select) => {
    setOptions(select, activeProducts, (product) => `${product.name} · ${product.dosageForm}`);
  });

  document.querySelector("#prescriptionRows").innerHTML = prescriptions
    .map((item) => {
      return `<tr><td>${html(item.date)}</td><td>${html(item.employeeName || item.employeeId)}</td><td>${html(item.customerName || item.customerId)}</td><td>${html(item.productName || item.productId)}</td><td>${html(item.quantity)}</td><td>${html(currency.format(item.amount || 0))}</td></tr>`;
    })
    .join("") || '<tr><td colspan="6">Chưa có dữ liệu trong kỳ.</td></tr>';
  document.querySelector("#prescriptionPagination").innerHTML = paginationMarkup("prescriptions", operationState.prescriptions);

  document.querySelector("#salesRows").innerHTML = sales
    .map((item) => {
      return `<tr><td>${html(item.period)}</td><td>${html(item.customerName || item.customerId)}</td><td>${html(item.productName || item.productId)}</td><td>${html(currency.format(item.amount))}</td></tr>`;
    })
    .join("") || '<tr><td colspan="4">Chưa có dữ liệu trong kỳ.</td></tr>';
  document.querySelector("#salesPagination").innerHTML = paginationMarkup("sales", operationState.sales);

  document.querySelector("#tenderRows").innerHTML = tenders
    .map((item) => {
      const statusClass = item.status === "DangLamHoSo" ? "status-warn" : item.status === "TrungThau" ? "status-win" : "";
      return `<tr><td>${html(item.id)}</td><td>${html(item.customerName || item.customerId)}</td><td>${html(item.productName || item.productId)}</td><td><span class="status ${statusClass}">${html(statusLabel[item.status] || item.status)}</span></td><td>${html(item.dueDate || "")}</td><td>${html(item.employeeName || item.employeeId)}</td></tr>`;
    })
    .join("") || '<tr><td colspan="6">Chưa có dữ liệu thầu.</td></tr>';
  document.querySelector("#tenderPagination").innerHTML = paginationMarkup("tenders", operationState.tenders);

  renderAlerts([], []);
  renderAdmin();
}

function renderAlerts(lostSales, reminders) {
  document.querySelector("#lostSaleList").innerHTML = lostSales.length
    ? lostSales.map((customer) => `<li><strong>${html(customer.name || customer.customerName)}</strong><br />Không phát sinh doanh số trong 4 tháng gần nhất.</li>`).join("")
    : "<li>Không có cảnh báo trong phạm vi hiện tại.</li>";

  const today = currentDate();
  const fallbackReminders = reminders.length
    ? reminders
    : (state.employees || []).filter((item) => ["NhanVien", "MR", "Supervisor"].includes(item.role) && !(state.dailyReports || []).some((report) => report.employeeId === item.id && report.date === today));

  document.querySelector("#reminderList").innerHTML = fallbackReminders.length
    ? fallbackReminders.map((item) => `<li><strong>${html(item.employeeName || item.name)}</strong><br />${html(item.message || `Chưa có báo cáo ngày ${today}.`)}</li>`).join("")
    : "<li>Tất cả TDV trong phạm vi đã báo cáo hôm nay.</li>";
}

function getFormObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll("input[type='checkbox']").forEach((input) => {
    data[input.name] = input.checked;
  });
  return data;
}

async function postAdmin(resource, data, action = "upsert") {
  await api("/api/v1/admin-data", {
    method: "POST",
    body: JSON.stringify({ resource, action, data })
  });
  await loadData();
  showNotice(action === "deactivate" || action === "remove" ? "Đã xóa dữ liệu." : "Đã lưu dữ liệu.");
}

function downloadFile(fileName, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  const headers = rows.shift() || [];
  if (headers[0]) headers[0] = headers[0].replace(/^\uFEFF/, "");
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

async function importDataSale(rows) {
  const chunkSize = 500;
  let batchId = null;
  let imported = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const result = await api("/api/v1/data-sale-import", {
      method: "POST",
      body: JSON.stringify({
        batchId,
        startRow: index + 2,
        rows: chunk,
        final: index + chunk.length >= rows.length
      })
    });
    batchId = result.batchId;
    imported += result.imported || 0;
    showNotice(`Đang nhập DATA SALE: ${imported}/${rows.length} dòng.`);
  }
  return imported;
}

async function importStandardData(resource, rows) {
  const chunkSize = 250;
  let imported = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const result = await api("/api/v1/data-transfer", {
      method: "POST",
      body: JSON.stringify({ resource, startRow: index + 2, rows: chunk })
    });
    imported += result.imported || 0;
    showNotice(`Đang import: ${imported}/${rows.length} dòng.`);
  }
  return imported;
}

function fillForm(formId, data) {
  const form = document.querySelector(formId);
  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(value);
    } else {
      field.value = value ?? "";
    }
  });
}

function adminPage(resource, items, textFor) {
  const search = adminState.searches[resource].toLocaleLowerCase("vi");
  const filtered = search
    ? items.filter((item) => textFor(item).toLocaleLowerCase("vi").includes(search))
    : items;
  const pages = Math.max(1, Math.ceil(filtered.length / adminState.pageSize));
  const page = Math.min(adminState.pages[resource], pages);
  adminState.pages[resource] = page;
  return {
    items: filtered.slice((page - 1) * adminState.pageSize, page * adminState.pageSize),
    page,
    total: filtered.length
  };
}

function renderAdmin() {
  const adminVisible = canAdmin();
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = !adminVisible;
  });
  if (!adminVisible) return;

  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== adminState.activeTab;
  });
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === adminState.activeTab);
  });

  const employees = state.employees || [];
  const activeEmployees = employees.filter((employee) => employee.status !== "Inactive");
  const territories = state.territories || [];
  const activeTerritories = territories.filter((territory) => territory.status !== "Inactive");
  const products = state.products || [];
  const customers = state.customers || [];
  const activeCustomers = customers.filter((customer) => customer.status !== "Inactive");
  const accounts = state.accounts || [];
  const accountByEmployee = new Map(accounts.map((account) => [account.employeeId, account]));
  document.querySelector("#accountSummary").textContent = `${employees.length} hồ sơ nhân sự · ${accounts.length} tài khoản đăng nhập`;

  document.querySelectorAll("#territoryAssignForm select[name='employeeId'], #customerAssignForm select[name='employeeId']").forEach((select) => {
    setOptions(select, activeEmployees, (employee) => `${employee.name} · ${roleLabel[employee.role] || employee.role}`);
  });
  document.querySelectorAll("#customerForm select[name='territoryId'], #territoryAssignForm select[name='territoryId']").forEach((select) => {
    setOptions(select, activeTerritories, (territory) => territory.name);
  });
  setOptions(document.querySelector("#customerAssignForm select[name='customerId']"), activeCustomers, (customer) => customer.name);

  const employeePage = adminPage("employee", employees, (employee) => `${employee.id} ${employee.name} ${employee.email} ${accountByEmployee.get(employee.id)?.username || ""}`);
  document.querySelector("#employeeAdminList").innerHTML = employeePage.items
    .map((employee) => `
      <li>
        <strong>${html(employee.name)}</strong><br />
        ${html(employee.id)} · ${html(roleLabel[employee.role] || employee.role)} · ${html(employee.status || "Active")}<br />
        ${accountByEmployee.has(employee.id) ? `Tài khoản: <strong>${html(accountByEmployee.get(employee.id).username)}</strong>` : '<span class="account-missing">Chưa có tài khoản đăng nhập</span>'}
        <div class="inline-actions">
          <button class="secondary-button" data-edit-employee="${html(employee.id)}">Sửa</button>
          <button class="danger-button" data-deactivate-employee="${html(employee.id)}">Xóa</button>
        </div>
      </li>`)
    .join("");
  document.querySelector("#employeeAdminPagination").innerHTML = paginationMarkup("admin:employee", employeePage, true);

  const productPage = adminPage("product", products, (product) => `${product.id} ${product.name} ${product.dosageForm}`);
  document.querySelector("#productAdminList").innerHTML = productPage.items
    .map((product) => `
      <li>
        <strong>${html(product.name)}</strong><br />
        ${html(product.id)} · ${html(product.dosageForm)} · ${html(currency.format(product.prescriptionPrice || 0))} · ${html(product.status || "Active")}
        <div class="inline-actions">
          <button class="secondary-button" data-edit-product="${html(product.id)}">Sửa</button>
          <button class="danger-button" data-deactivate-product="${html(product.id)}">Xóa</button>
        </div>
      </li>`)
    .join("");
  document.querySelector("#productAdminPagination").innerHTML = paginationMarkup("admin:product", productPage, true);

  const customerPage = adminPage("customer", customers, (customer) => `${customer.id} ${customer.name} ${customer.type}`);
  document.querySelector("#customerAdminList").innerHTML = customerPage.items
    .map((customer) => `
      <li>
        <strong>${html(customer.name)}</strong><br />
        ${html(customer.id)} · ${html(customer.type)} · ${html(customer.territoryId)} · ${html(customer.status || "Active")}
        <div class="inline-actions">
          <button class="secondary-button" data-edit-customer="${html(customer.id)}">Sửa</button>
          <button class="danger-button" data-deactivate-customer="${html(customer.id)}">Xóa</button>
        </div>
      </li>`)
    .join("");
  document.querySelector("#customerAdminPagination").innerHTML = paginationMarkup("admin:customer", customerPage, true);

  const territoryPage = adminPage("territory", territories, (territory) => `${territory.id} ${territory.name} ${territory.region}`);
  document.querySelector("#territoryAdminList").innerHTML = territoryPage.items
    .map((territory) => `
      <li>
        <strong>${html(territory.name)}</strong><br />
        ${html(territory.id)} · ${html(territory.region)} · ${html(territory.status || "Active")}
        <div class="inline-actions">
          <button class="secondary-button" data-edit-territory="${html(territory.id)}">Sửa</button>
          <button class="danger-button" data-deactivate-territory="${html(territory.id)}">Xóa</button>
        </div>
      </li>`)
    .join("");
  document.querySelector("#territoryAdminPagination").innerHTML = paginationMarkup("admin:territory", territoryPage, true);

  document.querySelector("#territoryAssignmentList").innerHTML = (state.employeeTerritories || [])
    .map((assignment) => {
      const employee = byId(employees, assignment.employeeId) || {};
      const territory = byId(territories, assignment.territoryId) || {};
      return `<li>
        <strong>${html(employee.name || assignment.employeeId)}</strong><br />
        ${html(territory.name || assignment.territoryId)}${assignment.isPrimary ? " · Địa bàn chính" : ""}
        <div class="inline-actions">
          <button class="danger-button" data-remove-territory="${html(assignment.employeeId)}:${html(assignment.territoryId)}">Xóa phân công</button>
        </div>
      </li>`;
    })
    .join("") || "<li>Chưa có phân công địa bàn.</li>";

  document.querySelector("#customerAssignmentList").innerHTML = (state.employeeCustomers || [])
    .map((assignment) => {
      const employee = byId(employees, assignment.employeeId) || {};
      const customer = byId(customers, assignment.customerId) || {};
      return `<li>
        <strong>${html(employee.name || assignment.employeeId)}</strong><br />
        ${html(customer.name || assignment.customerId)}
        <div class="inline-actions">
          <button class="danger-button" data-remove-customer="${html(assignment.employeeId)}:${html(assignment.customerId)}">Xóa phân công</button>
        </div>
      </li>`;
    })
    .join("") || "<li>Chưa có phân công khách hàng.</li>";
}

function bindForms() {
  document.querySelector("#reportingPeriod").addEventListener("change", async (event) => {
    try {
      await refreshReporting(event.target.value);
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("main").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-page-resource]");
    if (!button || button.disabled) return;
    const resource = button.dataset.pageResource;
    const page = Number(button.dataset.page);
    if (resource.startsWith("admin:")) {
      const adminResource = resource.split(":")[1];
      adminState.pages[adminResource] = page;
      renderAdmin();
      return;
    }
    try {
      await loadOperationPage(resource, page);
      render();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#admin").addEventListener("input", (event) => {
    const resource = event.target.dataset.adminSearch;
    if (!resource) return;
    adminState.searches[resource] = event.target.value;
    adminState.pages[resource] = 1;
    renderAdmin();
    const input = document.querySelector(`[data-admin-search='${resource}']`);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    document.querySelector("#loginMessage").textContent = "";

    try {
      const payload = await api("/api/v1/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password")
        })
      });

      authToken = payload.token;
      authUser = payload.user;
      localStorage.setItem(STORAGE_TOKEN_KEY, authToken);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser));
      target.reset();
      await loadData();
      showNotice("Đăng nhập thành công.");
    } catch (error) {
      showLogin(error.message);
    }
  });

  document.querySelector("#logoutButton").addEventListener("click", async () => {
    try {
      await api("/api/v1/logout", { method: "POST" });
    } catch {
      // Local logout should still proceed if the remote session is already gone.
    }
    authToken = "";
    authUser = null;
    apiReady = false;
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    showLogin();
  });

  document.querySelector("#prescriptionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể ghi kê đơn.");

    const target = event.currentTarget;
    const form = new FormData(target);
    const period = String(form.get("date")).slice(0, 7);
    try {
      await api("/api/v1/prescriptions", {
        method: "POST",
        body: JSON.stringify({
          date: form.get("date"),
          customerId: form.get("customerId"),
          productId: form.get("productId"),
          quantity: Number(form.get("quantity"))
        })
      });
      target.reset();
      setDefaultDates();
      await refreshReporting(period);
      showNotice("Đã lưu kê đơn.");
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#salesForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể ghi doanh số.");

    const target = event.currentTarget;
    const form = new FormData(target);
    const period = form.get("period");
    try {
      await api("/api/v1/sales", {
        method: "POST",
        body: JSON.stringify({
          period: form.get("period"),
          customerId: form.get("customerId"),
          productId: form.get("productId"),
          amount: Number(form.get("amount"))
        })
      });
      target.reset();
      setDefaultDates();
      await refreshReporting(period);
      showNotice("Đã lưu doanh số.");
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#tenderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể lưu gói thầu.");

    const target = event.currentTarget;
    try {
      await api("/api/v1/tenders", {
        method: "POST",
        body: JSON.stringify(getFormObject(target))
      });
      target.reset();
      await refreshReporting();
      showNotice("Đã lưu gói thầu.");
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#employeeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = event.currentTarget;
    try {
      await postAdmin("employee", getFormObject(target));
      target.reset();
      target.elements.password.required = true;
      target.elements.password.placeholder = "Tối thiểu 8 ký tự";
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#territoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = event.currentTarget;
    try {
      await postAdmin("territory", getFormObject(target));
      target.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = event.currentTarget;
    try {
      await postAdmin("product", getFormObject(target));
      target.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#customerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = event.currentTarget;
    try {
      await postAdmin("customer", getFormObject(target));
      target.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#territoryAssignForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = event.currentTarget;
    try {
      await postAdmin("employee_territory", getFormObject(target));
      target.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#customerAssignForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = event.currentTarget;
    try {
      await postAdmin("employee_customer", getFormObject(target));
      target.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#admin").addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.adminTab) {
      adminState.activeTab = button.dataset.adminTab;
      renderAdmin();
      return;
    }

    const employeeId = button.dataset.editEmployee || button.dataset.deactivateEmployee;
    const productId = button.dataset.editProduct || button.dataset.deactivateProduct;
    const customerId = button.dataset.editCustomer || button.dataset.deactivateCustomer;
    const territoryId = button.dataset.editTerritory || button.dataset.deactivateTerritory;
    const territoryAssignment = button.dataset.removeTerritory;
    const customerAssignment = button.dataset.removeCustomer;

    try {
      if (button.dataset.editEmployee) {
        const employee = byId(state.employees, employeeId);
        fillForm("#employeeForm", employee);
        const account = (state.accounts || []).find((item) => item.employeeId === employeeId);
        document.querySelector("#employeeForm [name='username']").value = account?.username || "";
        document.querySelector("#employeeForm [name='password']").value = "";
        document.querySelector("#employeeForm [name='password']").required = false;
        document.querySelector("#employeeForm [name='password']").placeholder = "Để trống nếu không đổi";
      } else if (button.dataset.deactivateEmployee) {
        await postAdmin("employee", { id: employeeId }, "deactivate");
      } else if (button.dataset.editProduct) {
        const product = byId(state.products, productId);
        fillForm("#productForm", product);
      } else if (button.dataset.deactivateProduct) {
        await postAdmin("product", { id: productId }, "deactivate");
      } else if (button.dataset.editCustomer) {
        const customer = byId(state.customers, customerId);
        fillForm("#customerForm", customer);
      } else if (button.dataset.deactivateCustomer) {
        await postAdmin("customer", { id: customerId }, "deactivate");
      } else if (button.dataset.editTerritory) {
        const territory = byId(state.territories, territoryId);
        fillForm("#territoryForm", territory);
      } else if (button.dataset.deactivateTerritory) {
        await postAdmin("territory", { id: territoryId }, "deactivate");
      } else if (territoryAssignment) {
        const [employeeId, territoryId] = territoryAssignment.split(":");
        await postAdmin("employee_territory", { employeeId, territoryId }, "remove");
      } else if (customerAssignment) {
        const [employeeId, customerId] = customerAssignment.split(":");
        await postAdmin("employee_customer", { employeeId, customerId }, "remove");
      }
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#employeeForm").addEventListener("reset", (event) => {
    setTimeout(() => {
      event.currentTarget.elements.password.required = true;
      event.currentTarget.elements.password.placeholder = "Tối thiểu 8 ký tự";
    }, 0);
  });

  document.querySelector("#exportData").addEventListener("click", async () => {
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể export.");

    try {
      const payload = await api("/api/v1/data-transfer");
      downloadFile(`cpc1hn-export-${currentDate()}.json`, JSON.stringify(payload, null, 2));
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#importForm select[name='resource']").addEventListener("change", (event) => {
    const fileName = sampleCsvByResource[event.target.value] || "tb_nhan_su.csv";
    const link = document.querySelector("#sampleCsvLink");
    link.href = `./templates/csv/${fileName}`;
    link.download = fileName;
  });

  document.querySelector("#importForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể import.");

    const form = event.currentTarget;
    const resource = form.elements.resource.value;
    const file = form.elements.file.files[0];
    if (!file) return showNotice("Chưa chọn file CSV.");

    try {
      const rows = parseCsv(await file.text());
      const imported = resource === "dataSale"
        ? await importDataSale(rows)
        : await importStandardData(resource, rows);
      showNotice(`Import xong ${imported} dòng.`);
      form.reset();
      await loadData();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#runLostSale").addEventListener("click", async () => {
    if (!apiReady) return renderAlerts(computeLostSales(state.customers || []), []);

    try {
      const [lostSaleData, reminderData] = await Promise.all([
        api("/api/v1/lost-sales-trigger"),
        api("/api/v1/daily-reminders")
      ]);
      renderAlerts(lostSaleData.alerts || [], reminderData.reminders || []);
    } catch (error) {
      showNotice(error.message);
    }
  });
}

function setDefaultDates() {
  document.querySelector("input[name='date']").value = currentDate();
  document.querySelector("input[name='period']").value = currentPeriod();
}

setDefaultDates();
bindForms();
if (authToken) {
  loadData();
} else {
  showLogin();
}
