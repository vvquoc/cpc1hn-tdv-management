const { computeDailyReminders, seed, today } = require("./shared/business-rules");

exports.handler = async () => {
  const reminders = computeDailyReminders(seed).map((employee) => ({
    employeeId: employee.id,
    employeeName: employee.name,
    email: employee.email,
    date: today,
    message: `Nhắc ${employee.name} gửi báo cáo KPI ngày ${today}.`
  }));

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reminders })
  };
};
