const crypto = require("node:crypto");
const { assertCustomerAccess, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { loadData, saveData, scopedCustomers } = require("./shared/store");

exports.handler = async (event) => {
  try {
    const data = await loadData(event);
    const user = await requireUser(event, data);

    if (event.httpMethod === "GET") {
      const customerIds = new Set(scopedCustomers(data, user).map((customer) => customer.id));
      return json(200, { prescriptions: data.prescriptions.filter((item) => customerIds.has(item.customerId)) });
    }

    if (event.httpMethod !== "POST") return methodNotAllowed();

    const body = parseBody(event);
    const quantity = Number(body.quantity);
    if (!body.date || !body.customerId || !body.productId || !Number.isInteger(quantity) || quantity <= 0) {
      return json(400, { error: "Dữ liệu kê đơn không hợp lệ." });
    }

    assertCustomerAccess(data, user, body.customerId);
    const product = data.products.find((item) => item.id === body.productId && item.status !== "Inactive");
    if (!product) return json(400, { error: "Sản phẩm không hợp lệ." });

    const amount = quantity * Number(product.prescriptionPrice || 0);
    const row = { id: crypto.randomUUID(), date: body.date, employeeId: user.id, customerId: body.customerId, productId: body.productId, quantity, amount };
    data.prescriptions.push(row);
    await saveData(data, event);
    return json(201, { id: row.id, amount });
  } catch (error) {
    return handleError(error);
  }
};
