const crypto = require("node:crypto");
const { isAdmin, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { loadData, saveData } = require("./shared/store");

function requireManager(user) {
  if (!isAdmin(user)) {
    const error = new Error("Manager permission required");
    error.statusCode = 403;
    error.publicMessage = "Chỉ Quản lý được quản trị dữ liệu.";
    throw error;
  }
}

function normalizeRole(role) {
  return ["QuanLy", "Admin", "Manager"].includes(role) ? "QuanLy" : "NhanVien";
}

function fail(publicMessage, statusCode = 400) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  throw error;
}

function required(value, label) {
  const result = String(value || "").trim();
  if (!result) fail(`${label} là bắt buộc.`);
  return result;
}

function activeById(items, id) {
  return items.some((item) => item.id === id && item.status !== "Inactive");
}

function upsertById(items, row) {
  const index = items.findIndex((item) => item.id === row.id);
  if (index >= 0) items[index] = { ...items[index], ...row };
  else items.push(row);
  return row;
}

function upsertCredential(data, employeeId, username, password) {
  const existing = data.credentials.find((item) => item.employeeId === employeeId);
  const normalizedUsername = String(username || existing?.username || "").trim();
  if (!password) return existing;
  if (!normalizedUsername) fail("Tài khoản là bắt buộc khi đặt mật khẩu.");
  if (String(password).length < 8) fail("Mật khẩu phải có ít nhất 8 ký tự.");
  const duplicate = data.credentials.find((item) => item.username === normalizedUsername && item.employeeId !== employeeId);
  if (duplicate) fail("Tên tài khoản đã được sử dụng.", 409);
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const passwordHash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  const row = { username: normalizedUsername, employeeId, passwordSalt: salt, passwordHash, iterations };
  const index = data.credentials.findIndex((item) => item.employeeId === employeeId);
  if (index >= 0) data.credentials[index] = row;
  else data.credentials.push(row);
  return row;
}

