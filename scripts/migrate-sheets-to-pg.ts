// scripts/migrate-sheets-to-pg.ts
// Migrate dữ liệu cũ Google Sheets -> Postgres (Prisma). Chạy 1 lần (idempotent).
// Thứ tự theo phụ thuộc: users -> customers -> products/partner -> warranty packages
//   -> orders(+items+payments) -> warranty contracts -> cnc/repair/accessory/deposit
//   -> return -> notification -> product_history -> cash -> check_in/out.
// Tiền -> Int (strip ký tự không phải số). Ngày VN -> Date (luxon, Asia/Ho_Chi_Minh).
// Bản ghi thiếu khóa / trùng -> log ra console + ghi file scripts/migrate-issues.log.
//
// Chạy:  pnpm db:migrate-data   (đã set DATABASE_URL + Google creds trong .env.local)
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import { writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { DateTime } from "luxon"
import { readFromGoogleSheets, colIndex } from "../lib/google-sheets"
import { prisma } from "../lib/prisma"

/* ----------------------------- helpers ----------------------------- */
const ZONE = "Asia/Ho_Chi_Minh"
const issues: string[] = []
const logIssue = (m: string) => { issues.push(m); console.warn("  ⚠ " + m) }

function parseMoney(s: unknown): number {
  if (s == null) return 0
  const str = String(s)
  const neg = /^\s*-/.test(str)
  const digits = str.replace(/[^\d]/g, "")
  if (!digits) return 0
  let n = parseInt(digits, 10)
  if (!Number.isFinite(n)) return 0
  if (neg) n = -n
  return Number.isSafeInteger(n) ? n : 0
}
function parseIntSafe(s: unknown): number {
  const m = String(s ?? "").match(/-?\d+/)
  return m ? parseInt(m[0], 10) : 0
}
function parseIntOrNull(s: unknown): number | null {
  const m = String(s ?? "").match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}
function parseBool(s: unknown): boolean {
  return /^(true|1|x|có|yes|kích hoạt)$/i.test(String(s ?? "").trim())
}
const DATE_FORMATS = [
  "HH:mm:ss dd/MM/yyyy", "HH:mm:ss d/M/yyyy",
  "dd/MM/yyyy HH:mm:ss", "d/M/yyyy HH:mm:ss",
  "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "dd-MM-yyyy",
]
function parseVNDate(s: unknown): Date | null {
  if (s == null) return null
  const str = String(s).trim()
  if (!str) return null
  let dt = DateTime.fromISO(str, { zone: ZONE })
  if (dt.isValid) return dt.toJSDate()
  for (const f of DATE_FORMATS) {
    dt = DateTime.fromFormat(str, f, { zone: ZONE })
    if (dt.isValid) return dt.toJSDate()
  }
  return null
}
function clean(s: unknown): string | null {
  const v = String(s ?? "").trim()
  return v === "" ? null : v
}
function sha(...parts: (string | null | undefined)[]): string {
  return createHash("sha1").update(parts.map((p) => p ?? "").join("|")).digest("hex").slice(0, 24)
}

// Đọc 1 sheet, trả về { header, rows, get(row, ...tên cột) }
async function load(sheet: string) {
  const { header, rows } = await readFromGoogleSheets(sheet, "A1:ZZ100000", { force: true })
  const get = (row: string[], ...names: string[]) => {
    const i = colIndex(header, ...names)
    return i === -1 ? "" : (row[i] ?? "")
  }
  return { header, rows: rows.filter((r) => r.some((c) => String(c ?? "").trim() !== "")), get }
}

type Stat = { sheet: string; read: number; written: number; skipped: number }
const stats: Stat[] = []
const addStat = (s: Stat) => stats.push(s)

/* ----------------------------- 1) USERS ----------------------------- */
async function migrateUsers() {
  const { rows, get } = await load("USERS")
  let w = 0, sk = 0
  for (const r of rows) {
    const employeeCode = clean(get(r, "ID Nhân Viên"))
    const email = clean(get(r, "Email"))
    if (!employeeCode || !email) { sk++; logIssue(`USERS thiếu mã NV/email: ${JSON.stringify(r.slice(0, 3))}`); continue }
    const data = {
      employeeCode,
      email: email.toLowerCase(),
      ten: clean(get(r, "Tên")),
      vaiTro: clean(get(r, "Vai Trò")),
      ngayTao: parseVNDate(get(r, "Ngày Tạo")),
      trangThai: clean(get(r, "Trạng Thái")),
      lastLogin: parseVNDate(get(r, "Lần Đăng Nhập Cuối")),
      matKhau: String(get(r, "Mật Khẩu") ?? ""),
      soDienThoai: clean(get(r, "Số Điện Thoại")),
    }
    await prisma.appUser.upsert({ where: { employeeCode }, update: data, create: data })
    w++
  }
  addStat({ sheet: "USERS -> users", read: rows.length, written: w, skipped: sk })
}

/* --------------------------- 2) CUSTOMERS --------------------------- */
async function migrateCustomers() {
  const { rows, get } = await load("Khach_Hang")
  let w = 0, sk = 0
  const seen = new Set<string>()
  for (const r of rows) {
    const phone = clean(get(r, "Số Điện Thoại"))
    if (!phone) { sk++; logIssue(`Khach_Hang thiếu SĐT: ${clean(get(r, "Tên Khách Hàng")) ?? "?"}`); continue }
    if (seen.has(phone)) { sk++; logIssue(`Khach_Hang SĐT trùng (gộp): ${phone}`); continue }
    seen.add(phone)
    const data = {
      soDienThoai: phone,
      ten: clean(get(r, "Tên Khách Hàng")),
      tongMua: parseMoney(get(r, "Tổng Mua")),
      lanMuaCuoi: parseVNDate(get(r, "Lần Mua Cuối")),
      ngayTao: parseVNDate(get(r, "Ngày tạo")),
      ghiChu: clean(get(r, "Ghi Chú")),
    }
    await prisma.customer.upsert({ where: { soDienThoai: phone }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Khach_Hang -> customers", read: rows.length, written: w, skipped: sk })
}

/* ---------------------------- 3) PRODUCTS --------------------------- */
async function migrateProducts() {
  const { rows, get } = await load("Kho_Hang")
  let w = 0, sk = 0
  const seenImei = new Set<string>(), seenSerial = new Set<string>(), seenId = new Set<string>()
  for (const r of rows) {
    let idMay = clean(get(r, "ID Máy"))
    let imei = clean(get(r, "IMEI"))
    let serial = clean(get(r, "Serial"))
    // tránh đụng unique khi trùng trong sheet
    if (idMay && seenId.has(idMay)) { logIssue(`Kho_Hang ID Máy trùng: ${idMay}`); idMay = null }
    if (imei && seenImei.has(imei)) { logIssue(`Kho_Hang IMEI trùng: ${imei}`); imei = null }
    if (serial && seenSerial.has(serial)) { logIssue(`Kho_Hang Serial trùng: ${serial}`); serial = null }
    const tenSanPham = clean(get(r, "Tên Sản Phẩm"))
    if (!tenSanPham && !imei && !serial && !idMay) { sk++; continue }
    if (idMay) seenId.add(idMay)
    if (imei) seenImei.add(imei)
    if (serial) seenSerial.add(serial)
    const data = {
      idMay, ngayNhap: parseVNDate(get(r, "Ngày Nhập")),
      tenSanPham: tenSanPham ?? "(không tên)",
      loaiMay: clean(get(r, "Loại Máy")),
      dungLuong: clean(get(r, "Dung Lượng")),
      pinPhanTram: parseIntOrNull(get(r, "Pin (%)")),
      mauSac: clean(get(r, "Màu Sắc")),
      imei, serial,
      tinhTrangMay: clean(get(r, "Tình Trạng Máy")),
      dangSim: clean(get(r, "Dạng Sim")),
      giaNhap: parseMoney(get(r, "Giá Nhập")),
      giaBan: parseMoney(get(r, "Giá Bán")),
      giamGia: parseMoney(get(r, "Giảm Giá")),
      giaSi: parseMoney(get(r, "Giá Sỉ")),
      ghiChu: clean(get(r, "Ghi Chú")),
      trangThai: clean(get(r, "Trạng Thái")),
      trangThaiKho: clean(get(r, "Trạng Thái Kho")),
      linkAnh: clean(get(r, "LINK ẢNH")),
    }
    // idMay là khóa tự nhiên tốt nhất; nếu không có dùng imei/serial; nếu đều rỗng -> create thường
    if (idMay) await prisma.product.upsert({ where: { idMay }, update: data, create: data })
    else if (imei) await prisma.product.upsert({ where: { imei }, update: data, create: data })
    else if (serial) await prisma.product.upsert({ where: { serial }, update: data, create: data })
    else await prisma.product.create({ data })
    w++
  }
  addStat({ sheet: "Kho_Hang -> products", read: rows.length, written: w, skipped: sk })
}

/* ------------------------- 3b) PARTNER PRODUCTS -------------------- */
async function migratePartnerProducts() {
  const { rows, get } = await load("Hang_Doi_Tac")
  let w = 0
  for (const r of rows) {
    await prisma.partnerProduct.create({
      data: {
        idMay: clean(get(r, "ID Máy")),
        ngayNhap: parseVNDate(get(r, "Ngày Nhập")),
        nguonHang: clean(get(r, "Nguồn Hàng")),
        tenSanPham: clean(get(r, "Tên Sản Phẩm")),
        loaiMay: clean(get(r, "Loại Máy")),
        dungLuong: clean(get(r, "Dung Lượng")),
        pinPhanTram: parseIntOrNull(get(r, "Pin (%)")),
        mauSac: clean(get(r, "Màu Sắc")),
        imei: clean(get(r, "IMEI")),
        serial: clean(get(r, "Serial")),
        tinhTrangMay: clean(get(r, "Tình Trạng Máy")),
        giaNhap: parseMoney(get(r, "Giá Nhập")),
        giaBan: parseMoney(get(r, "Giá Bán")),
        ghiChu: clean(get(r, "Ghi Chú")),
        trangThai: clean(get(r, "Trạng Thái")),
      },
    })
    w++
  }
  addStat({ sheet: "Hang_Doi_Tac -> partner_products", read: rows.length, written: w, skipped: 0 })
}

/* ------------------------ 4) WARRANTY PACKAGES --------------------- */
async function migrateWarrantyPackages() {
  const { rows, get } = await load("GOI_BAO_HANH")
  let w = 0, sk = 0
  for (const r of rows) {
    const maGoi = clean(get(r, "Mã Gói"))
    if (!maGoi) { sk++; continue }
    const data = {
      maGoi,
      tenGoi: clean(get(r, "Tên Gói")),
      gia: parseMoney(get(r, "Giá (VND)")),
      ngayDoi11: parseIntOrNull(get(r, "Ngày Đổi 1-1")),
      thangBhPhanCung: parseIntOrNull(get(r, "Tháng BH Phần Cứng")),
      thangBhCncDoSim: parseIntOrNull(get(r, "Tháng BH CNC/Độ Sim")),
      hoTroTronDoi: parseBool(get(r, "Hỗ Trợ Trọn Đời")),
      kichHoat: parseBool(get(r, "Kích Hoạt (TRUE/FALSE)")),
      ghiChu: clean(get(r, "Ghi Chú")),
    }
    await prisma.warrantyPackage.upsert({ where: { maGoi }, update: data, create: data })
    w++
  }
  addStat({ sheet: "GOI_BAO_HANH -> warranty_packages", read: rows.length, written: w, skipped: sk })
}

/* --------------- 5) ORDERS + ITEMS + PAYMENTS (Ban_Hang) ----------- */
function parsePayments(raw: string, fallbackAmount: number): { method: string; amount: number }[] {
  const str = String(raw ?? "").trim()
  if (!str) return []
  const segs = str.split(/[|;]+/).map((s) => s.trim()).filter(Boolean)
  const out: { method: string; amount: number }[] = []
  for (const seg of segs) {
    const m = seg.match(/^(.*?):\s*(.+)$/)
    if (m) out.push({ method: m[1].trim(), amount: parseMoney(m[2]) })
    else out.push({ method: seg, amount: 0 })
  }
  // nếu chỉ 1 phương thức không có số -> gán bằng tổng thu
  if (out.length === 1 && out[0].amount === 0) out[0].amount = fallbackAmount
  return out
}
async function migrateOrders() {
  const { rows, get } = await load("Ban_Hang")
  // gom theo mã đơn
  const groups = new Map<string, string[][]>()
  let noId = 0
  for (const r of rows) {
    const ma = clean(get(r, "ID Đơn Hàng"))
    if (!ma) { noId++; continue }
    if (!groups.has(ma)) groups.set(ma, [])
    groups.get(ma)!.push(r)
  }
  if (noId) logIssue(`Ban_Hang: ${noId} dòng thiếu ID Đơn Hàng -> bỏ qua`)

  // cache customer theo phone & product theo imei/serial để gán FK
  const phoneToCustomer = new Map((await prisma.customer.findMany({ select: { id: true, soDienThoai: true } })).map((c) => [c.soDienThoai, c.id]))
  const imeiToProduct = new Map((await prisma.product.findMany({ where: { imei: { not: null } }, select: { id: true, imei: true } })).map((p) => [p.imei!, p.id]))
  const serialToProduct = new Map((await prisma.product.findMany({ where: { serial: { not: null } }, select: { id: true, serial: true } })).map((p) => [p.serial!, p.id]))

  let w = 0
  for (const [ma, grp] of groups) {
    const head = grp[0]
    const phone = clean(get(head, "Số Điện Thoại"))
    const orderData = {
      maDonHang: ma,
      ngayXuat: parseVNDate(get(head, "Ngày Xuất")),
      customerId: (phone && phoneToCustomer.get(phone)) || null,
      tenKhachHang: clean(get(head, "Tên Khách Hàng")),
      soDienThoai: phone,
      tongThu: parseMoney(get(head, "Tổng Thu")),
      loaiDon: clean(get(head, "Loại Đơn")),
      hinhThucVanChuyen: clean(get(head, "Hình Thức Vận Chuyển")),
      trangThai: clean(get(head, "Trạng Thái")),
      diaChiNhan: clean(get(head, "Địa Chỉ Nhận")),
      nguoiBanCode: clean(get(head, "Người Bán")),
      ghiChu: clean(get(head, "Ghi chú")),
    }
    const order = await prisma.order.upsert({ where: { maDonHang: ma }, update: orderData, create: orderData })
    // tái tạo items + payments (idempotent)
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } })
    await prisma.orderPayment.deleteMany({ where: { orderId: order.id } })
    for (const r of grp) {
      const imei = clean(get(r, "IMEI"))
      const serial = clean(get(r, "Serial"))
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: (imei && imeiToProduct.get(imei)) || (serial && serialToProduct.get(serial)) || null,
          tenSanPham: clean(get(r, "Tên Sản Phẩm")),
          loaiMay: clean(get(r, "Loại Máy")),
          dungLuong: clean(get(r, "Dung Lượng")),
          pinRaw: clean(get(r, "Pin (%)")),
          mauSac: clean(get(r, "Màu Sắc")),
          imei, serial,
          tinhTrangMay: clean(get(r, "Tình Trạng Máy")),
          dangSim: clean(get(r, "Dạng Sim")),
          phuKien: clean(get(r, "Phụ Kiện")),
          phiBaoHanh: parseMoney(get(r, "Phí BH")),
          goiBaoHanh: clean(get(r, "Gói BH")),
          giaBan: parseMoney(get(r, "Giá Bán")),
          giaNhap: parseMoney(get(r, "Giá Nhập")),
          lai: parseMoney(get(r, "Lãi")),
        },
      })
    }
    const payments = parsePayments(String(get(head, "Hình Thức Thanh Toán")), orderData.tongThu)
    if (payments.length) await prisma.orderPayment.createMany({ data: payments.map((p) => ({ orderId: order.id, method: p.method, amount: p.amount })) })
    w++
  }
  addStat({ sheet: "Ban_Hang -> orders", read: groups.size, written: w, skipped: noId })
}

