// scripts/dev-tools/seed-tai-chinh-2.ts — bước 2 của dữ liệu mẫu (sau seed-tai-chinh.ts + db:tai-chinh --yes).
// Đầu hàng, lô, máy, đơn bán, trả nợ. Chỉ localhost.
import { KHO_HEADER, BAN_HEADER } from "./seed-tai-chinh-headers"

const DB = process.env.DATABASE_URL || ""
if (!/localhost|127\.0\.0\.1/.test(DB)) {
  console.error("Chỉ chạy với DATABASE_URL ở localhost.")
  process.exit(1)
}
process.env.DATA_BACKEND = "postgres"
process.env.SHEET_MIRROR = "off"

type M = { imei?: string; serial?: string; ten: string; loai: string; dl: string; mau: string; gn: number; gb: number }
const vn = (iso: string) => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}/${iso.slice(0, 4)}`
function kRow(m: M, ngayISO: string) {
  const o: Record<string, any> = {
    " ID Máy": (m.imei || m.serial || "").slice(-5), "Ngày Nhập": vn(ngayISO), "Tên Sản Phẩm": m.ten, "Loại Máy": m.loai,
    "Dung Lượng": m.dl, "Pin (%)": "95", "Màu Sắc": m.mau, IMEI: m.imei || "", Serial: m.serial || "", "Tình Trạng Máy": "99",
    "Giá nhập": m.gn, "Giá Bán": m.gb, "Trạng Thái": "Còn hàng", "Trạng Thái Kho": "Kho trong", "Đang xử lý": "No", "Chi Nhánh": "DEV PỒ",
  }
  return KHO_HEADER.map((h) => o[h] ?? "")
}
const bRow = (o: Record<string, any>) => BAN_HEADER.map((h) => (o[h] === undefined ? "" : o[h]))

async function main() {
  const pg = await import("../../lib/sheet-store/pg")
  const gs = await import("../../lib/google-sheets")
  const g = await import("../../lib/tai-chinh/ghi")
  const { BANG, docBang } = await import("../../lib/tai-chinh/bang")
  const nguoi = "seed"
  const A = await g.themDauHang({ ten: "Anh Tâm Lock", soNgayNo: 7, sdt: "0900000001", loaiHang: "iPhone Lock" })
  const B = await g.themDauHang({ ten: "Chị Hoa iPad", soNgayNo: 15, sdt: "0900000002", loaiHang: "iPad" })
  await g.themCtv({ ten: "CTV Minh", sdt: "0900000003", hoaHong: 300000 })

  const L1 = await g.taoLo({ dauHangId: A, ngayNhap: "2026-10-20", chiPhiLo: 300000, chiPhiTraDauHang: false, daTraLucNhap: 10_000_000, chiNhanh: "DEV PỒ", nguoiTao: nguoi, ghiChu: "Lô mẫu 1" })
  const L2 = await g.taoLo({ dauHangId: A, ngayNhap: "2026-11-10", chiPhiLo: 200000, chiPhiTraDauHang: true, hanTra: "2026-11-28", chiNhanh: "DEV PỒ", nguoiTao: nguoi, ghiChu: "Lô mẫu 2" })
  const L3 = await g.taoLo({ dauHangId: B, ngayNhap: "2026-11-18", chiPhiLo: 150000, chiNhanh: "DEV PỒ", nguoiTao: nguoi, ghiChu: "Lô mẫu 3" })
  console.log("lô:", L1, L2, L3)

  const lo: Record<string, { ngay: string; may: M[] }> = {
    [L1]: { ngay: "2026-10-20", may: [
      { imei: "350000000000101", ten: "iPhone 16 Pro Max", loai: "Lock", dl: "256GB", mau: "Titan Sa Mạc", gn: 17_000_000, gb: 18_500_000 },
      { imei: "350000000000102", ten: "iPhone 16 Pro Max", loai: "Lock", dl: "256GB", mau: "Titan Đen", gn: 17_000_000, gb: 18_500_000 },
      { imei: "350000000000103", ten: "iPhone 15 Pro Max", loai: "Lock", dl: "256GB", mau: "Xanh", gn: 12_000_000, gb: 13_200_000 },
      { imei: "350000000000104", ten: "iPhone 15 Pro Max", loai: "Lock", dl: "256GB", mau: "Trắng", gn: 12_000_000, gb: 13_500_000 },
    ] },
    [L2]: { ngay: "2026-11-10", may: [
      { imei: "350000000000201", ten: "iPhone 16 Pro Max", loai: "Quốc tế", dl: "256GB", mau: "Titan Tự Nhiên", gn: 20_500_000, gb: 22_990_000 },
      { imei: "350000000000202", ten: "iPhone 16 Pro Max", loai: "Quốc tế", dl: "256GB", mau: "Titan Trắng", gn: 20_500_000, gb: 21_490_000 },
      { imei: "350000000000203", ten: "iPhone 14 Pro Max", loai: "Quốc tế", dl: "128GB", mau: "Tím", gn: 12_000_000, gb: 14_500_000 },
    ] },
    [L3]: { ngay: "2026-11-18", may: [
      { serial: "SAIR5000001", ten: "iPad Air 5", loai: "Wifi", dl: "64GB", mau: "Xám", gn: 7_600_000, gb: 8_800_000 },
      { serial: "SAIR5000002", ten: "iPad Air 5", loai: "Wifi", dl: "64GB", mau: "Xanh", gn: 7_600_000, gb: 8_800_000 },
      { serial: "SGEN9000001", ten: "iPad Gen 9", loai: "Wifi", dl: "64GB", mau: "Bạc", gn: 4_100_000, gb: 4_800_000 },
      { serial: "SMINI500001", ten: "iPad mini 5", loai: "Wifi", dl: "64GB", mau: "Vàng", gn: 4_500_000, gb: 5_600_000 },
      { serial: "SPRO2020001", ten: "iPad Pro 2020 11-inch", loai: "Wifi", dl: "128GB", mau: "Xám", gn: 12_200_000, gb: 13_990_000 },
      { serial: "SAIR4000001", ten: "iPad Air 4", loai: "Wifi", dl: "64GB", mau: "Xanh", gn: 6_600_000, gb: 7_990_000 },
      { serial: "SGEN8000001", ten: "iPad Gen 8", loai: "Wifi", dl: "32GB", mau: "Bạc", gn: 2_750_000, gb: 3_500_000 },
    ] },
  }
  for (const [ma, x] of Object.entries(lo)) {
    await gs.appendMultipleToGoogleSheets("Kho_Hang", x.may.map((m) => kRow(m, x.ngay)))
    const n = await g.themMayVaoLo(ma, x.may.map((m) => ({ imei: m.imei, serial: m.serial, ten: m.ten, loaiMay: m.loai, dungLuong: m.dl, mau: m.mau, giaNhap: m.gn, giaBan: m.gb, ngayNhap: x.ngay })), "DEV PỒ")
    console.log(`${ma}: +${n} máy`)
  }

  // đơn bán (sau khi bán thì Kho xoá máy, sổ lô giữ lại)
  const ban = [
    bRow({ "Mã đơn hàng": "DH10001", "Ngày bán": "25/10/2026", "Tên Khách Hàng": "Khách A", "Tên Sản Phẩm": "iPhone 16 Pro Max", "Loại Máy": "Lock", IMEI: "350000000000101", "Giá Bán": 18_300_000, "Tổng Thu": 18_300_000, "Hình Thức Thanh Toán": "Chuyển khoản: ₫18.300.000", "Giá Nhập": 17_000_000, Lãi: 1_300_000, "Người Bán": "Nhân Viên", "Chi Nhánh": "DEV PỒ" }),
    ...["350000000000103", "350000000000104"].map((imei, i) =>
      bRow({ "Mã đơn hàng": "DH10002", "Ngày bán": "2/11/2026", "Tên Khách Hàng": "Khách B", "Tên Sản Phẩm": "iPhone 15 Pro Max", "Loại Máy": "Lock", IMEI: imei, "Giá Bán": i ? 13_500_000 : 13_200_000, "Tổng Thu": 26_000_000, "Hình Thức Thanh Toán": "Chuyển khoản: ₫6.000.000 | HDSaison: Trả trước ₫6.000.000 + Góp ₫14.000.000", "Giá Nhập": 12_000_000, "Người Bán": "Nhân Viên", "Chi Nhánh": "DEV PỒ" })),
    bRow({ "Mã đơn hàng": "DH10003", "Ngày bán": "20/11/2026", "Tên Khách Hàng": "Khách C", "Tên Sản Phẩm": "iPhone 14 Pro Max", "Loại Máy": "Quốc tế", IMEI: "350000000000203", "Giá Bán": 14_200_000, "Tổng Thu": 14_200_000, "Hình Thức Thanh Toán": "Chuyển khoản: ₫500.000 | COD (GHTK): ₫13.700.000", "Hình Thức Vận Chuyển": "Giao hàng GHTK", "Giá Nhập": 12_000_000, Lãi: 2_200_000, "Người Bán": "Nhân Viên", "Chi Nhánh": "DEV PỒ" }),
    bRow({ "Mã đơn hàng": "DH10004", "Ngày bán": "22/11/2026", "Tên Khách Hàng": "Khách D", "Tên Sản Phẩm": "iPad Air 5", "Loại Máy": "Wifi", Serial: "SAIR5000001", "Giá Bán": 8_500_000, "Tổng Thu": 8_500_000, "Hình Thức Thanh Toán": "Tiền mặt: ₫8.500.000", "Giá Nhập": 7_600_000, Lãi: 900_000, "Người Bán": "Nhân Viên", "Chi Nhánh": "DEV PỒ" }),
  ]
  await gs.appendMultipleToGoogleSheets("Ban_Hang", ban)
  const daBan = new Set(["350000000000101", "350000000000103", "350000000000104", "350000000000203", "SAIR5000001"])
  const kho = await pg.readValues("Kho_Hang")
  const iI = kho[0].indexOf("IMEI"), iS = kho[0].indexOf("Serial")
  await pg.importSheet("Kho_Hang", [kho[0], ...kho.slice(1).filter((r) => !daBan.has(r[iI]) && !daBan.has(r[iS]))])

  // phí trên sổ lô
  const { dong } = await docBang(BANG.CHI_TIET_LO)
  const tim = (id: string) => dong.find((d) => d["IMEI"] === id || d["Serial"] === id)!._dong
  await g.suaMayLo(tim("350000000000104"), { ctvBan: "CTV Minh", hoaHong: 300_000 })
  await g.suaMayLo(tim("SAIR5000001"), { phiKhac: 50_000 })
  await g.suaMayLo(tim("SPRO2020001"), { giaSan: 12_500_000 })

  // trả nợ
  const p1 = await g.ghiTraNo({ dauHangId: A, soTien: 20_000_000, ngay: "2026-10-30", nguoiGhi: nguoi })
  const p2 = await g.ghiTraNo({ dauHangId: A, soTien: 5_000_000, ngay: "2026-11-21", maLo: L2, nguoiGhi: nguoi })
  const p3 = await g.ghiTraNo({ dauHangId: B, soTien: 10_000_000, ngay: "2026-11-23", nguonTienId: "acc_bank", ghiChu: "CK", nguoiGhi: nguoi })
  console.log("trả nợ:", p1.phanBo, p2.phanBo, p3.phanBo)
  // chi phí ngoài
  await g.themChiPhi({ ngay: "2026-11-23", loai: "Quảng cáo", soTien: 500_000, ghiChu: "FB ads", nguonTienId: "acc_bank", nguoiGhi: nguoi, chiNhanh: "DEV PỒ" })
  await g.themChiPhi({ ngay: "2026-11-22", loai: "Ship đơn ngoài", soTien: 30_000, maLo: L3, ghiChu: "ship Air 5", nguoiGhi: nguoi, chiNhanh: "DEV PỒ" })
  const huy = await g.themChiPhi({ ngay: "2026-11-23", loai: "Phụ kiện lẻ", soTien: 120_000, nguonTienId: "acc_cash", nguoiGhi: nguoi, chiNhanh: "DEV PỒ" })
  await g.huyChiPhi(huy, nguoi)
  try {
    await g.ghiTraNo({ dauHangId: B, soTien: 40_000_000, nguoiGhi: nguoi })
    console.log("✗ trả vượt nợ KHÔNG bị chặn")
  } catch (e: any) {
    console.log("✓ chặn trả vượt:", e.message)
  }
  await pg.closePool()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
