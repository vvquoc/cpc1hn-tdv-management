import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = process.cwd();
const repoTemplateDir = path.join(root, "data-templates");
const csvDir = path.join(repoTemplateDir, "csv");
const outputDir = path.join(root, "outputs", "cpc1hn-data-templates");

const commonFormats = {
  title: {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF", size: 14 },
    alignment: { horizontal: "left" }
  },
  subtitle: {
    fill: "#E6F4F1",
    font: { color: "#164E63" },
    wrapText: true
  },
  header: {
    fill: "#17202A",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true
  },
  required: {
    fill: "#FEF3C7",
    font: { color: "#78350F" },
    wrapText: true
  },
  optional: {
    fill: "#F8FAFC",
    font: { color: "#334155" },
    wrapText: true
  }
};

const sheets = [
  {
    name: "tb_dia_ban",
    title: "Địa bàn",
    note: "Nhập trước tiên. Mỗi địa bàn/tỉnh thành một dòng.",
    headers: ["id_dia_ban", "ten_dia_ban", "khu_vuc"],
    required: ["id_dia_ban", "ten_dia_ban", "khu_vuc"],
    examples: [
      ["DB_DANANG", "Đà Nẵng", "Miền Trung"],
      ["DB_QUANGNAM", "Quảng Nam", "Miền Trung"],
      ["DB_GIALAI", "Gia Lai", "Tây Nguyên"]
    ]
  },
  {
    name: "tb_nhan_su",
    title: "Nhân sự",
    note: "Email phải đúng email đăng nhập. chuc_vu chỉ dùng MR, Supervisor, Manager hoặc Admin.",
    headers: ["id_nhan_vien", "ten_nhan_vien", "email", "chuc_vu", "trang_thai"],
    required: ["id_nhan_vien", "ten_nhan_vien", "email", "chuc_vu", "trang_thai"],
    validations: { chuc_vu: ["MR", "Supervisor", "Manager", "Admin"], trang_thai: ["Active", "Inactive"] },
    examples: [
      ["NV-DN-01", "Nguyễn Minh Anh", "mr.danang@cpc1hn.vn", "MR", "Active"],
      ["NV-SV-01", "Lê Thu Hà", "supervisor.mt@cpc1hn.vn", "Supervisor", "Active"]
    ]
  },
  {
    name: "employee_territories",
    title: "Phân quyền địa bàn",
    note: "Một nhân sự có thể có nhiều địa bàn. Dùng để lọc quyền xem/nhập theo email.",
    headers: ["id_nhan_vien", "id_dia_ban", "is_primary"],
    required: ["id_nhan_vien", "id_dia_ban", "is_primary"],
    validations: { is_primary: ["TRUE", "FALSE"] },
    examples: [
      ["NV-DN-01", "DB_DANANG", true],
      ["NV-SV-01", "DB_DANANG", true],
      ["NV-SV-01", "DB_QUANGNAM", false]
    ]
  },
  {
    name: "tb_san_pham",
    title: "Sản phẩm",
    note: "Phân loại rõ dạng bào chế chuyên biệt. Giá kê đơn dùng để tính doanh số phát sinh từ kê đơn.",
    headers: ["id_san_pham", "ten_san_pham", "hoat_chat", "dang_bao_che", "mo_ta_dang_bao_che", "quy_cach", "gia_ke_don", "trang_thai"],
    required: ["id_san_pham", "ten_san_pham", "dang_bao_che", "mo_ta_dang_bao_che", "gia_ke_don", "trang_thai"],
    validations: { dang_bao_che: ["BFS", "BOV", "MDI", "VienDatDoKhuon", "Khac"], trang_thai: ["Active", "Inactive"] },
    examples: [
      ["SP_NEB_3", "Nebusal 3%", "Natri clorid ưu trương", "BFS", "Dung dịch khí dung BFS", "Hộp 20 ống", 56000, "Active"],
      ["SP_ZENSALBU", "Zensalbu Inhaler", "Salbutamol", "MDI", "Ống hít định liều MDI", "Bình hít", 82000, "Active"]
    ]
  },
  {
    name: "tb_khach_hang",
    title: "Khách hàng",
    note: "Mỗi khách hàng thuộc một địa bàn. Phòng mạch tư là nhóm dùng để quét mất sale.",
    headers: ["id_khach_hang", "ten_khach_hang", "loai_khach_hang", "dia_chi", "dien_thoai", "id_dia_ban", "trang_thai"],
    required: ["id_khach_hang", "ten_khach_hang", "loai_khach_hang", "id_dia_ban", "trang_thai"],
    validations: { loai_khach_hang: ["BenhVien", "SoYTe", "PhongMachTu"], trang_thai: ["Active", "Inactive"] },
    examples: [
      ["KH_PM_DN_01", "Phòng mạch Hải Châu", "PhongMachTu", "Hải Châu, Đà Nẵng", "", "DB_DANANG", "Active"],
      ["KH_BV_DN_01", "Bệnh viện Đà Nẵng", "BenhVien", "Hải Châu, Đà Nẵng", "", "DB_DANANG", "Active"]
    ]
  },
  {
    name: "employee_customers",
    title: "Phân công khách hàng",
    note: "Bảng này quyết định TDV được nhập/xem khách hàng nào.",
    headers: ["id_nhan_vien", "id_khach_hang"],
    required: ["id_nhan_vien", "id_khach_hang"],
    examples: [
      ["NV-DN-01", "KH_PM_DN_01"],
      ["NV-DN-01", "KH_BV_DN_01"]
    ]
  },
  {
    name: "tb_ke_don",
    title: "Nhật ký kê đơn",
    note: "Dữ liệu hằng ngày. Có thể để doanh_so_phat_sinh trống nếu import script tự tính từ giá sản phẩm.",
    headers: ["ngay_bao_cao", "id_nhan_vien", "id_khach_hang", "id_san_pham", "so_luong_ke_don", "doanh_so_phat_sinh"],
    required: ["ngay_bao_cao", "id_nhan_vien", "id_khach_hang", "id_san_pham", "so_luong_ke_don"],
    examples: [
      [new Date("2026-08-20"), "NV-DN-01", "KH_PM_DN_01", "SP_NEB_3", 8, 448000],
      [new Date("2026-08-20"), "NV-QN-01", "KH_PM_QNAM_01", "SP_VAGI_ODIN", 5, 370000]
    ]
  },
  {
    name: "tb_doanh_thu",
    title: "Doanh số thực tế",
    note: "Nguồn đối soát từ kế toán hoặc data sale. thang_nam dùng định dạng YYYY-MM.",
    headers: ["thang_nam", "id_khach_hang", "id_san_pham", "id_nhan_vien", "doanh_so_thuc", "source_note"],
    required: ["thang_nam", "id_khach_hang", "id_san_pham", "id_nhan_vien", "doanh_so_thuc"],
    examples: [
      ["2026-08", "KH_PM_QNAM_01", "SP_VAGI_ODIN", "NV-QN-01", 1850000, "Kế toán chi nhánh"],
      ["2026-07", "KH_PM_DN_01", "SP_NEB_3", "NV-DN-01", 0, "Data sale tháng"]
    ]
  },
  {
    name: "tb_thau",
    title: "Gói thầu",
    note: "Theo dõi trạng thái hồ sơ thầu. han_nop dùng yyyy-mm-dd.",
    headers: ["id_goi_thau", "id_khach_hang", "id_san_pham", "so_luong_thau", "gia_du_thau", "trang_thai", "id_nhan_vien", "han_nop", "ngay_cap_nhat"],
    required: ["id_goi_thau", "id_khach_hang", "id_san_pham", "trang_thai", "id_nhan_vien", "ngay_cap_nhat"],
    validations: { trang_thai: ["DangLamHoSo", "ChoKetQua", "TrungThau", "TruotThau"] },
    examples: [
      ["GT-DN-2026-01", "KH_BV_DN_01", "SP_NEB_3", 1000, 52000, "DangLamHoSo", "NV-DN-01", new Date("2026-08-27"), new Date("2026-08-20")]
    ]
  },
  {
    name: "daily_reports",
    title: "Báo cáo ngày",
    note: "Mỗi nhân viên chỉ có một báo cáo chính thức cho một ngày.",
    headers: ["report_date", "id_nhan_vien", "summary", "kpi_note"],
    required: ["report_date", "id_nhan_vien", "summary"],
    examples: [
      [new Date("2026-08-20"), "NV-DN-01", "Đi tuyến Hải Châu, cập nhật kê đơn Nebusal.", "Đã có kê đơn trong ngày"]
    ]
  },
  {
    name: "kpi_targets",
    title: "Chỉ tiêu KPI",
    note: "Chỉ tiêu theo tháng. Có thể gắn theo sản phẩm hoặc để trống id_san_pham cho chỉ tiêu tổng.",
    headers: ["thang_nam", "id_nhan_vien", "id_dia_ban", "id_san_pham", "target_sales", "target_prescriptions"],
    required: ["thang_nam", "id_nhan_vien", "target_sales", "target_prescriptions"],
    examples: [
      ["2026-08", "NV-DN-01", "DB_DANANG", "SP_NEB_3", 50000000, 250],
      ["2026-08", "NV-QN-01", "DB_QUANGNAM", "", 35000000, 180]
    ]
  }
];

