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

function upsertById(items, row) {
  const index = items.findIndex((item) => item.id === row.id);
  if (index >= 0) items[index] = { ...items[index], ...row };
  else items.push(row);
  return row;
}

function upsertCredential(data, employeeId, username, password) {
  if (!username || !password) return;
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const passwordHash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  const row = { username: String(username).trim(), employeeId, passwordSalt: salt, passwordHash, iterations };
  const index = data.credentials.findIndex((item) => item.username === row.username);
  if (index >= 0) data.credentials[index] = row;
  else data.credentials.push(row);
}

exports.handler = async (event) => {
  try {
    const user = await requireUser(event);
    requireManager(user);
    const data = await loadData();

    if (event.httpMethod === "GET") {
      return json(200, {
        employeeTerritories: data.employeeTerritories,
        employeeCustomers: data.employeeCustomers
      });
    }

    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    const { resource, action = "upsert", data: payload = {} } = body;
    let id;

    if (action === "deactivate") {
      const collectionByResource = { employee: "employees", product: "products", customer: "customers" };
      const collection = data[collectionByResource[resource]];
      const row = collection && collection.find((item) => item.id === payload.id);
      if (!row) return json(400, { error: "Không tìm thấy dữ liệu cần xóa." });
      row.status = "Inactive";
      id = row.id;
    } else if (action === "remove" && resource === "employee_territory") {
      data.employeeTerritories = data.employeeTerritories.filter((item) => !(item.employeeId === payload.employeeId && item.territoryId === payload.territoryId));
      id = `${payload.employeeId}:${payload.territoryId}`;
    } else if (action === "remove" && resource === "employee_customer") {
      data.employeeCustomers = data.employeeCustomers.filter((item) => !(item.employeeId === payload.employeeId && item.customerId === payload.customerId));
      id = `${payload.employeeId}:${payload.customerId}`;
    } else if (resource === "employee") {
      const employee = upsertById(data.employees, {
        id: payload.id,
        name: payload.name,
        email: String(payload.email || "").toLowerCase(),
        role: normalizeRole(payload.role),
        status: payload.status || "Active"
      });
      upsertCredential(data, employee.id, payload.username, payload.password);
      id = employee.id;
    } else if (resource === "territory") {
      id = upsertById(data.territories, { id: payload.id, name: payload.name, region: payload.region }).id;
    } else if (resource === "product") {
      id = upsertById(data.products, {
        id: payload.id,
        name: payload.name,
        activeIngredient: payload.activeIngredient || "",
        dosageCode: payload.dosageCode,
        dosageForm: payload.dosageForm,
        packageSpec: payload.packageSpec || "",
        prescriptionPrice: Number(payload.prescriptionPrice || 0),
        status: payload.status || "Active"
      }).id;
    } else if (resource === "customer") {
      id = upsertById(data.customers, {
        id: payload.id,
        name: payload.name,
        type: payload.type,
        territoryId: payload.territoryId,
        address: payload.address || "",
        phone: payload.phone || "",
        status: payload.status || "Active"
      }).id;
    } else if (resource === "employee_territory") {
      const row = { employeeId: payload.employeeId, territoryId: payload.territoryId, isPrimary: Boolean(payload.isPrimary) };
      const index = data.employeeTerritories.findIndex((item) => item.employeeId === row.employeeId && item.territoryId === row.territoryId);
      if (index >= 0) data.employeeTerritories[index] = row;
      else data.employeeTerritories.push(row);
      id = `${row.employeeId}:${row.territoryId}`;
    } else if (resource === "employee_customer") {
      const exists = data.employeeCustomers.some((item) => item.employeeId === payload.employeeId && item.customerId === payload.customerId);
      if (!exists) data.employeeCustomers.push({ employeeId: payload.employeeId, customerId: payload.customerId });
      id = `${payload.employeeId}:${payload.customerId}`;
    }

    if (!id) return json(400, { error: "Thao tác quản trị không hợp lệ." });
    await saveData(data);
    return json(200, { resource, action, id });
  } catch (error) {
    return handleError(error);
  }
};