/* --------------------- 6) WARRANTY CONTRACTS ----------------------- */
async function migrateWarrantyContracts() {
  const { rows, get } = await load("HOP_DONG_BAO_HANH")
  const orderMa = new Set((await prisma.order.findMany({ select: { maDonHang: true } })).map((o) => o.maDonHang))
  const pkgMa = new Set((await prisma.warrantyPackage.findMany({ select: { maGoi: true } })).map((p) => p.maGoi))
  let w = 0, sk = 0
  for (const r of rows) {
    const maHd = clean(get(r, "Mã HĐ"))
    if (!maHd) { sk++; continue }
    let maDon = clean(get(r, "Mã Đơn"))
    if (maDon && !orderMa.has(maDon)) { logIssue(`HĐ ${maHd}: Mã Đơn ${maDon} không tồn tại -> null`); maDon = null }
    let maGoi = clean(get(r, "Mã Gói"))
    if (maGoi && !pkgMa.has(maGoi)) { logIssue(`HĐ ${maHd}: Mã Gói ${maGoi} không tồn tại -> null`); maGoi = null }
    const data = {
      maHd, maDon, maGoi,
      imei: clean(get(r, "IMEI")),
      serial: clean(get(r, "Serial")),
      sdtKhach: clean(get(r, "SĐT Khách")),
      ngayMua: parseVNDate(get(r, "Ngày Mua")),
      ngayBatDau: parseVNDate(get(r, "Ngày Bắt Đầu")),
      han11: parseVNDate(get(r, "Hạn 1 Đổi 1")),
      hanPhanCung: parseVNDate(get(r, "Hạn Phần Cứng")),
      hanCncDoSim: parseVNDate(get(r, "Hạn CNC/Độ Sim")),
      hanTong: parseVNDate(get(r, "Hạn Tổng")),
      hoTroTronDoi: parseBool(get(r, "Hỗ Trợ Trọn Đời")),
      trangThai: clean(get(r, "Trạng Thái")),
      nhanVien: clean(get(r, "Nhân Viên")),
      thongTinLoiIch: clean(get(r, "Thông Tin Lợi Ích")),
      ghiChu: clean(get(r, "Ghi Chú")),
    }
    await prisma.warrantyContract.upsert({ where: { maHd }, update: data, create: data })
    w++
  }
  addStat({ sheet: "HOP_DONG_BAO_HANH -> warranty_contracts", read: rows.length, written: w, skipped: sk })
}

