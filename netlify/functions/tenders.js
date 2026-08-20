const { assertCustomerAccess, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { loadData, saveData, scopedCustomers } = require("./shared/store");

exports.handler = async (event) => {
  try {
    const data = await loadData(event);
    const user = await requireUser(event, data);

    if (event.httpMethod === "POST") {
      const body = parseBody(event);
      if (!body.id || !body.customerId || !body.productId || !body.status) {
        return json(400, { error: "Dữ liệu thầu không hợp lệ." });
      }
      assertCustomerAccess(data, user, body.customerId);
      const product = data.products.find((item) => item.id === body.productId && item.status !== "Inactive");
      if (!product) return json(400, { error: "Sản phẩm không hợp lệ." });
      const existing = data.tenders.find((item) => item.id === body.id);
      if (existing) assertCustomerAccess(data, user, existing.customerId);
      const row = {
        id: body.id,
        customerId: body.customerId,
        productId: body.productId,
        status: body.status,
        dueDate: body.dueDate || "",
        quantity: Number(body.quantity || 0),
        bidPrice: Number(body.bidPrice || 0),
        employeeId: user.id
      };
      const index = data.tenders.findIndex((item) => item.id === row.id);
      if (index >= 0) data.tenders[index] = { ...data.tenders[index], ...row };
      else data.tenders.push(row);
      await saveData(data, event);
      return json(200, { id: row.id });
    }

    if (event.httpMethod !== "GET") return methodNotAllowed();
    const customerIds = new Set(scopedCustomers(data, user).map((customer) => customer.id));
    return json(200, { tenders: data.tenders.filter((item) => customerIds.has(item.customerId)) });
  } catch (error) {
    return handleError(error);
  }
};
