window.CPC1_SEED = {
  territories: [
    { id: "DB_DANANG", name: "Đà Nẵng", region: "Miền Trung" },
    { id: "DB_QUANGNAM", name: "Quảng Nam", region: "Miền Trung" },
    { id: "DB_QUANGNGAI", name: "Quảng Ngãi", region: "Miền Trung" },
    { id: "DB_BINHDINH", name: "Bình Định", region: "Miền Trung" },
    { id: "DB_GIALAI", name: "Gia Lai", region: "Tây Nguyên" }
  ],
  employees: [
    { id: "NV-DN-01", name: "Nguyễn Minh Anh", email: "nhanvien.danang@cpc1hn.vn", role: "NhanVien", territoryIds: ["DB_DANANG"] },
    { id: "NV-QN-01", name: "Trần Hồng Phúc", email: "nhanvien.quangnam@cpc1hn.vn", role: "NhanVien", territoryIds: ["DB_QUANGNAM"] },
    { id: "NV-QL-01", name: "Phạm Quốc Bảo", email: "quanly@cpc1hn.vn", role: "QuanLy", territoryIds: ["DB_DANANG", "DB_QUANGNAM", "DB_QUANGNGAI", "DB_BINHDINH", "DB_GIALAI"] }
  ],
  products: [
    { id: "SP_NEB_3", name: "Nebusal 3%", dosageForm: "Dung dịch khí dung BFS", prescriptionPrice: 56000 },
    { id: "SP_NEB_SPRAY", name: "Nebusal Spray", dosageForm: "Bình xịt mũi BOV", prescriptionPrice: 69000 },
    { id: "SP_ZENSALBU", name: "Zensalbu Inhaler", dosageForm: "Ống hít định liều MDI", prescriptionPrice: 82000 },
    { id: "SP_VAGI_ODIN", name: "Vagiodin", dosageForm: "Viên đặt đổ khuôn", prescriptionPrice: 74000 }
  ],
  customers: [
    { id: "KH_PM_DN_01", name: "Phòng mạch Hải Châu", type: "PhongMachTu", territoryId: "DB_DANANG", ownerId: "NV-DN-01" },
    { id: "KH_BV_DN_01", name: "Bệnh viện Đà Nẵng", type: "BenhVien", territoryId: "DB_DANANG", ownerId: "NV-DN-01" },
    { id: "KH_PM_QNAM_01", name: "Phòng mạch Tam Kỳ", type: "PhongMachTu", territoryId: "DB_QUANGNAM", ownerId: "NV-QN-01" },
    { id: "KH_SYT_QNGAI", name: "Sở Y tế Quảng Ngãi", type: "SoYTe", territoryId: "DB_QUANGNGAI", ownerId: "NV-QL-01" }
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
    { id: "GT-DN-2026-01", customerId: "KH_BV_DN_01", productId: "SP_NEB_3", status: "DangLamHoSo", dueDate: "2026-08-27", employeeId: "NV-DN-01" },
    { id: "GT-QNG-2026-01", customerId: "KH_SYT_QNGAI", productId: "SP_ZENSALBU", status: "ChoKetQua", dueDate: "2026-09-08", employeeId: "NV-QL-01" }
  ],
  dailyReports: [
    { date: "2026-08-20", employeeId: "NV-DN-01", summary: "Đi tuyến Hải Châu, cập nhật kê đơn Nebusal." }
  ]
};
