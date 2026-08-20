const { requireUser, isAdmin } = require("./shared/auth");
const { handleError, json, methodNotAllowed } = require("./shared/http");
const { loadMasterData, scopedCustomers, withTerritories } = require("./shared/store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return methodNotAllowed();

  try {
    const data = await loadMasterData();
    const user = await requireUser(event, data);
    const customers = scopedCustomers(data, user);
    const customerIds = new Set(customers.map((customer) => customer.id));
    const manager = isAdmin(user);
    const employees = manager
      ? data.employees.map((employee) => withTerritories(data, employee))
      : [withTerritories(data, data.employees.find((employee) => employee.id === user.id))];

    return json(200, {
      activeUser: user,
      territories: data.territories,
      employees,
      products: data.products,
      customers,
      prescriptions: [],
      sales: [],
      tenders: [],
      dailyReports: manager ? data.dailyReports : data.dailyReports.filter((item) => item.employeeId === user.id),
      kpiTargets: manager ? data.kpiTargets : data.kpiTargets.filter((item) => item.employeeId === user.id)
    });
  } catch (error) {
    return handleError(error);
  }
};
