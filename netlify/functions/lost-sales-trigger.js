const { computeLostSales, seed } = require("./shared/business-rules");

exports.handler = async () => {
  const alerts = computeLostSales(seed).map((customer) => ({
    customerId: customer.id,
    customerName: customer.name,
    ownerId: customer.ownerId,
    reason: "Không phát sinh doanh số trong 4 tháng liên tục sau khi từng có sale."
  }));

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ alerts })
  };
};
