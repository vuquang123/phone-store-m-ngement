import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues } from "@/lib/google-sheets"
import { getDeviceId, last5FromDeviceId } from "@/lib/device-id"
import { sendStockEventNotification } from "@/lib/telegram"

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

const normalizeKey = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

function buildBodyNormMap(body: Record<string, any> = {}) {
  const bodyNormMap: Record<string, any> = {}
  Object.keys(body || {}).forEach((k) => {
    bodyNormMap[normalizeKey(k)] = body[k]
  })
  return bodyNormMap
}

function getValForHeader(
  k: string,
  body: Record<string, any>,
  bodyNormMap: Record<string, any>,
  opts: { idMay: string; imeiStr: string; serialStr: string; defaultNgayNhap: string }
) {
  const nk = normalizeKey(k)
  if (k === "ID Máy") return opts.idMay
  if (k === "IMEI") return opts.imeiStr
  if (k === "Serial") return opts.serialStr
  if (k === "Trạng Thái") return body.trang_thai || bodyNormMap["trangthai"] || "Còn hàng"
  if (k === "Trạng Thái Kho") return body.trang_thai_kho || bodyNormMap["trangthaikho"] || "Có sẵn"
  if (k === "Ngày Nhập") {
    const input = body.ngay_nhap || bodyNormMap["ngaynhap"]
    if (input) {
      const t = Date.parse(String(input))
      if (!Number.isNaN(t)) return new Date(t).toLocaleDateString("vi-VN")
    }
    return opts.defaultNgayNhap
  }
  if (k === "Loại Máy") {
    return body.loai_phu_kien || body.loai_may || bodyNormMap["loaiphukien"] || bodyNormMap["loaimay"] || ""
  }
  if (k === "Tên Sản Phẩm") {
    return body.ten_san_pham || bodyNormMap["tensanpham"] || ""
  }
  if (k === "Dung Lượng") {
    return body.dung_luong || bodyNormMap["dungluong"] || ""
  }
  if (k === "Màu Sắc") {
    return body.mau_sac || bodyNormMap["mausac"] || ""
  }
  if (k === "Pin (%)") {
    return body.pin || bodyNormMap["pin"] || ""
  }
  if (k === "Tình Trạng Máy") {
    return body.tinh_trang || bodyNormMap["tinhtrang"] || ""
  }
  if (k === "Giá Nhập") {
    const v = body.gia_nhap ?? bodyNormMap["gianhap"]
    return v !== undefined && v !== null && String(v) !== "" ? toNumber(v) : ""
  }
  if (k === "Giá Bán") {
    const v = body.gia_ban ?? bodyNormMap["giaban"]
    return v !== undefined && v !== null && String(v) !== "" ? toNumber(v) : ""
  }
  if (k === "Ghi Chú") {
    return body.ghi_chu || bodyNormMap["ghichu"] || ""
  }
  return (
    body[k] ??
    body[k.replace(/\s/g, "_").toLowerCase()] ??
    body[k.replace(/\s/g, "").toLowerCase()] ??
    bodyNormMap[nk] ??
    ""
  )
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
    serial: colIndex(header, "Serial"),
    tinhTrang: colIndex(header, "Tình Trạng Máy"),
    giaNhap: colIndex(header, "Giá Nhập"),
    giaBan: colIndex(header, "Giá Bán"),
    ghiChu: colIndex(header, "Ghi Chú"),
    trangThai: colIndex(header, "Trạng Thái"),
    trangThaiKho: colIndex(header, "Trạng Thái Kho", "Trạng thái kho", "Tình Trạng Tồn", "Kho Hiển Thị"),
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
      serial: idx.serial !== -1 ? row[idx.serial] : undefined,
      tinh_trang: row[idx.tinhTrang],
      gia_nhap: toNumber(row[idx.giaNhap]),
      gia_ban: toNumber(row[idx.giaBan]),
      trang_thai: row[idx.trangThai],
      trang_thai_kho: idx.trangThaiKho !== -1 ? row[idx.trangThaiKho] : (row[idx.trangThai] === "Còn hàng" ? "Có sẵn" : ""),
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
    const sendImportMessage = async (count: number, items: any[]) => {
      if (!count || !Array.isArray(items) || !items.length) return
      try {
        const devices = items.map((p: any) => ({
          name: p.ten_san_pham || p["Tên Sản Phẩm"],
          imei: p.imei || p["IMEI"],
          serial: p.serial || p["Serial"],
        }))
        await sendStockEventNotification({
          type: "import",
          total: count,
          devices,
          employee: body.employeeId,
        })
      } catch (e) {
        console.warn("[TG] import message fail:", e)
      }
    }
    if (body.products && Array.isArray(body.products)) {
      // Thêm nhiều sản phẩm dựa trên tiêu đề dòng 1
      const startRow = rows.length + 2 // +1 vì header, +1 vì 1-indexed
      let added = 0
      const now = new Date()
      const ngayNhap = now.toLocaleDateString("vi-VN")
      for (const [offset, p] of body.products.entries()) {
        const bodyNormMap = buildBodyNormMap(p)
        const imeiStr = String(p.imei || p["IMEI"] || "").trim()
        const serialStr = String(p.serial || p["Serial"] || "").trim().toUpperCase()
        const deviceId = getDeviceId({ IMEI: imeiStr, Serial: serialStr })
        const idMay = deviceId ? last5FromDeviceId(deviceId) : Math.floor(10000 + Math.random() * 90000).toString()
        const newRow = header.map((k) =>
          getValForHeader(k, p, bodyNormMap, {
            idMay,
            imeiStr,
            serialStr,
            defaultNgayNhap: ngayNhap,
          })
        )
        const targetRow = startRow + offset
        const range = `${SHEET}!A${targetRow}`
        const result = await updateRangeValues(range, [newRow])
        if (result.success) added++
      }
      if (added > 0) {
        await sendImportMessage(added, body.products)
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
        return NextResponse.json({ error: "Lỗi ghi Google Sheets" }, { status: 500 })
      }
      // Trả về dữ liệu mới để frontend có thể cập nhật lại
      return NextResponse.json({ ok: true, updated: true, id_may: body.id, newRow }, { status: 200 })
    } else {
      // Tạo mới 1 sản phẩm (mapping linh hoạt giữa key FE và tiêu đề cột VN)
      const bodyNormMap = buildBodyNormMap(body)

      const imeiVal = body.imei || bodyNormMap["imei"] || ""
      const serialVal = body.serial || bodyNormMap["serial"] || ""
      const imeiStr = String(imeiVal).trim()
      const serialStr = String(serialVal).trim().toUpperCase()
      const deviceId = getDeviceId({ IMEI: imeiStr, Serial: serialStr })
      const idMay = deviceId ? last5FromDeviceId(deviceId) : Math.floor(10000 + Math.random() * 90000).toString()

      const newRow = header.map((k) =>
        getValForHeader(k, body, bodyNormMap, {
          idMay,
          imeiStr,
          serialStr,
          defaultNgayNhap: new Date().toLocaleDateString("vi-VN"),
        })
      )
      const targetRow = rows.length + 2 // header + 1-indexed
      const range = `${SHEET}!A${targetRow}`
      const result = await updateRangeValues(range, [newRow])
      if (!result.success) {
        return NextResponse.json({ error: "Lỗi ghi Google Sheets" }, { status: 500 })
      }
      await sendImportMessage(1, [body])
      return NextResponse.json({ ok: true, created: true, id_may: idMay }, { status: 201 })
    }
  } catch (err) {
    console.error("Kho_Hang POST error:", err)
    return NextResponse.json({ error: "Internal server error", raw: String(err) }, { status: 500 })
  }
}