const codebookRows = [
  ["Danh mục", "Giá trị", "Ý nghĩa"],
  ["chuc_vu", "MR", "Trình dược viên"],
  ["chuc_vu", "Supervisor", "Quản lý vùng"],
  ["chuc_vu", "Manager", "Quản lý toàn hệ thống"],
  ["chuc_vu", "Admin", "Quản trị hệ thống"],
  ["trang_thai", "Active", "Đang hoạt động"],
  ["trang_thai", "Inactive", "Ngừng hoạt động"],
  ["loai_khach_hang", "BenhVien", "Bệnh viện"],
  ["loai_khach_hang", "SoYTe", "Sở Y tế"],
  ["loai_khach_hang", "PhongMachTu", "Phòng mạch tư nhân"],
  ["dang_bao_che", "BFS", "Dung dịch khí dung BFS"],
  ["dang_bao_che", "BOV", "Bình xịt mũi BOV"],
  ["dang_bao_che", "MDI", "Ống hít định liều MDI"],
  ["dang_bao_che", "VienDatDoKhuon", "Viên đặt đổ khuôn"],
  ["trang_thai_thau", "DangLamHoSo", "Đang làm hồ sơ"],
  ["trang_thai_thau", "ChoKetQua", "Chờ kết quả"],
  ["trang_thai_thau", "TrungThau", "Trúng thầu"],
  ["trang_thai_thau", "TruotThau", "Trượt thầu"]
];

