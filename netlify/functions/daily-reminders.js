const { requireUser } = require("./shared/auth");
const { handleError, json, methodNotAllowed } = require("./shared/http");
const { isManager, loadData, scopedCustomers } = require("./shared/store");

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

exports.handler = async (event) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return methodNotAllowed();

  try {
    const user = await requireUser(event);
    const data = await loadData();
    const today = currentDate();
    const customers = scopedCustomers(data, user);
    const customerIds = new Set(customers.map((customer) => customer.id));
    const employeeIds = isManager(user)
      ? new Set(data.employeeCustomers.filter((item) => customerIds.has(item.customerId)).map((item) => item.employeeId))
      : new Set([user.id]);
    const reminders = data.employees
      .filter((employee) => employee.status !== "Inactive" && employee.role === "NhanVien" && employeeIds.has(employee.id))
      .filter((employee) => !data.dailyReports.some((report) => report.employeeId === employee.id && report.date === today))
      .map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        email: employee.email,
        date: today,
        message: `Nhắc ${employee.name} gửi báo cáo KPI ngày ${today}.`
      }));

    return json(200, { reminders });
  } catch (error) {
    return handleError(error);
  }
};
