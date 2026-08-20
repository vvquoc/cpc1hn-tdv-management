const { requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed } = require("./shared/http");
const { loadData, scopedCustomers } = require("./shared/store");

function latestPeriods(sales, count) {
  return [...new Set(sales.map((sale) => sale.period))].sort().slice(-count);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const data = await loadData();
    const customers = scopedCustomers(data, user);
    const periods = latestPeriods(data.sales, 4);
    const alerts = customers
      .filter((customer) => customer.type === "PhongMachTu")
      .filter((customer) => {
        const sales = data.sales.filter((sale) => sale.customerId === customer.id);
        const hadEarlierSale = sales.some((sale) => !periods.includes(sale.period) && Number(sale.amount) > 0);
        const recentTotal = sales.filter((sale) => periods.includes(sale.period)).reduce((sum, sale) => sum + Number(sale.amount), 0);
        return periods.length >= 4 && hadEarlierSale && recentTotal === 0;
      })
      .map((customer) => ({
        customerId: customer.id,
        customerName: customer.name,
        reason: "Không phát sinh doanh số trong 4 tháng liên tục sau khi từng có sale."
      }));

    return json(200, { alerts });
  } catch (error) {
    return handleError(error);
  }
};
