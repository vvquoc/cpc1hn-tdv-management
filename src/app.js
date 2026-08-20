const STORAGE_EMAIL_KEY = "cpc1hn-tdv-active-email";
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

const statusLabel = {
  DangLamHoSo: "Đang làm hồ sơ",
  ChoKetQua: "Chờ kết quả",
  TrungThau: "Trúng thầu",
  TruotThau: "Trượt thầu"
};

const demoUsers = window.CPC1_SEED.employees;
let state = structuredClone(window.CPC1_SEED);
let apiReady = false;

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

function activeEmail() {
  return document.querySelector("#activeUser").value;
}

function activeEmployee() {
  return state.employees.find((item) => item.email === activeEmail()) || state.activeUser || state.employees[0];
}

function canAdmin() {
  const employee = activeEmployee();
  return employee && (employee.role === "Admin" || employee.role === "Manager");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-user-email": activeEmail(),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "API request failed");
  }
  return payload;
}

function byId(collection, id) {
  return collection.find((item) => item.id === id);
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
  select.innerHTML = items.map((item) => `<option value="${item.id || item.email}">${labelFor(item)}</option>`).join("");
}

function setEmailOptions() {
  const select = document.querySelector("#activeUser");
  const current = select.value || localStorage.getItem(STORAGE_EMAIL_KEY) || demoUsers[0].email;
  const users = (state.employees && state.employees.length ? state.employees : demoUsers).filter((employee) => employee.status !== "Inactive");
  select.innerHTML = users.map((employee) => `<option value="${employee.email}">${employee.name} · ${employee.role}</option>`).join("");
  select.value = users.some((employee) => employee.email === current) ? current : users[0]?.email || "";
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

async function loadData() {
  localStorage.setItem(STORAGE_EMAIL_KEY, activeEmail());
  try {
    const data = await api("/api/v1/bootstrap-data");
    state = data;
    apiReady = true;
    showNotice("");
  } catch (error) {
    apiReady = false;
    showNotice(`Chưa kết nối được database production: ${error.message}`);
  }
  render();
}

function render() {
  setEmailOptions();
  const employee = activeEmployee();
  const customers = state.customers || [];
  const activeCustomers = customers.filter((customer) => customer.status !== "Inactive");
  const activeProducts = (state.products || []).filter((product) => product.status !== "Inactive");
  const customerIds = customers.map((item) => item.id);
  const prescriptions = (state.prescriptions || []).filter((item) => customerIds.includes(item.customerId));
  const sales = (state.sales || []).filter((item) => customerIds.includes(item.customerId));
  const tenders = (state.tenders || []).filter((item) => customerIds.includes(item.customerId));
  const lostSales = computeLostSales(customers);

  document.querySelector("#scopeLabel").textContent = `${employee.name} · ${employee.role} · ${(employee.territoryIds || []).join(", ")}`;
  document.querySelector("#metricSales").textContent = currency.format(
    sales.filter((sale) => sale.period === currentPeriod()).reduce((sum, sale) => sum + Number(sale.amount), 0)
  );
  document.querySelector("#metricRx").textContent = prescriptions.reduce((sum, item) => sum + Number(item.quantity), 0);
  document.querySelector("#metricTenders").textContent = tenders.filter((item) => item.status !== "TrungThau" && item.status !== "TruotThau").length;
  document.querySelector("#metricLostSales").textContent = lostSales.length;

  document.querySelectorAll("form:not(#customerAssignForm) select[name='customerId']").forEach((select) => {
    setOptions(select, activeCustomers, (customer) => customer.name);
  });
  document.querySelectorAll("select[name='productId']").forEach((select) => {
    setOptions(select, activeProducts, (product) => `${product.name} · ${product.dosageForm}`);
  });

  document.querySelector("#prescriptionRows").innerHTML = prescriptions
    .slice()
    .reverse()
    .map((item) => {
      const customer = byId(state.customers, item.customerId) || {};
      const product = byId(state.products, item.productId) || {};
      const owner = byId(state.employees, item.employeeId) || {};
      const amount = item.amount || Number(item.quantity) * Number(product.prescriptionPrice || 0);
      return `<tr><td>${item.date}</td><td>${owner.name || item.employeeId}</td><td>${customer.name || item.customerId}</td><td>${product.name || item.productId}</td><td>${item.quantity}</td><td>${currency.format(amount)}</td></tr>`;
    })
    .join("");

  document.querySelector("#salesRows").innerHTML = sales
    .slice()
    .reverse()
    .map((item) => {
      const customer = byId(state.customers, item.customerId) || {};
      const product = byId(state.products, item.productId) || {};
      return `<tr><td>${item.period}</td><td>${customer.name || item.customerId}</td><td>${product.name || item.productId}</td><td>${currency.format(item.amount)}</td></tr>`;
    })
    .join("");

  document.querySelector("#tenderRows").innerHTML = tenders
    .map((item) => {
      const customer = byId(state.customers, item.customerId) || {};
      const product = byId(state.products, item.productId) || {};
      const owner = byId(state.employees, item.employeeId) || {};
      const statusClass = item.status === "DangLamHoSo" ? "status-warn" : item.status === "TrungThau" ? "status-win" : "";
      return `<tr><td>${item.id}</td><td>${customer.name || item.customerId}</td><td>${product.name || item.productId}</td><td><span class="status ${statusClass}">${statusLabel[item.status] || item.status}</span></td><td>${item.dueDate || ""}</td><td>${owner.name || item.employeeId}</td></tr>`;
    })
    .join("");

  renderAlerts(lostSales, []);
  renderAdmin();
}

function renderAlerts(lostSales, reminders) {
  document.querySelector("#lostSaleList").innerHTML = lostSales.length
    ? lostSales.map((customer) => `<li><strong>${customer.name || customer.customerName}</strong><br />Không phát sinh doanh số trong 4 tháng gần nhất.</li>`).join("")
    : "<li>Không có cảnh báo trong phạm vi hiện tại.</li>";

  const today = currentDate();
  const fallbackReminders = reminders.length
    ? reminders
    : (state.employees || []).filter((item) => item.role === "MR" && !(state.dailyReports || []).some((report) => report.employeeId === item.id && report.date === today));

  document.querySelector("#reminderList").innerHTML = fallbackReminders.length
    ? fallbackReminders.map((item) => `<li><strong>${item.employeeName || item.name}</strong><br />${item.message || `Chưa có báo cáo ngày ${today}.`}</li>`).join("")
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

function renderAdmin() {
  const adminVisible = canAdmin();
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = !adminVisible;
  });
  if (!adminVisible) return;

  const employees = state.employees || [];
  const territories = state.territories || [];
  const products = state.products || [];
  const customers = state.customers || [];

  document.querySelectorAll("#territoryAssignForm select[name='employeeId'], #customerAssignForm select[name='employeeId']").forEach((select) => {
    setOptions(select, employees, (employee) => `${employee.name} · ${employee.role}`);
  });
  document.querySelectorAll("#customerForm select[name='territoryId'], #territoryAssignForm select[name='territoryId']").forEach((select) => {
    setOptions(select, territories, (territory) => territory.name);
  });
  setOptions(document.querySelector("#customerAssignForm select[name='customerId']"), customers, (customer) => customer.name);

  document.querySelector("#employeeAdminList").innerHTML = employees
    .map((employee) => `
      <li>
        <strong>${employee.name}</strong><br />
        ${employee.id} · ${employee.email} · ${employee.role} · ${employee.status || "Active"}
        <div class="inline-actions">
          <button class="secondary-button" data-edit-employee="${employee.id}">Sửa</button>
          <button class="danger-button" data-deactivate-employee="${employee.id}">Ngừng hoạt động</button>
        </div>
      </li>`)
    .join("");

  document.querySelector("#productAdminList").innerHTML = products
    .map((product) => `
      <li>
        <strong>${product.name}</strong><br />
        ${product.id} · ${product.dosageForm} · ${currency.format(product.prescriptionPrice || 0)} · ${product.status || "Active"}
        <div class="inline-actions">
          <button class="secondary-button" data-edit-product="${product.id}">Sửa</button>
          <button class="danger-button" data-deactivate-product="${product.id}">Ngừng hoạt động</button>
        </div>
      </li>`)
    .join("");

  document.querySelector("#customerAdminList").innerHTML = customers
    .map((customer) => `
      <li>
        <strong>${customer.name}</strong><br />
        ${customer.id} · ${customer.type} · ${customer.territoryId} · ${customer.status || "Active"}
        <div class="inline-actions">
          <button class="secondary-button" data-edit-customer="${customer.id}">Sửa</button>
          <button class="danger-button" data-deactivate-customer="${customer.id}">Ngừng hoạt động</button>
        </div>
      </li>`)
    .join("");
}