/* ------------------------- 7) CNC + REPAIR ------------------------- */
async function migrateCnc() {
  const { rows, get } = await load("CNC")
  let w = 0
  // idempotent: xoá sạch rồi nạp lại (không có khóa tự nhiên)
  await prisma.cncJob.deleteMany({})
  for (const r of rows) {
    await prisma.cncJob.create({
      data: {
        tenSanPham: clean(get(r, "Tên Sản Phẩm")),
        mauSac: clean(get(r, "Màu Sắc")),
        imei: clean(get(r, "IMEI")),
        nguon: clean(get(r, "Nguồn")),
        tinhTrang: clean(get(r, "Tình trạng")),
        dangSim: clean(get(r, "Dạng Sim")),
        loaiMay: clean(get(r, "Loại Máy")),
        trangThai: clean(get(r, "Trạng Thái")),
        diaChiCnc: clean(get(r, "Địa chỉ CNC")),
        ngayGui: parseVNDate(get(r, "Ngày gửi")),
        ngayNhanLai: parseVNDate(get(r, "Ngày nhận lại")),
        tenKhachHang: clean(get(r, "Tên khách hàng")),
        soDienThoai: clean(get(r, "Số điện thoại")),
      },
    })
    w++
  }
  addStat({ sheet: "CNC -> cnc_jobs", read: rows.length, written: w, skipped: 0 })
}
async function migrateRepairs() {
  const { rows, get } = await load("Bao_Hanh")
  let w = 0
  await prisma.warrantyRepair.deleteMany({})
  for (const r of rows) {
    await prisma.warrantyRepair.create({
      data: {
        tenSanPham: clean(get(r, "Tên Sản Phẩm")),
        mauSac: clean(get(r, "Màu Sắc")),
        loaiMay: clean(get(r, "Loại Máy")),
        imei: clean(get(r, "IMEI")),
        nguon: clean(get(r, "Nguồn")),
        tinhTrang: clean(get(r, "Tình trạng")),
        loi: clean(get(r, "Lỗi")),
        trangThai: clean(get(r, "Trạng Thái")),
        diaChiBaoHanh: clean(get(r, "Địa chỉ Bảo hành")),
        ngayGui: parseVNDate(get(r, "Ngày gửi")),
        ngayNhanLai: parseVNDate(get(r, "Ngày nhận lại")),
        tenKhachHang: clean(get(r, "Tên khách hàng")),
        soDienThoai: clean(get(r, "Số điện thoại")),
      },
    })
    w++
  }
  addStat({ sheet: "Bao_Hanh -> warranty_repairs", read: rows.length, written: w, skipped: 0 })
}

