import { type NextRequest, NextResponse } from "next/server"
import {
  readFromGoogleSheets,
  appendMultipleToGoogleSheets,
  syncToGoogleSheets,
  updateRangeValues,
  colIndex,
} from "@/lib/google-sheets"
import { getDeviceId, last5FromDeviceId } from "@/lib/device-id"

export const dynamic = "force-dynamic"

// Sheet chứa máy của các kho đối tác (không có sẵn ở cửa hàng).
// Cột: ID Máy | Ngày Nhập | Nguồn Hàng | Tên Sản Phẩm | Loại Máy | Dung Lượng
//      | Pin (%) | Màu Sắc | IMEI | Tình Trạng Máy | Giá Nhập | Giá Bán | Ghi Chú
const SHEET = "Hang_doi_tac"
const KHO_SHEET = "Kho_Hang"

function toNumber(v: any) {
  if (v === null || v === undefined) return 0
  const n = Number(String(v).replace(/[^\d]/g, ""))
  return Number.isFinite(n) ? n : 0
}

const normalizeKey = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

// Kiểm tra quyền quản lý dựa trên header x-user-email (giống /api/auth/me)
async function isManager(request: NextRequest): Promise<boolean> {
  const email = request.headers.get("x-user-email")
  if (!email) return false
  try {
    const { header, rows } = await readFromGoogleSheets("USERS")
    const normHeader = header.map((h) => normalizeKey(String(h)))
    const findCol = (candidates: string[]) => {
      for (const c of candidates) {
        const idx = normHeader.findIndex((h) => h === normalizeKey(c))
        if (idx !== -1) return idx
      }
      return -1
    }
    const idxEmail = findCol(["Email", "E-mail"])
    const idxRole = findCol(["Vai Trò", "Vai Tro", "Role", "Quyen"])
    if (idxEmail === -1 || idxRole === -1) return false
    const userRow = rows.find(
      (r) => String(r[idxEmail] || "").trim().toLowerCase() === String(email).trim().toLowerCase()
    )
    if (!userRow) return false
    return String(userRow[idxRole] || "").trim().toLowerCase() === "quan_ly"
  } catch {
    return false
  }
}

function idxPartner(header: string[]) {
  return {
    id: colIndex(header, "ID Máy"),
    ngayNhap: colIndex(header, "Ngày Nhập"),
    nguonHang: colIndex(header, "Nguồn Hàng", "Nguồn"),
    tenSP: colIndex(header, "Tên Sản Phẩm"),
    loaiMay: colIndex(header, "Loại Máy"),
    dungLuong: colIndex(header, "Dung Lượng"),
    pin: colIndex(header, "Pin (%)"),
    mauSac: colIndex(header, "Màu Sắc"),
    imei: colIndex(header, "IMEI"),
    tinhTrang: colIndex(header, "Tình Trạng Máy", "Tình trạng"),
    giaNhap: colIndex(header, "Giá Nhập"),
    giaBan: colIndex(header, "Giá Bán"),
    ghiChu: colIndex(header, "Ghi Chú"),
  }
}

// So khớp id với 1 dòng: theo ID Máy, IMEI hoặc 5 số cuối IMEI
function rowMatchesIds(row: string[], idx: ReturnType<typeof idxPartner>, normIds: string[]) {
  const imei = String(row[idx.imei] || "").trim().toLowerCase()
  const idMay = String(row[idx.id] || "").trim().toLowerCase()
  const imeiLast5 = imei.length >= 5 ? imei.slice(-5) : ""
  return normIds.some(
    (pid) => (imei && pid === imei) || (idMay && pid === idMay) || (imeiLast5 && pid === imeiLast5)
  )
}

