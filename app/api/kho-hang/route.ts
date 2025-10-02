import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, appendToGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEET = "Kho_Hang"

/* ========== helpers ========== */
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()


function parseVNDate(str: string) {
  // Ví dụ: "27/8/2025" hoặc "27/8"
  if (!str) return null
  const parts = str.split("/")
  if (parts.length < 2) return null
  const day = parts[0].padStart(2, "0")
  const month = parts[1].padStart(2, "0")
  const year = parts[2] ? parts[2] : new Date().getFullYear()
  // Trả về định dạng chuẩn cho JS
  return `${year}-${month}-${day}`
}   

function colIndex(header: string[], ...names: string[]) {
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "")
// Chuyển đổi giá trị tiền tệ về số nguyên
function toNumber(v: any) {
  if (v === null || v === undefined) return 0
  const s = String(v)
    .replace(/\./g, "") // bỏ dấu chấm
    .replace(/đ/g, "") // bỏ ký tự đ
    .replace(/,/g, "") // bỏ dấu phẩy nếu có
    .replace(/\s+/g, "") // bỏ khoảng trắng
    .replace(/[^\d]/g, "") // giữ lại số
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseToEpoch(v: any): number {
  if (!v) return 0
  const str = String(v)
  const t = Date.parse(str)
  if (!Number.isNaN(t)) return t
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const [_, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m
    return new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss).getTime()
  }
  return 0
}

function idxKho(header: string[]) {
  return {
    id: colIndex(header, "ID Máy"),
    ngayNhap: colIndex(header, "Ngày Nhập"),
    tenSP: colIndex(header, "Tên Sản Phẩm"),
    loaiMay: colIndex(header, "Loại Máy"),
    dungLuong: colIndex(header, "Dung Lượng"),
    pin: colIndex(header, "Pin (%)"),
    mauSac: colIndex(header, "Màu Sắc"),
    imei: colIndex(header, "IMEI"),
    tinhTrang: colIndex(header, "Tình Trạng Máy"),
    giaNhap: colIndex(header, "Giá Nhập"),
    giaBan: colIndex(header, "Giá Bán"),
    ghiChu: colIndex(header, "Ghi Chú"),
    trangThai: colIndex(header, "Trạng Thái"),
  }
}

/* ========== GET: list + filters + pagination ========== */
export async function GET(request: NextRequest) {
  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    const idx = idxKho(header)
    const products = rows.map((row) => ({
      id: row[idx.id],
      ten_san_pham: row[idx.tenSP],
      loai_may: row[idx.loaiMay],
      dung_luong: row[idx.dungLuong],
      mau_sac: row[idx.mauSac],
      pin: row[idx.pin],
      imei: row[idx.imei],
      tinh_trang: row[idx.tinhTrang],
      gia_nhap: toNumber(row[idx.giaNhap]),
      gia_ban: toNumber(row[idx.giaBan]),
      trang_thai: row[idx.trangThai],
      ghi_chu: row[idx.ghiChu],
      ngay_nhap: row[idx.ngayNhap],
    }))
    return NextResponse.json({ data: products })
  } catch (error) {
    console.error("Kho_Hang GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ========== POST: create new item (check IMEI) ========== */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { header, rows } = await readFromGoogleSheets(SHEET)
    if (body.products && Array.isArray(body.products)) {
      // Thêm nhiều sản phẩm
      const { header } = await readFromGoogleSheets(SHEET)
      let added = 0
      const now = new Date()
      const ngayNhap = now.toLocaleDateString("vi-VN")
      for (const p of body.products) {
        let idMay = ""
        let imeiStr = ""
        if (p.imei) {
          imeiStr = String(p.imei)
          idMay = imeiStr.slice(-5)
        } else if (p["IMEI"]) {
          imeiStr = String(p["IMEI"])
          idMay = imeiStr.slice(-5)
        } else {
          // Nếu không có IMEI, sinh ngẫu nhiên
          idMay = Math.floor(10000 + Math.random() * 90000).toString()
        }
        const newRow = header.map((k) => {
          if (k === "ID Máy") return idMay
          if (k === "Ngày Nhập") return ngayNhap
          if (k === "Trạng Thái") return "Còn hàng"
          return p[k] || p[k.replace(/\s/g, "_").toLowerCase()] || p[k.replace(/\s/g, "").toLowerCase()] || ""
        })
        const result = await import("@/lib/google-sheets").then(mod => mod.appendToGoogleSheets(SHEET, newRow))
        if (result.success) added++
      }
      return NextResponse.json({ ok: true, added }, { status: 200 })
    } else if (body.action === "update" && body.id) {
      // Tìm index cột ID Máy
      const idxId = header.indexOf("ID Máy")
      if (idxId === -1) {
        return NextResponse.json({ error: "Không tìm thấy cột ID Máy" }, { status: 400 })
      }
      // Tìm dòng cũ theo id
      const rowIndex = rows.findIndex(row => row[idxId] === body.id)
      if (rowIndex === -1) {
        return NextResponse.json({ error: "Không tìm thấy sản phẩm cần cập nhật" }, { status: 404 })
      }
      const oldRow = rows[rowIndex]
      // Map dữ liệu mới: nếu trường không có trong body thì lấy giá trị cũ
      const newRow = header.map((k, i) => {
        if (body[k] !== undefined && body[k] !== null && body[k] !== "") {
          return body[k]
        }
        return oldRow[i] || ""
      })
      // Ghi đè dòng có id trùng
      const result = await import("@/lib/google-sheets").then(mod => mod.updateRowInGoogleSheets(SHEET, "ID Máy", body.id, newRow))
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Lỗi ghi Google Sheets" }, { status: 500 })
      }
      // Trả về dữ liệu mới để frontend có thể cập nhật lại
      return NextResponse.json({ ok: true, updated: true, id_may: body.id, newRow }, { status: 200 })
    } else {
      // Tạo mới sản phẩm (1 sản phẩm)
      let idMay = ""
      if (body.imei) {
        const imeiStr = String(body.imei)
        idMay = imeiStr.slice(-5)
      }
      const { header } = await readFromGoogleSheets(SHEET)
      const newRow = header.map((k) => {
        if (k === "ID Máy") return idMay
        return body[k] || ""
      })
      const result = await import("@/lib/google-sheets").then(mod => mod.appendToGoogleSheets(SHEET, newRow))
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Lỗi ghi Google Sheets" }, { status: 500 })
      }
      return NextResponse.json({ ok: true, created: true, id_may: idMay }, { status: 201 })
    }
  } catch (err) {
    console.error("Kho_Hang POST error:", err)
    return NextResponse.json({ error: "Internal server error", raw: String(err) }, { status: 500 })
  }
}