exports.handler = async (event) => {
  try {
    const data = await loadData(event);
    const user = await requireUser(event, data);
    requireManager(user);

    if (event.httpMethod === "GET") {
      return json(200, {
        employeeTerritories: data.employeeTerritories,
        employeeCustomers: data.employeeCustomers,
        accounts: data.credentials.map((item) => ({ employeeId: item.employeeId, username: item.username }))
      });
    }

    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    const { resource, action = "upsert", data: payload = {} } = body;
    let id;

    if (action === "deactivate") {
      const collectionByResource = { employee: "employees", territory: "territories", product: "products", customer: "customers" };
      const collection = data[collectionByResource[resource]];
      const row = collection && collection.find((item) => item.id === payload.id);
      if (!row) fail("Không tìm thấy dữ liệu cần xóa.", 404);
      if (resource === "employee" && row.id === user.id) fail("Không thể vô hiệu hóa tài khoản đang đăng nhập.");
      if (resource === "employee" && normalizeRole(row.role) === "QuanLy") {
        const activeManagers = data.employees.filter((item) => item.status !== "Inactive" && normalizeRole(item.role) === "QuanLy");
        if (activeManagers.length <= 1) fail("Hệ thống phải còn ít nhất một tài khoản Quản lý.");
      }
      row.status = "Inactive";
      id = row.id;
    } else if (action === "remove" && resource === "employee_territory") {
      const before = data.employeeTerritories.length;
      data.employeeTerritories = data.employeeTerritories.filter((item) => !(item.employeeId === payload.employeeId && item.territoryId === payload.territoryId));
      if (before === data.employeeTerritories.length) fail("Không tìm thấy phân công địa bàn.", 404);
      id = `${payload.employeeId}:${payload.territoryId}`;
    } else if (action === "remove" && resource === "employee_customer") {
      const before = data.employeeCustomers.length;
      data.employeeCustomers = data.employeeCustomers.filter((item) => !(item.employeeId === payload.employeeId && item.customerId === payload.customerId));
      if (before === data.employeeCustomers.length) fail("Không tìm thấy phân công khách hàng.", 404);
      id = `${payload.employeeId}:${payload.customerId}`;
    } else if (resource === "employee") {
      const employeeId = required(payload.id, "Mã nhân viên");
      const email = required(payload.email, "Email").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Email không hợp lệ.");
      const duplicateEmail = data.employees.find((item) => item.email === email && item.id !== employeeId);
      if (duplicateEmail) fail("Email đã được sử dụng.", 409);
      const existing = data.employees.find((item) => item.id === employeeId);
      if (!existing && (!payload.username || !payload.password)) fail("Nhân viên mới cần có tài khoản và mật khẩu.");
      const employee = upsertById(data.employees, {
        id: employeeId,
        name: required(payload.name, "Họ tên"),
        email,
        role: normalizeRole(payload.role),
        status: payload.status || "Active"
      });
      upsertCredential(data, employee.id, payload.username, payload.password);
      id = employee.id;
    } else if (resource === "territory") {
      id = upsertById(data.territories, {
        id: required(payload.id, "Mã địa bàn"),
        name: required(payload.name, "Tên địa bàn"),
        region: required(payload.region, "Khu vực"),
        status: payload.status || "Active"
      }).id;
    } else if (resource === "product") {
      const price = Number(payload.prescriptionPrice);
      if (!Number.isFinite(price) || price < 0) fail("Giá kê đơn không hợp lệ.");
      id = upsertById(data.products, {
        id: required(payload.id, "Mã sản phẩm"),
        name: required(payload.name, "Tên sản phẩm"),
        activeIngredient: payload.activeIngredient || "",
        dosageCode: required(payload.dosageCode, "Dạng bào chế"),
        dosageForm: required(payload.dosageForm, "Mô tả dạng bào chế"),
        packageSpec: payload.packageSpec || "",
        prescriptionPrice: price,
        status: payload.status || "Active"
      }).id;
    } else if (resource === "customer") {
      const territoryId = required(payload.territoryId, "Địa bàn");
      if (!activeById(data.territories, territoryId)) fail("Địa bàn không hợp lệ.");
      id = upsertById(data.customers, {
        id: required(payload.id, "Mã khách hàng"),
        name: required(payload.name, "Tên khách hàng"),
        type: required(payload.type, "Loại khách hàng"),
        territoryId,
        address: payload.address || "",
        phone: payload.phone || "",
        status: payload.status || "Active"
      }).id;
    } else if (resource === "employee_territory") {
      if (!activeById(data.employees, payload.employeeId)) fail("Nhân viên không hợp lệ.");
      if (!activeById(data.territories, payload.territoryId)) fail("Địa bàn không hợp lệ.");
      const row = { employeeId: payload.employeeId, territoryId: payload.territoryId, isPrimary: Boolean(payload.isPrimary) };
      const index = data.employeeTerritories.findIndex((item) => item.employeeId === row.employeeId && item.territoryId === row.territoryId);
      if (index >= 0) data.employeeTerritories[index] = row;
      else data.employeeTerritories.push(row);
      id = `${row.employeeId}:${row.territoryId}`;
    } else if (resource === "employee_customer") {
      if (!activeById(data.employees, payload.employeeId)) fail("Nhân viên không hợp lệ.");
      if (!activeById(data.customers, payload.customerId)) fail("Khách hàng không hợp lệ.");
      const exists = data.employeeCustomers.some((item) => item.employeeId === payload.employeeId && item.customerId === payload.customerId);
      if (!exists) data.employeeCustomers.push({ employeeId: payload.employeeId, customerId: payload.customerId });
      id = `${payload.employeeId}:${payload.customerId}`;
    }

    if (!id) return json(400, { error: "Thao tác quản trị không hợp lệ." });
    await saveData(data, event);
    return json(200, { resource, action, id });
  } catch (error) {
    return handleError(error);
  }
};