/* ========== GET: danh sách máy đối tác ========== */
export async function GET(request: NextRequest) {
  try {
    const force = new URL(request.url).searchParams.get("refresh") === "1"
    // Giá nhập là thông tin nhạy cảm: chỉ trả về cho quản lý.
    // Nhân viên nhận gia_nhap = 0 ngay từ API (không chỉ ẩn ở UI).
    const manager = await isManager(request)
    const { header, rows } = await readFromGoogleSheets(SHEET, undefined, { force })
    const idx = idxPartner(header)
    const cell = (row: string[], i: number) => (i !== -1 ? String(row[i] || "").trim() : "")
    const products = rows
      .filter((row) => cell(row, idx.tenSP) || cell(row, idx.imei))
      .map((row) => ({
        id: cell(row, idx.id),
        ngay_nhap: cell(row, idx.ngayNhap),
        // Nguồn hàng (kho đối tác nào) cũng là thông tin nhạy cảm: chỉ quản lý thấy
        nguon_hang: manager ? cell(row, idx.nguonHang) : "",
        ten_san_pham: cell(row, idx.tenSP),
        loai_may: cell(row, idx.loaiMay),
        dung_luong: cell(row, idx.dungLuong),
        pin: cell(row, idx.pin),
        mau_sac: cell(row, idx.mauSac),
        imei: cell(row, idx.imei),
        tinh_trang: cell(row, idx.tinhTrang),
        gia_nhap: manager ? toNumber(row[idx.giaNhap]) : 0,
        gia_ban: toNumber(row[idx.giaBan]),
        ghi_chu: cell(row, idx.ghiChu),
      }))
    return NextResponse.json({ data: products })
  } catch (error) {
    console.error("Hang_doi_tac GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ========== POST: thêm máy / xóa / chuyển kho ========== */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    /* ----- Xóa máy (chỉ quản lý) ----- */
    if (body.action === "delete" && Array.isArray(body.productIds) && body.productIds.length > 0) {
      if (!(await isManager(request))) {
        return NextResponse.json({ error: "Chỉ quản lý mới được xóa máy đối tác" }, { status: 403 })
      }
      const { header, rows } = await readFromGoogleSheets(SHEET)
      const idx = idxPartner(header)
      const normIds = body.productIds.map((id: any) => String(id || "").trim().toLowerCase()).filter(Boolean)
      const newRows = rows.filter((row) => !rowMatchesIds(row, idx, normIds))
      const removed = rows.length - newRows.length
      if (removed === 0) {
        return NextResponse.json({ error: "Không tìm thấy máy cần xóa" }, { status: 404 })
      }
      const result = await syncToGoogleSheets(SHEET, newRows)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      return NextResponse.json({ ok: true, removed })
    }

    /* ----- Chuyển kho: Hang_doi_tac -> Kho_Hang ----- */
    if (body.action === "transfer" && Array.isArray(body.productIds) && body.productIds.length > 0) {
      const khoDich = body.khoDich === "Kho ngoài" ? "Kho ngoài" : "Kho trong"
      const { header, rows } = await readFromGoogleSheets(SHEET)
      const idx = idxPartner(header)
      const normIds = body.productIds.map((id: any) => String(id || "").trim().toLowerCase()).filter(Boolean)

      const toMove = rows.filter((row) => rowMatchesIds(row, idx, normIds))
      if (toMove.length === 0) {
        return NextResponse.json({ error: "Không tìm thấy máy cần chuyển" }, { status: 404 })
      }

      // Đọc Kho_Hang để map đúng thứ tự cột + chặn trùng IMEI
      const { header: khoHeader, rows: khoRows } = await readFromGoogleSheets(KHO_SHEET)
      const idxKhoImei = colIndex(khoHeader, "IMEI")
      const existingImeis = new Set(
        khoRows.map((r) => String(r[idxKhoImei] || "").trim().toLowerCase()).filter(Boolean)
      )

      const ngayNhap = new Date().toLocaleDateString("vi-VN")
      const cell = (row: string[], i: number) => (i !== -1 ? String(row[i] || "").trim() : "")
      const skipped: string[] = []
      const newKhoRows: any[][] = []

      for (const row of toMove) {
        const imei = cell(row, idx.imei)
        if (imei && existingImeis.has(imei.toLowerCase())) {
          skipped.push(imei)
          continue
        }
        const ghiChuGoc = cell(row, idx.ghiChu)
        const nguonHang = cell(row, idx.nguonHang)
        const ghiChu = nguonHang
          ? (ghiChuGoc ? `${ghiChuGoc} [Nguồn: ${nguonHang}]` : `[Nguồn: ${nguonHang}]`)
          : ghiChuGoc

        const newRow = khoHeader.map((k) => {
          if (k === "ID Máy") {
            const deviceId = getDeviceId({ IMEI: imei, Serial: "" })
            return cell(row, idx.id) || (deviceId ? last5FromDeviceId(deviceId) : "")
          }
          if (k === "Ngày Nhập") return ngayNhap
          if (k === "Trạng Thái") return "Còn hàng"
          if (k === "Trạng Thái Kho" || k === "Trạng thái kho") return khoDich
          if (k === "Ghi Chú") return ghiChu
          if (normalizeKey(k) === "dangxuly") return "No"
          // Các cột trùng tên giữa 2 sheet (Tên Sản Phẩm, Loại Máy, Dung Lượng, Pin (%),
          // Màu Sắc, IMEI, Tình Trạng Máy, Giá Nhập, Giá Bán) -> copy trực tiếp
          const idxInPartner = colIndex(header, k)
          if (idxInPartner !== -1) return row[idxInPartner] || ""
          return ""
        })
        newKhoRows.push(newRow)
      }

      if (newKhoRows.length > 0) {
        // KHÔNG dùng append: Kho_Hang có cột header trống ở giữa nên Google tự
        // "đoán" vùng bảng và ghi lệch cột (từng bị ghi bắt đầu từ cột T).
        // Ghi thẳng vào A{dòng trống kế tiếp} giống POST /api/kho-hang.
        const startRow = khoRows.length + 2 // +1 header, +1 vì 1-indexed
        try {
          await updateRangeValues(`'${KHO_SHEET}'!A${startRow}`, newKhoRows)
        } catch (e: any) {
          return NextResponse.json({ error: "Lỗi ghi Kho_Hang: " + (e?.message || e) }, { status: 500 })
        }
        // Xóa các máy đã chuyển khỏi Hang_doi_tac (chỉ những máy không bị skip)
        const skippedSet = new Set(skipped.map((s) => s.toLowerCase()))
        const remaining = rows.filter((row) => {
          if (!rowMatchesIds(row, idx, normIds)) return true
          const imei = cell(row, idx.imei).toLowerCase()
          return imei !== "" && skippedSet.has(imei) // giữ lại máy bị skip do trùng IMEI
        })
        const syncResult = await syncToGoogleSheets(SHEET, remaining)
        if (!syncResult.success) {
          return NextResponse.json({ error: "Đã ghi Kho_Hang nhưng lỗi xóa khỏi Hang_doi_tac: " + syncResult.error }, { status: 500 })
        }
      }

      return NextResponse.json({ ok: true, transferred: newKhoRows.length, skipped })
    }

    /* ----- Thêm máy mới (1 hoặc nhiều) ----- */
    const products: any[] = Array.isArray(body.products) ? body.products : [body]
    if (products.length === 0) {
      return NextResponse.json({ error: "Thiếu dữ liệu sản phẩm" }, { status: 400 })
    }

    const { header, rows } = await readFromGoogleSheets(SHEET)
    const idx = idxPartner(header)
    const existingImeis = new Set(
      rows.map((r) => String(r[idx.imei] || "").trim().toLowerCase()).filter(Boolean)
    )

    const ngayNhap = new Date().toLocaleDateString("vi-VN")
    const newRows: any[][] = []
    const duplicated: string[] = []

    for (const p of products) {
      const imeiStr = String(p.imei || p["IMEI"] || "").trim()
      if (!String(p.ten_san_pham || p["Tên Sản Phẩm"] || "").trim()) continue
      if (imeiStr && existingImeis.has(imeiStr.toLowerCase())) {
        duplicated.push(imeiStr)
        continue
      }
      const deviceId = getDeviceId({ IMEI: imeiStr, Serial: "" })
      const idMay = deviceId
        ? last5FromDeviceId(deviceId)
        : Math.floor(10000 + Math.random() * 90000).toString()

      const newRow = header.map((k) => {
        const nk = normalizeKey(k)
        if (k === "ID Máy") return idMay
        if (k === "Ngày Nhập") return p.ngay_nhap || ngayNhap
        if (k === "Nguồn Hàng" || k === "Nguồn") return p.nguon_hang || p.nguon || ""
        if (k === "Tên Sản Phẩm") return p.ten_san_pham || ""
        if (k === "Loại Máy") return p.loai_may || ""
        if (k === "Dung Lượng") return p.dung_luong || ""
        if (k === "Pin (%)") return p.pin || ""
        if (k === "Màu Sắc") return p.mau_sac || ""
        if (k === "IMEI") return imeiStr
        if (k === "Tình Trạng Máy") return p.tinh_trang || ""
        if (k === "Giá Nhập") {
          const v = p.gia_nhap
          return v !== undefined && v !== null && String(v) !== "" ? toNumber(v) : ""
        }
        if (k === "Giá Bán") {
          const v = p.gia_ban
          return v !== undefined && v !== null && String(v) !== "" ? toNumber(v) : ""
        }
        if (k === "Ghi Chú") return p.ghi_chu || ""
        return p[k] ?? p[nk] ?? ""
      })
      newRows.push(newRow)
      if (imeiStr) existingImeis.add(imeiStr.toLowerCase())
    }

    if (newRows.length === 0) {
      return NextResponse.json(
        { error: duplicated.length ? `IMEI đã tồn tại: ${duplicated.join(", ")}` : "Không có sản phẩm hợp lệ" },
        { status: 400 }
      )
    }

    const result = await appendMultipleToGoogleSheets(SHEET, newRows)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true, added: newRows.length, duplicated }, { status: 201 })
  } catch (err) {
    console.error("Hang_doi_tac POST error:", err)
    return NextResponse.json({ error: "Internal server error", raw: String(err) }, { status: 500 })
  }
}