function csvEscape(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeCsv(sheetDef) {
  const rows = [sheetDef.headers, ...sheetDef.examples];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  await fs.writeFile(path.join(csvDir, `${sheetDef.name}.csv`), csv, "utf8");
}

function writeTableSheet(workbook, sheetDef) {
  const sheet = workbook.worksheets.add(sheetDef.name);
  sheet.showGridLines = false;
  sheet.getRange("A1:H1").merge();
  sheet.getRange("A1").values = [[sheetDef.title]];
  sheet.getRange("A1").format = commonFormats.title;
  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2").values = [[sheetDef.note]];
  sheet.getRange("A2").format = commonFormats.subtitle;

  const metaRows = [
    sheetDef.headers,
    sheetDef.headers.map((header) => (sheetDef.required.includes(header) ? "Bắt buộc" : "Không bắt buộc"))
  ];
  sheet.getRangeByIndexes(3, 0, 2, sheetDef.headers.length).values = metaRows;
  sheet.getRangeByIndexes(3, 0, 1, sheetDef.headers.length).format = commonFormats.header;
  sheet.getRangeByIndexes(4, 0, 1, sheetDef.headers.length).format = { font: { italic: true }, fill: "#F8FAFC", wrapText: true };

  const exampleRows = sheetDef.examples.length ? sheetDef.examples : [sheetDef.headers.map(() => "")];
  sheet.getRangeByIndexes(5, 0, exampleRows.length, sheetDef.headers.length).values = exampleRows;

  const tableRange = sheet.getRangeByIndexes(3, 0, Math.max(50, exampleRows.length + 2), sheetDef.headers.length);
  tableRange.format.borders = { preset: "all", style: "thin", color: "#D9E2EC" };
  tableRange.format.wrapText = true;

  sheetDef.headers.forEach((header, index) => {
    const columnRange = sheet.getRangeByIndexes(5, index, 45, 1);
    columnRange.format = sheetDef.required.includes(header) ? commonFormats.required : commonFormats.optional;
    if (header.includes("ngay") || header.includes("date") || header === "han_nop") {
      columnRange.format.numberFormat = "yyyy-mm-dd";
    }
    if (header.includes("gia") || header.includes("doanh_so") || header.includes("target_sales")) {
      columnRange.format.numberFormat = "#,##0";
    }
    if (header.startsWith("id_") || header === "email" || header === "thang_nam") {
      columnRange.format.numberFormat = "@";
    }
    if (sheetDef.validations?.[header]) {
      columnRange.dataValidation = { rule: { type: "list", values: sheetDef.validations[header] } };
    }
  });

  sheet.freezePanes.freezeRows(5);
  sheet.getUsedRange().format.autofitColumns();
  sheet.getRangeByIndexes(0, 0, 1, sheetDef.headers.length).format.rowHeight = 28;
}

async function main() {
  await fs.mkdir(repoTemplateDir, { recursive: true });
  await fs.mkdir(csvDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const workbook = Workbook.create();
  const readme = workbook.worksheets.add("README");
  readme.showGridLines = false;
  readme.getRange("A1:F1").merge();
  readme.getRange("A1").values = [["CPC1 Hà Nội - Data Import Template"]];
  readme.getRange("A1").format = commonFormats.title;
  readme.getRange("A3:F12").values = [
    ["Mục", "Hướng dẫn", "", "", "", ""],
    ["Thứ tự nhập", "1. tb_dia_ban -> 2. tb_nhan_su -> 3. employee_territories -> 4. tb_san_pham -> 5. tb_khach_hang -> 6. employee_customers -> sau đó nhập giao dịch.", "", "", "", ""],
    ["ID", "Giữ nguyên dạng text, không dùng dấu cách. Ví dụ: NV-DN-01, DB_DANANG, KH_PM_DN_01.", "", "", "", ""],
    ["Ngày", "Dùng định dạng yyyy-mm-dd.", "", "", "", ""],
    ["Tháng", "Dùng định dạng yyyy-mm, ví dụ 2026-08.", "", "", "", ""],
    ["Tiền/số lượng", "Nhập số nguyên, không nhập ký hiệu VND.", "", "", "", ""],
    ["Phân quyền", "Không bỏ qua employee_territories và employee_customers vì backend dùng hai bảng này để lọc quyền theo email.", "", "", "", ""],
    ["Mất sale", "Cần dữ liệu tb_doanh_thu theo tháng; phòng mạch tư từng có sale nhưng 4 tháng gần nhất bằng 0 sẽ bị cảnh báo.", "", "", "", ""],
    ["Google Sheets", "Có thể upload workbook này lên Google Sheets để nhiều người cùng chuẩn bị dữ liệu.", "", "", "", ""],
    ["Import DB", "Ưu tiên import từng CSV theo đúng thứ tự để tránh lỗi khóa ngoại.", "", "", "", ""]
  ];
  readme.getRange("A3:B12").format.borders = { preset: "all", style: "thin", color: "#D9E2EC" };
  readme.getRange("A3:B3").format = commonFormats.header;
  readme.getRange("A:B").format.wrapText = true;
  readme.getUsedRange().format.autofitColumns();
  readme.getRange("A:A").format.columnWidth = 20;
  readme.getRange("B:B").format.columnWidth = 110;
  readme.getRange("A4:B12").format.rowHeight = 36;

  const codebook = workbook.worksheets.add("Codebook");
  codebook.showGridLines = false;
  codebook.getRange("A1:C1").merge();
  codebook.getRange("A1").values = [["Codebook - Giá trị hợp lệ"]];
  codebook.getRange("A1").format = commonFormats.title;
  codebook.getRangeByIndexes(2, 0, codebookRows.length, 3).values = codebookRows;
  codebook.getRange("A3:C3").format = commonFormats.header;
  codebook.getRangeByIndexes(2, 0, codebookRows.length, 3).format.borders = { preset: "all", style: "thin", color: "#D9E2EC" };
  codebook.getUsedRange().format.autofitColumns();

  for (const sheetDef of sheets) {
    writeTableSheet(workbook, sheetDef);
    await writeCsv(sheetDef);
  }

  const workbookPreview = await workbook.inspect({
    kind: "sheet,table",
    maxChars: 5000,
    tableMaxRows: 4,
    tableMaxCols: 8
  });
  console.log(workbookPreview.ndjson);

  const errorScan = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: "formula error scan"
  });
  console.log(errorScan.ndjson);

  for (const sheetName of ["README", "tb_nhan_su", "tb_khach_hang", "tb_doanh_thu"]) {
    const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(path.join(outputDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
  }

  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  const repoXlsx = path.join(repoTemplateDir, "cpc1hn_data_import_template.xlsx");
  const outputXlsx = path.join(outputDir, "cpc1hn_data_import_template.xlsx");
  await xlsx.save(repoXlsx);
  await xlsx.save(outputXlsx);

  const index = [
    "# CPC1HN Data Templates",
    "",
    "Bộ file mẫu chuẩn bị dữ liệu thật cho hệ thống quản lý trình dược viên CPC1 Hà Nội.",
    "",
    "## File chính",
    "",
    "- `cpc1hn_data_import_template.xlsx`: workbook nhiều sheet để nhập liệu.",
    "- `csv/`: từng bảng ở dạng CSV để import vào database hoặc Google Sheets.",
    "",
    "## Thứ tự nhập dữ liệu",
    "",
    "1. `tb_dia_ban`",
    "2. `tb_nhan_su`",
    "3. `employee_territories`",
    "4. `tb_san_pham`",
    "5. `tb_khach_hang`",
    "6. `employee_customers`",
    "7. `tb_ke_don`, `tb_doanh_thu`, `tb_thau`, `daily_reports`, `kpi_targets`",
    "",
    "## Quy tắc",
    "",
    "- Không đổi tên cột.",
    "- ID giữ dạng text.",
    "- Ngày dùng `yyyy-mm-dd`.",
    "- Tháng dùng `yyyy-mm`.",
    "- Tiền và số lượng nhập số, không nhập ký hiệu VND.",
    "- Không bỏ qua hai bảng phân quyền `employee_territories` và `employee_customers`."
  ].join("\n");
  await fs.writeFile(path.join(repoTemplateDir, "README.md"), index, "utf8");

  console.log(JSON.stringify({ repoXlsx, outputXlsx, csvDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