/* --------------------------- 8) ACCESSORIES ------------------------ */
async function migrateAccessories() {
  const { rows, get } = await load("Phu_Kien")
  let w = 0, sk = 0
  for (const r of rows) {
    const maPk = clean(get(r, "ID"))
    if (!maPk) { sk++; continue }
    const data = {
      maPk,
      tenSanPham: clean(get(r, "Tên Sản Phẩm")),
      loai: clean(get(r, "Loại")),
      soLuong: parseIntSafe(get(r, "Số Lượng")),
      giaNhap: parseMoney(get(r, "Giá Nhập")),
      giaBan: parseMoney(get(r, "Giá Bán")),
      ghiChu: clean(get(r, "Ghi Chú")),
      capNhatCuoi: parseVNDate(get(r, "Cập nhật lần cuối")),
    }
    await prisma.accessory.upsert({ where: { maPk }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Phu_Kien -> accessories", read: rows.length, written: w, skipped: sk })
}

/* ----------------------------- 9) DEPOSITS ------------------------- */
async function migrateDeposits() {
  const { rows, get } = await load("Dat_Coc")
  const phoneToCustomer = new Map((await prisma.customer.findMany({ select: { id: true, soDienThoai: true } })).map((c) => [c.soDienThoai, c.id]))
  let w = 0, sk = 0
  const seen = new Set<string>()
  for (const r of rows) {
    let ma = clean(get(r, "ID Đơn Hàng"))
    if (!ma) { sk++; continue }
    if (seen.has(ma)) { logIssue(`Dat_Coc mã trùng (thêm hậu tố): ${ma}`); ma = `${ma}-dup${seen.size}` }
    seen.add(ma)
    const phone = clean(get(r, "Số Điện Thoại"))
    const data = {
      maDonHang: ma,
      ngayDatCoc: parseVNDate(get(r, "Ngày Đặt Cọc")),
      customerId: (phone && phoneToCustomer.get(phone)) || null,
      tenKhachHang: clean(get(r, "Tên Khách Hàng")),
      soDienThoai: phone,
      tenSanPham: clean(get(r, "Tên Sản Phẩm")),
      loaiMay: clean(get(r, "Loại Máy")),
      dungLuong: clean(get(r, "Dung Lượng")),
      pinRaw: clean(get(r, "Pin (%)")),
      mauSac: clean(get(r, "Màu Sắc")),
      imei: clean(get(r, "IMEI")),
      serial: clean(get(r, "Serial")),
      tinhTrangMay: clean(get(r, "Tình Trạng Máy")),
      phuKien: clean(get(r, "Phụ Kiện")),
      giaBan: parseMoney(get(r, "Giá Bán")),
      giaNhap: parseMoney(get(r, "Giá Nhập")),
      soTienCoc: parseMoney(get(r, "Số Tiền Cọc")),
      soTienConLai: parseMoney(get(r, "Số Tiền Còn Lại")),
      hanThanhToan: parseVNDate(get(r, "Hạn Thanh Toán")),
      hinhThucThanhToan: clean(get(r, "Hình Thức Thanh Toán")),
      nguoiBanCode: clean(get(r, "Người Bán")),
      loaiDon: clean(get(r, "Loại Đơn")),
      trangThaiMay: clean(get(r, "Trạng Thái Máy")),
      trangThai: clean(get(r, "Trạng Thái")),
    }
    await prisma.deposit.upsert({ where: { maDonHang: ma }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Dat_Coc -> deposits", read: rows.length, written: w, skipped: sk })
}

/* ----------------------------- 10) RETURNS ------------------------- */
async function migrateReturns() {
  const { rows, get } = await load("Hoan_Tra")
  const orderByMa = new Map((await prisma.order.findMany({ select: { id: true, maDonHang: true } })).map((o) => [o.maDonHang, o.id]))
  let w = 0, sk = 0
  for (const r of rows) {
    const maHoanTra = clean(get(r, "ID"))
    if (!maHoanTra) { sk++; continue }
    const ghiChu = String(get(r, "Ghi Chú") ?? "")
    const m = ghiChu.match(/Mã đơn:\s*(DH\w+)/i)
    const orderId = m ? orderByMa.get(m[1]) ?? null : null
    const data = {
      maHoanTra,
      ngayYeuCau: parseVNDate(get(r, "Ngày Yêu Cầu")),
      khachHang: clean(get(r, "Khách Hàng")),
      soDienThoai: clean(get(r, "Số Điện Thoại")),
      sanPham: clean(get(r, "Sản Phẩm")),
      imei: clean(get(r, "IMEI")),
      serial: clean(get(r, "Serial")),
      lyDo: clean(get(r, "Lý Do")),
      trangThai: clean(get(r, "Trạng Thái")),
      nguoiXuLy: clean(get(r, "Người Xử Lý")),
      ngayXuLy: parseVNDate(get(r, "Ngày Xử Lý")),
      ghiChu: clean(ghiChu),
      orderId,
    }
    await prisma.return.upsert({ where: { maHoanTra }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Hoan_Tra -> returns", read: rows.length, written: w, skipped: sk })
}

/* --------------------------- 11) NOTIFICATIONS --------------------- */
async function migrateNotifications() {
  const { rows, get } = await load("Thong_Bao")
  let w = 0, sk = 0
  for (const r of rows) {
    const id = clean(get(r, "ID"))
    if (!id) { sk++; continue }
    const data = {
      id,
      tieuDe: clean(get(r, "Tiêu Đề")),
      noiDung: clean(get(r, "Nội Dung")),
      loai: clean(get(r, "Loại")),
      trangThai: clean(get(r, "Trạng Thái")),
      nguoiGuiId: clean(get(r, "Người Gửi ID")),
      nguoiNhanId: clean(get(r, "Người Nhận ID")),
      createdAt: parseVNDate(get(r, "Created At")) ?? new Date(),
      updatedAt: parseVNDate(get(r, "Updated At")) ?? new Date(),
    }
    await prisma.notification.upsert({ where: { id }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Thong_Bao -> notifications", read: rows.length, written: w, skipped: sk })
}

/* ------------------------ 12) PRODUCT HISTORY ---------------------- */
async function migrateProductHistory() {
  const { rows, get } = await load("Lich_Su_Trang_Thai_May")
  let w = 0
  for (const r of rows) {
    const idMayLast5 = clean(get(r, "ID máy"))
    const thoiGian = parseVNDate(get(r, "Thời gian thay đổi"))
    const trangThaiMoi = clean(get(r, "Trạng thái mới"))
    const nguoiThayDoi = clean(get(r, "Người thay đổi"))
    const id = sha(idMayLast5, thoiGian?.toISOString(), get(r, "Trạng thái cũ"), trangThaiMoi, nguoiThayDoi)
    const data = {
      id, idMayLast5,
      tenSanPham: clean(get(r, "Tên sản phẩm")),
      trangThaiCu: clean(get(r, "Trạng thái cũ")),
      trangThaiMoi, thoiGian, nguoiThayDoi,
    }
    await prisma.productHistory.upsert({ where: { id }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Lich_Su_Trang_Thai_May -> product_history", read: rows.length, written: w, skipped: 0 })
}

/* ----------------------------- 13) CASH ---------------------------- */
async function migrateCash() {
  const { rows, get } = await load("Tien_mat")
  let w = 0, sk = 0
  for (const r of rows) {
    const id = clean(get(r, "ID"))
    if (!id) { sk++; continue }
    const data = {
      id,
      loai: clean(get(r, "Loại")) ?? "thu",
      soTien: parseMoney(get(r, "Số Tiền")),
      soDuSau: parseMoney(get(r, "Số Dư Sau")),
      nguon: clean(get(r, "Nguồn")),
      maThamChieu: clean(get(r, "Mã Tham Chiếu")),
      lyDo: clean(get(r, "Lý Do")),
      nhanVien: clean(get(r, "Nhân Viên")),
      ghiChu: clean(get(r, "Ghi Chú")),
      createdAt: parseVNDate(get(r, "Created At")) ?? new Date(),
    }
    await prisma.cashEntry.upsert({ where: { id }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Tien_mat -> cash_entries", read: rows.length, written: w, skipped: sk })
}

/* ------------------------ 14) CHECK-IN / OUT ----------------------- */
async function migrateCheckIns() {
  const { rows, get } = await load("Check_in")
  let w = 0, sk = 0
  for (const r of rows) {
    const id = clean(get(r, "ID"))
    if (!id) { sk++; continue }
    const data = {
      id,
      thoiGian: parseVNDate(get(r, "Thời Gian")),
      nhanVien: clean(get(r, "Nhân Viên")),
      ca: clean(get(r, "Ca")),
      trangThai: clean(get(r, "Trạng Thái")),
      lyDo: clean(get(r, "Lý Do")),
      knWebsite: parseIntSafe(get(r, "KN Website")), knThucTe: parseIntSafe(get(r, "KN Thực Tế")),
      kn17: parseIntSafe(get(r, "KN 17")), kn16: parseIntSafe(get(r, "KN 16")), kn15: parseIntSafe(get(r, "KN 15")),
      knIpad: parseIntSafe(get(r, "KN Ipad")), knKhac: parseIntSafe(get(r, "KN Khác")),
      ktWebsite: parseIntSafe(get(r, "KT Website")), ktThucTe: parseIntSafe(get(r, "KT Thực Tế")),
      kt17: parseIntSafe(get(r, "KT 17")), kt16: parseIntSafe(get(r, "KT 16")), kt15: parseIntSafe(get(r, "KT 15")),
      ktIpad: parseIntSafe(get(r, "KT Ipad")), ktKhac: parseIntSafe(get(r, "KT Khác")),
      tongWeb: parseIntSafe(get(r, "Tổng Web")), tongThucTe: parseIntSafe(get(r, "Tổng Thực Tế")),
      soAnh: parseIntSafe(get(r, "Số Ảnh")),
    }
    await prisma.checkIn.upsert({ where: { id }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Check_in -> check_ins", read: rows.length, written: w, skipped: sk })
}
async function migrateCheckOuts() {
  const { rows, get } = await load("Check_out")
  let w = 0, sk = 0
  for (const r of rows) {
    const id = clean(get(r, "ID"))
    if (!id) { sk++; continue }
    const data = {
      id,
      ca: clean(get(r, "Ca")),
      createdAt: parseVNDate(get(r, "Created At")) ?? new Date(),
      nhanVien: clean(get(r, "Nhân Viên")),
      trangThai: clean(get(r, "Trạng Thái")),
      lyDo: clean(get(r, "Lý Do")),
      soAnh: parseIntSafe(get(r, "Số Ảnh")),
      ngoaiWebsite: parseIntSafe(get(r, "Ngoài Website")), ngoaiThucTe: parseIntSafe(get(r, "Ngoài Thực Tế")),
      ngoai17: parseIntSafe(get(r, "Ngoài 17")), ngoai16: parseIntSafe(get(r, "Ngoài 16")), ngoai15: parseIntSafe(get(r, "Ngoài 15")),
      ngoaiIpad: parseIntSafe(get(r, "Ngoài Ipad")), ngoaiKhac: parseIntSafe(get(r, "Ngoài Khác")),
      trongWebsite: parseIntSafe(get(r, "Trong Website")), trongThucTe: parseIntSafe(get(r, "Trong Thực Tế")),
      trong17: parseIntSafe(get(r, "Trong 17")), trong16: parseIntSafe(get(r, "Trong 16")), trong15: parseIntSafe(get(r, "Trong 15")),
      trongIpad: parseIntSafe(get(r, "Trong Ipad")), trongKhac: parseIntSafe(get(r, "Trong Khác")),
      banRa: parseIntSafe(get(r, "Bán Ra")), banRaOff: parseIntSafe(get(r, "Bán Ra Off")), banRaOnl: parseIntSafe(get(r, "Bán Ra Onl")),
      thuVao: parseMoney(get(r, "Thu Vào")), tienMatBanGiao: parseMoney(get(r, "Tiền Mặt Bàn Giao")),
      ghiChuCaSau: clean(get(r, "Ghi Chú Ca Sau")),
    }
    await prisma.checkOut.upsert({ where: { id }, update: data, create: data })
    w++
  }
  addStat({ sheet: "Check_out -> check_outs", read: rows.length, written: w, skipped: sk })
}

/* ------------------------------- main ------------------------------ */
async function main() {
  console.log("⏳ Bắt đầu migrate Google Sheets -> Postgres\n")
  const steps: [string, () => Promise<void>][] = [
    ["users", migrateUsers],
    ["customers", migrateCustomers],
    ["products", migrateProducts],
    ["partner_products", migratePartnerProducts],
    ["warranty_packages", migrateWarrantyPackages],
    ["orders", migrateOrders],
    ["warranty_contracts", migrateWarrantyContracts],
    ["cnc", migrateCnc],
    ["repairs", migrateRepairs],
    ["accessories", migrateAccessories],
    ["deposits", migrateDeposits],
    ["returns", migrateReturns],
    ["notifications", migrateNotifications],
    ["product_history", migrateProductHistory],
    ["cash", migrateCash],
    ["check_in", migrateCheckIns],
    ["check_out", migrateCheckOuts],
  ]
  for (const [name, fn] of steps) {
    process.stdout.write(`→ ${name} ... `)
    try { await fn(); console.log("xong") }
    catch (e: any) { console.log("LỖI"); console.error(e?.message || e) }
  }

  console.log("\n================== BẢNG ĐỐI CHIẾU ==================")
  console.log("Sheet -> bảng".padEnd(48), "Đọc".padStart(7), "Ghi".padStart(7), "Bỏ".padStart(6))
  for (const s of stats) {
    console.log(s.sheet.padEnd(48), String(s.read).padStart(7), String(s.written).padStart(7), String(s.skipped).padStart(6))
  }
  if (issues.length) {
    writeFileSync("scripts/migrate-issues.log", issues.join("\n"), "utf8")
    console.log(`\n⚠ ${issues.length} cảnh báo -> scripts/migrate-issues.log`)
  }
  await prisma.$disconnect()
  console.log("\n✅ Hoàn tất.")
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
