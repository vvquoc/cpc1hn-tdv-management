const { getStore } = require("@netlify/blobs");

const DATA_KEY = "app-data";

const seedData = {
  employees: [
    { id: "QL-15795", name: "Quản lý CPC1HN", email: "15795@cpc1hn.local", role: "QuanLy", status: "Active", territoryIds: ["DB_DANANG", "DB_QUANGNAM", "DB_QUANGNGAI", "DB_BINHDINH", "DB_GIALAI"] },
    { id: "NV-DN-01", name: "Nguyễn Minh Anh", email: "nhanvien.danang@cpc1hn.vn", role: "NhanVien", status: "Active", territoryIds: ["DB_DANANG"] },
    { id: "NV-QN-01", name: "Trần Hồng Phúc", email: "nhanvien.quangnam@cpc1hn.vn", role: "NhanVien", status: "Active", territoryIds: ["DB_QUANGNAM"] }
  ],
  credentials: [
    {
      username: "15795",
      employeeId: "QL-15795",
      passwordSalt: "3e2cb766bd2aca4afbab29099f0f75c4",
      passwordHash: "01db890a71e4a330f2fa77347ff27ed201814ae817a92f4a146c76ee9912a19b",
      iterations: 210000
    }
  ],
  sessions: [],
  territories: [
    { id: "DB_DANANG", name: "Đà Nẵng", region: "Miền Trung" },
    { id: "DB_QUANGNAM", name: "Quảng Nam", region: "Miền Trung" },
    { id: "DB_QUANGNGAI", name: "Quảng Ngãi", region: "Miền Trung" },
    { id: "DB_BINHDINH", name: "Bình Định", region: "Miền Trung" },
    { id: "DB_GIALAI", name: "Gia Lai", region: "Tây Nguyên" }
  ],
  products: [
    { id: "SP_NEB_3", name: "Nebusal 3%", activeIngredient: "Natri clorid ưu trương", dosageCode: "BFS", dosageForm: "Dung dịch khí dung BFS", packageSpec: "Hộp 20 ống", prescriptionPrice: 56000, status: "Active" },
    { id: "SP_NEB_SPRAY", name: "Nebusal Spray", activeIngredient: "", dosageCode: "BOV", dosageForm: "Bình xịt mũi BOV", packageSpec: "", prescriptionPrice: 69000, status: "Active" },
    { id: "SP_ZENSALBU", name: "Zensalbu Inhaler", activeIngredient: "Salbutamol", dosageCode: "MDI", dosageForm: "Ống hít định liều MDI", packageSpec: "Bình hít", prescriptionPrice: 82000, status: "Active" },
    { id: "SP_VAGI_ODIN", name: "Vagiodin", activeIngredient: "", dosageCode: "VienDatDoKhuon", dosageForm: "Viên đặt đổ khuôn", packageSpec: "", prescriptionPrice: 74000, status: "Active" }
  ],
  customers: [
    { id: "KH_PM_DN_01", name: "Phòng mạch Hải Châu", type: "PhongMachTu", territoryId: "DB_DANANG", address: "Hải Châu, Đà Nẵng", phone: "", status: "Active" },
    { id: "KH_BV_DN_01", name: "Bệnh viện Đà Nẵng", type: "BenhVien", territoryId: "DB_DANANG", address: "Hải Châu, Đà Nẵng", phone: "", status: "Active" },
    { id: "KH_PM_QNAM_01", name: "Phòng mạch Tam Kỳ", type: "PhongMachTu", territoryId: "DB_QUANGNAM", address: "", phone: "", status: "Active" },
    { id: "KH_SYT_QNGAI", name: "Sở Y tế Quảng Ngãi", type: "SoYTe", territoryId: "DB_QUANGNGAI", address: "", phone: "", status: "Active" }
  ],
  employeeTerritories: [
    { employeeId: "QL-15795", territoryId: "DB_DANANG", isPrimary: true },
    { employeeId: "QL-15795", territoryId: "DB_QUANGNAM", isPrimary: false },
    { employeeId: "QL-15795", territoryId: "DB_QUANGNGAI", isPrimary: false },
    { employeeId: "QL-15795", territoryId: "DB_BINHDINH", isPrimary: false },
    { employeeId: "QL-15795", territoryId: "DB_GIALAI", isPrimary: false },
    { employeeId: "NV-DN-01", territoryId: "DB_DANANG", isPrimary: true },
    { employeeId: "NV-QN-01", territoryId: "DB_QUANGNAM", isPrimary: true }
  ],
  employeeCustomers: [
    { employeeId: "NV-DN-01", customerId: "KH_PM_DN_01" },
    { employeeId: "NV-DN-01", customerId: "KH_BV_DN_01" },
    { employeeId: "NV-QN-01", customerId: "KH_PM_QNAM_01" },
    { employeeId: "QL-15795", customerId: "KH_SYT_QNGAI" }
  ],
  prescriptions: [
    { date: "2026-08-20", employeeId: "NV-DN-01", customerId: "KH_PM_DN_01", productId: "SP_NEB_3", quantity: 8 },
    { date: "2026-08-20", employeeId: "NV-QN-01", customerId: "KH_PM_QNAM_01", productId: "SP_VAGI_ODIN", quantity: 5 }
  ],
  sales: [
    { period: "2026-04", customerId: "KH_PM_DN_01", productId: "SP_NEB_3", employeeId: "NV-DN-01", amount: 0 },
    { period: "2026-05", customerId: "KH_PM_DN_01", productId: "SP_NEB_3", employeeId: "NV-DN-01", amount: 0 },
    { period: "2026-06", customerId: "KH_PM_DN_01", productId: "SP_NEB_3", employeeId: "NV-DN-01", amount: 0 },
    { period: "2026-07", customerId: "KH_PM_DN_01", productId: "SP_NEB_3", employeeId: "NV-DN-01", amount: 0 },
    { period: "2026-03", customerId: "KH_PM_DN_01", productId: "SP_NEB_3", employeeId: "NV-DN-01", amount: 1200000 },
    { period: "2026-08", customerId: "KH_PM_QNAM_01", productId: "SP_VAGI_ODIN", employeeId: "NV-QN-01", amount: 1850000 }
  ],
  tenders: [
    { id: "GT-DN-2026-01", customerId: "KH_BV_DN_01", productId: "SP_NEB_3", status: "DangLamHoSo", dueDate: "2026-08-27", quantity: 1000, bidPrice: 52000, employeeId: "NV-DN-01" },
    { id: "GT-QNG-2026-01", customerId: "KH_SYT_QNGAI", productId: "SP_ZENSALBU", status: "ChoKetQua", dueDate: "2026-09-08", quantity: 500, bidPrice: 79000, employeeId: "QL-15795" }
  ],
  dailyReports: [
    { date: "2026-08-20", employeeId: "NV-DN-01", summary: "Đi tuyến Hải Châu, cập nhật kê đơn Nebusal." }
  ],
  kpiTargets: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isExpired(session) {
  return !session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now();
}

async function loadData() {
  const store = getStore("cpc1hn-tdv-management");
  const data = await store.get(DATA_KEY, { type: "json" });
  if (data) {
    data.sessions = (data.sessions || []).filter((session) => !isExpired(session));
    return data;
  }

  const initial = clone(seedData);
  await store.setJSON(DATA_KEY, initial);
  return initial;
}

async function saveData(data) {
  const store = getStore("cpc1hn-tdv-management");
  data.sessions = (data.sessions || []).filter((session) => !isExpired(session));
  await store.setJSON(DATA_KEY, data);
  return data;
}

function isManager(user) {
  return ["QuanLy", "Admin", "Manager"].includes(user.role || user.chuc_vu);
}

function withTerritories(data, employee) {
  const territoryIds = data.employeeTerritories
    .filter((item) => item.employeeId === employee.id)
    .map((item) => item.territoryId);
  return { ...employee, territoryIds };
}

function scopedCustomers(data, user) {
  if (isManager(user)) return data.customers;
  const ids = new Set(data.employeeCustomers.filter((item) => item.employeeId === user.id).map((item) => item.customerId));
  return data.customers.filter((customer) => ids.has(customer.id));
}

function hasCustomerAccess(data, user, customerId) {
  return scopedCustomers(data, user).some((customer) => customer.id === customerId);
}

module.exports = {
  loadData,
  saveData,
  isManager,
  withTerritories,
  scopedCustomers,
  hasCustomerAccess
};
