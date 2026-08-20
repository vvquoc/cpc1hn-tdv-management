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

const today = currentDate();

const seed = {
  employees: [
    { id: "NV-DN-01", name: "Nguyễn Minh Anh", email: "nhanvien.danang@cpc1hn.vn", role: "NhanVien", territoryIds: ["DB_DANANG"] },
    { id: "NV-QN-01", name: "Trần Hồng Phúc", email: "nhanvien.quangnam@cpc1hn.vn", role: "NhanVien", territoryIds: ["DB_QUANGNAM"] },
    { id: "NV-QL-01", name: "Lê Thu Hà", email: "quanly@cpc1hn.vn", role: "QuanLy", territoryIds: ["DB_DANANG", "DB_QUANGNAM", "DB_QUANGNGAI"] }
  ],
  customers: [
    { id: "KH_PM_DN_01", name: "Phòng mạch Hải Châu", type: "PhongMachTu", territoryId: "DB_DANANG", ownerId: "NV-DN-01" },
    { id: "KH_PM_QNAM_01", name: "Phòng mạch Tam Kỳ", type: "PhongMachTu", territoryId: "DB_QUANGNAM", ownerId: "NV-QN-01" }
  ],
  sales: [
    { period: "2026-03", customerId: "KH_PM_DN_01", amount: 1200000 },
    { period: "2026-04", customerId: "KH_PM_DN_01", amount: 0 },
    { period: "2026-05", customerId: "KH_PM_DN_01", amount: 0 },
    { period: "2026-06", customerId: "KH_PM_DN_01", amount: 0 },
    { period: "2026-07", customerId: "KH_PM_DN_01", amount: 0 },
    { period: "2026-08", customerId: "KH_PM_QNAM_01", amount: 1850000 }
  ],
  dailyReports: [
    { date: today, employeeId: "NV-DN-01" }
  ]
};

function latestPeriods(sales, count) {
  return [...new Set(sales.map((sale) => sale.period))].sort().slice(-count);
}

function computeLostSales(data = seed) {
  const periods = latestPeriods(data.sales, 4);
  return data.customers.filter((customer) => {
    if (customer.type !== "PhongMachTu") return false;
    const customerSales = data.sales.filter((sale) => sale.customerId === customer.id);
    const hadEarlierSale = customerSales.some((sale) => !periods.includes(sale.period) && sale.amount > 0);
    const recentTotal = customerSales
      .filter((sale) => periods.includes(sale.period))
      .reduce((sum, sale) => sum + Number(sale.amount), 0);
    return hadEarlierSale && recentTotal === 0;
  });
}

function computeDailyReminders(data = seed) {
  return data.employees.filter((employee) => {
    return ["NhanVien", "MR", "Supervisor"].includes(employee.role) && !data.dailyReports.some((report) => report.employeeId === employee.id && report.date === today);
  });
}

module.exports = {
  seed,
  today,
  computeLostSales,
  computeDailyReminders
};
