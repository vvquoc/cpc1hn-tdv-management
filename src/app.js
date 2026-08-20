const STORAGE_KEY = "cpc1hn-tdv-mvp-state";
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

const statusLabel = {
  DangLamHoSo: "Đang làm hồ sơ",
  ChoKetQua: "Chờ kết quả",
  TrungThau: "Trúng thầu",
  TruotThau: "Trượt thầu"
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(window.CPC1_SEED);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function byId(collection, id) {
  return collection.find((item) => item.id === id);
}

function activeEmployee() {
  return byId(state.employees, document.querySelector("#activeUser").value);
}

function scopeCustomers(employee) {
  if (employee.role === "Admin" || employee.role === "Manager") return state.customers;
  if (employee.role === "Supervisor") {
    return state.customers.filter((customer) => employee.territoryIds.includes(customer.territoryId));
  }
  return state.customers.filter((customer) => customer.ownerId === employee.id);
}

function scopeEmployeeIds(employee) {
  if (employee.role === "Admin" || employee.role === "Manager") return state.employees.map((item) => item.id);
  if (employee.role === "Supervisor") {
    return state.employees
      .filter((item) => item.territoryIds.some((territoryId) => employee.territoryIds.includes(territoryId)))
      .map((item) => item.id);
  }
  return [employee.id];
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
  select.innerHTML = items.map((item) => `<option value="${item.id}">${labelFor(item)}</option>`).join("");
}

function render() {
  const employee = activeEmployee();
  const customers = scopeCustomers(employee);
  const customerIds = customers.map((item) => item.id);
  const employeeIds = scopeEmployeeIds(employee);
  const prescriptions = state.prescriptions.filter((item) => customerIds.includes(item.customerId));
  const sales = state.sales.filter((item) => customerIds.includes(item.customerId));
  const tenders = state.tenders.filter((item) => customerIds.includes(item.customerId));
  const lostSales = computeLostSales(customers);

  document.querySelector("#scopeLabel").textContent = `${employee.name} · ${employee.role} · ${employee.territoryIds.join(", ")}`;
  document.querySelector("#metricSales").textContent = currency.format(
    sales.filter((sale) => sale.period === "2026-08").reduce((sum, sale) => sum + Number(sale.amount), 0)
  );
  document.querySelector("#metricRx").textContent = prescriptions.reduce((sum, item) => sum + Number(item.quantity), 0);
  document.querySelector("#metricTenders").textContent = tenders.filter((item) => item.status !== "TrungThau" && item.status !== "TruotThau").length;
  document.querySelector("#metricLostSales").textContent = lostSales.length;

  document.querySelectorAll("select[name='customerId']").forEach((select) => {
    setOptions(select, customers, (customer) => customer.name);
  });
  document.querySelectorAll("select[name='productId']").forEach((select) => {
    setOptions(select, state.products, (product) => `${product.name} · ${product.dosageForm}`);
  });

  document.querySelector("#prescriptionRows").innerHTML = prescriptions
    .slice()
    .reverse()
    .map((item) => {
      const customer = byId(state.customers, item.customerId);
      const product = byId(state.products, item.productId);
      const owner = byId(state.employees, item.employeeId);
      return `<tr><td>${item.date}</td><td>${owner.name}</td><td>${customer.name}</td><td>${product.name}</td><td>${item.quantity}</td><td>${currency.format(item.quantity * product.prescriptionPrice)}</td></tr>`;
    })
    .join("");

  document.querySelector("#salesRows").innerHTML = sales
    .slice()
    .reverse()
    .map((item) => {
      const customer = byId(state.customers, item.customerId);
      const product = byId(state.products, item.productId);
      return `<tr><td>${item.period}</td><td>${customer.name}</td><td>${product.name}</td><td>${currency.format(item.amount)}</td></tr>`;
    })
    .join("");

  document.querySelector("#tenderRows").innerHTML = tenders
    .map((item) => {
      const customer = byId(state.customers, item.customerId);
      const product = byId(state.products, item.productId);
      const owner = byId(state.employees, item.employeeId);
      const statusClass = item.status === "DangLamHoSo" ? "status-warn" : item.status === "TrungThau" ? "status-win" : "";
      return `<tr><td>${item.id}</td><td>${customer.name}</td><td>${product.name}</td><td><span class="status ${statusClass}">${statusLabel[item.status]}</span></td><td>${item.dueDate}</td><td>${owner.name}</td></tr>`;
    })
    .join("");

  document.querySelector("#lostSaleList").innerHTML = lostSales.length
    ? lostSales.map((customer) => `<li><strong>${customer.name}</strong><br />Không phát sinh doanh số trong 4 tháng gần nhất.</li>`).join("")
    : "<li>Không có cảnh báo trong phạm vi hiện tại.</li>";

  const today = "2026-08-20";
  const missingReports = state.employees.filter((item) => employeeIds.includes(item.id) && item.role === "MR" && !state.dailyReports.some((report) => report.employeeId === item.id && report.date === today));
  document.querySelector("#reminderList").innerHTML = missingReports.length
    ? missingReports.map((item) => `<li><strong>${item.name}</strong><br />Chưa có báo cáo ngày ${today}.</li>`).join("")
    : "<li>Tất cả TDV trong phạm vi đã báo cáo hôm nay.</li>";
}

function bindForms() {
  document.querySelector("#prescriptionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const employee = activeEmployee();
    const form = new FormData(event.currentTarget);
    state.prescriptions.push({
      date: form.get("date"),
      employeeId: employee.id,
      customerId: form.get("customerId"),
      productId: form.get("productId"),
      quantity: Number(form.get("quantity"))
    });
    saveState();
    render();
    event.currentTarget.reset();
    setDefaultDates();
  });

  document.querySelector("#salesForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const employee = activeEmployee();
    const form = new FormData(event.currentTarget);
    state.sales.push({
      period: form.get("period"),
      employeeId: employee.id,
      customerId: form.get("customerId"),
      productId: form.get("productId"),
      amount: Number(form.get("amount"))
    });
    saveState();
    render();
    event.currentTarget.reset();
    setDefaultDates();
  });

  document.querySelector("#activeUser").addEventListener("change", render);
  document.querySelector("#runLostSale").addEventListener("click", render);
}

function setDefaultDates() {
  document.querySelector("input[name='date']").value = "2026-08-20";
  document.querySelector("input[name='period']").value = "2026-08";
}

const state = loadState();
setOptions(document.querySelector("#activeUser"), state.employees, (employee) => `${employee.name} · ${employee.role}`);
setDefaultDates();
bindForms();
render();