function bindForms() {
  document.querySelector("#prescriptionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể ghi kê đơn.");

    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
      setDefaultDates();
      await loadData();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#salesForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể ghi doanh số.");

    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
      setDefaultDates();
      await loadData();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#tenderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiReady) return showNotice("Database chưa sẵn sàng, chưa thể lưu gói thầu.");

    try {
      await api("/api/v1/tenders", {
        method: "POST",
        body: JSON.stringify(getFormObject(event.currentTarget))
      });
      event.currentTarget.reset();
      await loadData();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#employeeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await postAdmin("employee", getFormObject(event.currentTarget));
      event.currentTarget.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#territoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await postAdmin("territory", getFormObject(event.currentTarget));
      event.currentTarget.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await postAdmin("product", getFormObject(event.currentTarget));
      event.currentTarget.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#customerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await postAdmin("customer", getFormObject(event.currentTarget));
      event.currentTarget.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#territoryAssignForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await postAdmin("employee_territory", getFormObject(event.currentTarget));
      event.currentTarget.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#customerAssignForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await postAdmin("employee_customer", getFormObject(event.currentTarget));
      event.currentTarget.reset();
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#admin").addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const employeeId = button.dataset.editEmployee || button.dataset.deactivateEmployee;
    const productId = button.dataset.editProduct || button.dataset.deactivateProduct;
    const customerId = button.dataset.editCustomer || button.dataset.deactivateCustomer;

    try {
      if (button.dataset.editEmployee) {
        const employee = byId(state.employees, employeeId);
        fillForm("#employeeForm", employee);
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
      }
    } catch (error) {
      showNotice(error.message);
    }
  });

  document.querySelector("#activeUser").addEventListener("change", loadData);
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

function initUsers() {
  const savedEmail = localStorage.getItem(STORAGE_EMAIL_KEY) || demoUsers[0].email;
  setOptions(document.querySelector("#activeUser"), demoUsers, (employee) => `${employee.name} · ${employee.role}`);
  document.querySelector("#activeUser").value = savedEmail;
}

initUsers();
setDefaultDates();
bindForms();
loadData();
