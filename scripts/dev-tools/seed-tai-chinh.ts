// scripts/dev-tools/seed-tai-chinh.ts
// Dữ liệu mẫu để kiểm tra phần Tài chính trên DATABASE THỬ (localhost). KHÔNG chạy với Supabase thật.
//   DATABASE_URL=postgres://postgres@localhost:5433/devpo pnpm exec tsx scripts/dev-tools/seed-tai-chinh.ts
//
// Tạo: kho cũ 3 máy (chưa có lô) + 2 đơn bán cũ, rồi chạy db:tai-chinh (gom 3 máy vào LO-CU-KHONG-RO),
// rồi 2 đầu hàng, 3 lô, 17 máy, 4 đơn bán (1 đơn 2 máy trả góp, 1 đơn COD), 3 lần trả nợ.
// "Hôm nay" của bộ mẫu = 23/11/2026 (test truyền ngày này vào khi tính).
import bcrypt from "bcryptjs"
import { KHO_HEADER, BAN_HEADER } from "./seed-tai-chinh-headers"

const DB = process.env.DATABASE_URL || ""
if (!/localhost|127\.0\.0\.1/.test(DB)) {
  console.error("Chỉ chạy với DATABASE_URL ở localhost.")
  process.exit(1)
}
process.env.DATA_BACKEND = "postgres"
process.env.SHEET_MIRROR = "off"

const USERS_HEADER = ["ID Nhân Viên", "Email", "Tên", "Vai Trò", "Chi nhánh", "Ngày Tạo", "Trạng Thái", "Lần Đăng Nhập Cuối", "Mật Khẩu", "Số Điện Thoại"]
const NGUON_HEADER = ["ID", "Tên Nguồn", "Loại Nguồn", "Số Dư", "Trạng Thái Khả Dụng", "Ngày Cập Nhật", "Ghi Chú", "Tự Động", "Created At", "Updated At", "Chi Nhánh"]
const GD_HEADER = ["ID", "Loại Giao Dịch", "Số Tiền", "Ngày Giao Dịch", "Tài Khoản ID", "Tên Tài Khoản", "Ref Loại", "Ref ID", "Đối Tượng", "Nguồn", "Ghi Chú", "Tự Động", "CreatedBy", "CreatedAt", "Chi Nhánh"]

type May = { imei?: string; serial?: string; ten: string; loai: string; dl: string; mau: string; gn: number; gb: number; ngay: string }
const kRow = (m: May, id = "") => {
  const r = Array(KHO_HEADER.length).fill("")
  const set = (h: string, v: any) => (r[KHO_HEADER.indexOf(h)] = v)
  set(" ID Máy", id || (m.imei || m.serial || "").slice(-5))
  set("Ngày Nhập", m.ngay)
  set("Tên Sản Phẩm", m.ten)
  set("Loại Máy", m.loai)
  set("Dung Lượng", m.dl)
  set("Pin (%)", "95")
  set("Màu Sắc", m.mau)
  set("IMEI", m.imei || "")
  set("Serial", m.serial || "")
  set("Tình Trạng Máy", "99")
  set("Giá nhập", m.gn)
  set("Giá Bán", m.gb)
  set("Trạng Thái", "Còn hàng")
  set("Trạng Thái Kho", "Kho trong")
  set("Đang xử lý", "No")
  set("Chi Nhánh", "DEV PỒ")
  return r
}
const bRow = (o: Record<string, any>) => BAN_HEADER.map((h) => (o[h] === undefined ? "" : o[h]))

async function main() {
  const pg = await import("../../lib/sheet-store/pg")
  // 1. bảng gốc
  const hash = await bcrypt.hash("test1234", 8)
  await pg.importSheet("USERS", [
    USERS_HEADER,
    ["NV001", "chu@local", "Chủ Shop", "chu_shop", "1", "", "hoat_dong", "", hash, ""],
    ["NV002", "nv@local", "Nhân Viên", "nhan_vien", "1", "", "hoat_dong", "", hash, ""],
    ["NV003", "ql@local", "Quản Lý", "quan_ly", "1", "", "hoat_dong", "", hash, ""],
  ])
  await pg.importSheet("Kho_Hang", [
    KHO_HEADER,
    kRow({ serial: "F6MDRGY5Q1KN", ten: "iPad Gen 8", loai: "", dl: "32 GB", mau: "Silver", gn: 3_050_000, gb: 4_390_000, ngay: "16/9/2026" }),
    kRow({ imei: "355658235796204", ten: "iPhone 12", loai: "Quốc tế", dl: "64GB", mau: "Black", gn: 3_800_000, gb: 5_000_000, ngay: "24/10/2026" }),
    kRow({ serial: "DMPDW2HCPV04", ten: "iPad Pro 2020 12.9-inch", loai: "Wifi", dl: "128GB", mau: "Silver", gn: 0, gb: 0, ngay: "22/11/2026" }),
  ])
  await pg.importSheet("Ban_Hang", [
    BAN_HEADER,
    bRow({ "Mã đơn hàng": "DH00001", "Ngày bán": "12/10/2025", "Tên Sản Phẩm": "iPhone 16 Pro", "Loại Máy": "Lock", IMEI: "353357358302526", "Giá Bán": 16_890_000, "Tổng Thu": 16_890_000, "Hình Thức Thanh Toán": "Chuyển khoản", "Giá Nhập": 16_529_000, Lãi: 361_000, "Người Bán": "NV003", "Chi Nhánh": "DEV PỒ" }),
    bRow({ "Mã đơn hàng": "DH00002", "Ngày bán": "12/10/2025", "Tên Sản Phẩm": "iPhone 16 Pro", "Loại Máy": "Lock", IMEI: "354136655622003", "Giá Bán": 16_700_000, "Tổng Thu": 16_700_000, "Hình Thức Thanh Toán": "Chuyển khoản", "Giá Nhập": 16_529_000, Lãi: 171_000, "Người Bán": "NV003", "Chi Nhánh": "DEV PỒ" }),
  ])
  await pg.importSheet("DongTien_NguonTien", [
    NGUON_HEADER,
    ["acc_cash", "Tiền mặt", "cash", "5000000", "AVAILABLE", "2026-11-23", "", "false", "", "", "DEV PỒ"],
    ["acc_bank", "Tiền tài khoản", "bank", "50000000", "AVAILABLE", "2026-11-23", "", "false", "", "", "DEV PỒ"],
  ])
  await pg.importSheet("DongTien_GiaoDich", [GD_HEADER])
  await pg.importSheet("Lich_Su_Quan_Tri", [["Thời Gian", "Email", "Tên", "Vai Trò", "Bảng", "Thao Tác", "Khoá", "Cột", "Giá Trị Cũ", "Giá Trị Mới"]])
  console.log("✓ bảng gốc")
  await pg.closePool()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
