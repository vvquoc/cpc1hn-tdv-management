const crypto = require("node:crypto");
const { assertCustomerAccess, requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed, parseBody } = require("./shared/http");
const { loadData, saveData } = require("./shared/store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const data = await loadData();
    const body = parseBody(event);
    const amount = Number(body.amount);

    if (!/^\d{4}-\d{2}$/.test(body.period || "") || !body.customerId || !body.productId || !Number.isFinite(amount) || amount < 0) {
      return json(400, { error: "Dữ liệu doanh số không hợp lệ." });
    }

    await assertCustomerAccess(user, body.customerId);
    const row = {
      id: crypto.randomUUID(),
      period: body.period,
      customerId: body.customerId,
      productId: body.productId,
      employeeId: user.id,
      amount
    };
    const index = data.sales.findIndex((item) => item.period === row.period && item.customerId === row.customerId && item.productId === row.productId);
    if (index >= 0) data.sales[index] = { ...data.sales[index], ...row };
    else data.sales.push(row);
    await saveData(data);
    return json(201, { id: row.id });
  } catch (error) {
    return handleError(error);
  }
};
