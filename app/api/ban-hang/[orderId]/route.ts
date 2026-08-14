// API chi tiết đơn hàng: /api/ban-hang/[orderId]
import { type NextRequest, NextResponse } from "next/server"
import { batchUpdateRangeValues, readFromGoogleSheets } from "@/lib/google-sheets"
import { extractGhtkCode } from "@/lib/ghtk-status"

const SHEET_NAME = "Ban_Hang"

const normalize = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .trim()
    .toLowerCase()

const toNumber = (value: any) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Number(String(value ?? "").replace(/[^\d-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const toColumnLetter = (num: number) => {
  let s = ""
  let n = num
  while (n > 0) {
    const mod = (n - 1) % 26
    s = String.fromCharCode(65 + mod) + s
    n = Math.floor((n - mod) / 26)
  }
  return s || "A"
}

type AccessoryDetail = {
  id?: string
  sl?: number
  so_luong?: number
}

const parseAccessoryDetail = (raw: any): AccessoryDetail[] => {
  if (!raw) return []
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function getAccessoryCostFromDetail(rawDetail: any) {
  const details = parseAccessoryDetail(rawDetail)

  const { header, rows } = await readFromGoogleSheets("Phu_Kien")
  const idxId = header.indexOf("ID")
  const idxTen = header.indexOf("Tên Sản Phẩm")
  const idxLoai = header.indexOf("Loại")
  const idxGiaNhap = header.indexOf("Giá Nhập")
  if (idxGiaNhap === -1) return 0

  const costById = new Map<string, number>()
  const costByLabel = new Map<string, number>()
  for (const row of rows) {
    const id = String(row[idxId] || "").trim()
    const cost = toNumber(row[idxGiaNhap])
    if (id) costById.set(id, cost)
    const ten = idxTen !== -1 ? String(row[idxTen] || "").trim() : ""
    const loai = idxLoai !== -1 ? String(row[idxLoai] || "").trim() : ""
    const label = normalize(loai ? `${loai} ${ten}` : ten)
    if (label) costByLabel.set(label, cost)
  }

  if (details.length) {
    return details.reduce((sum, item) => {
      const id = String(item?.id || "").trim()
      if (!id) return sum
      const qty = Number(item?.sl ?? item?.so_luong ?? 1) || 1
      return sum + (costById.get(id) || 0) * qty
    }, 0)
  }

  return 0
}

function parseAccessoryTextItems(rawText: any) {
  const text = String(rawText || "").trim()
  if (!text) return []
  return text
    .split(",")
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .map((part) => {
      const matched = part.match(/\s+x(\d+)\s*$/i)
      const qty = matched ? Number(matched[1]) || 1 : 1
      const label = matched ? part.slice(0, matched.index).trim() : part
      return { label, qty }
    })
}

async function getAccessoryCost(rawDetail: any, rawText: any) {
  const details = parseAccessoryDetail(rawDetail)
  if (details.length) {
    return getAccessoryCostFromDetail(rawDetail)
  }

  const textItems = parseAccessoryTextItems(rawText)
  if (!textItems.length) return 0

  const { header, rows } = await readFromGoogleSheets("Phu_Kien")
  const idxTen = header.indexOf("Tên Sản Phẩm")
  const idxLoai = header.indexOf("Loại")
  const idxGiaNhap = header.indexOf("Giá Nhập")
  if (idxTen === -1 || idxGiaNhap === -1) return 0

  const costByLabel = new Map<string, number>()
  for (const row of rows) {
    const ten = String(row[idxTen] || "").trim()
    const loai = idxLoai !== -1 ? String(row[idxLoai] || "").trim() : ""
    const exactLabel = normalize(loai ? `${loai} ${ten}` : ten)
    if (exactLabel) costByLabel.set(exactLabel, toNumber(row[idxGiaNhap]))
    const nameOnly = normalize(ten)
    if (nameOnly && !costByLabel.has(nameOnly)) costByLabel.set(nameOnly, toNumber(row[idxGiaNhap]))
  }

  return textItems.reduce((sum, item) => {
    const cost = costByLabel.get(normalize(item.label)) || 0
    return sum + cost * item.qty
  }, 0)
}

async function requireManager(request: NextRequest) {
  const email = request.headers.get("x-user-email")
  if (!email) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const { header, rows } = await readFromGoogleSheets("USERS")
  const findCol = (candidates: string[]) => {
    const normHeader = header.map((h) => normalize(String(h)))
    for (const c of candidates) {
      const idx = normHeader.findIndex((h) => h === normalize(c))
      if (idx !== -1) return idx
    }
    return -1
  }

  const idxEmail = findCol(["Email", "E-mail", "email"])
  const idxRole = findCol(["Vai Trò", "Vai Tro", "Role", "Quyen"])
  const userRow = rows.find((r) => normalize(String(r[idxEmail])) === normalize(email))
  if (!userRow) return { ok: false as const, response: NextResponse.json({ error: "User not found" }, { status: 404 }) }

  const role = idxRole !== -1 ? normalize(String(userRow[idxRole] || "")) : ""
  if (role !== "quan_ly") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true as const }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId: orderIdRaw } = await ctx.params
    const orderId = orderIdRaw.trim()
    const { header, rows } = await readFromGoogleSheets(SHEET_NAME)

    const colIndex = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n)
        if (i !== -1) return i
      }
      return -1
    }

    const idxIdDon = colIndex("ID Đơn Hàng", "Mã Đơn Hàng", "ID", "Id", "id")
    if (idxIdDon === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột ID Đơn Hàng" }, { status: 400 })
    }

    const orderRows = rows.filter((row) => String(row[idxIdDon] || "").trim() === orderId)
    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    const idx = (name: string) => header.indexOf(name)
    const idxNguon = (() => {
      const i1 = header.indexOf("Nguồn Hàng")
      const i2 = header.indexOf("Nguồn")
      return i1 !== -1 ? i1 : i2
    })()
    const idxPhuKien = colIndex("Phụ Kiện")
    const idxChiTietPK = colIndex("Chi Tiết PK", "Chi Tiết Phụ Kiện", "Chi Tiet PK", "Accessory Detail")
    const idxGoiBH = colIndex("Gói BH", "Goi BH")
    const idxGiaNhap = colIndex("Giá Nhập", "Gia Nhap")
    const idxLai = colIndex("Lãi", "Lai")
    const idxTongThu = colIndex("Tổng Thu", "Tong Thu")
    const idxPhiBH = colIndex("Phí BH", "Phi BH")
    const idxSerial = colIndex("Serial")
    const idxImei = colIndex("IMEI")
    const idxTenSP = colIndex("Tên Sản Phẩm")
    // Dòng máy nhận diện qua IMEI, Serial hoặc Tên Sản Phẩm — máy chỉ có serial (iPad wifi)
    // trước đây bị loại khỏi chi_tiet nên UI không hiện sản phẩm lẫn ô sửa giá nhập/lãi.
    // Dòng chỉ có phụ kiện luôn được ghi với Tên Sản Phẩm rỗng nên không bị nhận nhầm là máy.
    const isMachineRow = (row: any[]) =>
      !!(idxImei !== -1 && String(row[idxImei] || "").trim()) ||
      !!(idxSerial !== -1 && String(row[idxSerial] || "").trim()) ||
      !!(idxTenSP !== -1 && String(row[idxTenSP] || "").trim())

    // Map thông tin chung từ dòng đầu tiên
    const first = orderRows[0]
    const accessoryCost = await getAccessoryCost(
      idxChiTietPK !== -1 ? first[idxChiTietPK] : "",
      idxPhuKien !== -1 ? first[idxPhuKien] : "",
    )

    const orderDetail = {
      id: orderId,
      ma_don_hang: orderId,
      // Sheet dùng cột "Ngày bán"; giữ "Ngày Xuất" làm alias cho dữ liệu cũ.
      ngay_ban: first[colIndex("Ngày Bán", "Ngày bán", "Ngày Xuất")],
      trang_thai: "hoan_thanh",
      phuong_thuc_thanh_toan: first[idx("Hình Thức Thanh Toán")],
      phu_kien_text: idxPhuKien !== -1 ? (first[idxPhuKien] || "") : "",
      phu_kien_detail: idxChiTietPK !== -1 ? (first[idxChiTietPK] || "") : "",
      goi_bh: idxGoiBH !== -1 ? String(first[idxGoiBH] || "") : "",
      nhan_vien: { ho_ten: first[idx("Người Bán")] },
      khach_hang: {
        ho_ten: first[idx("Tên Khách Hàng")] || "Khách lẻ",
        so_dien_thoai: first[idx("Số Điện Thoại")] || "",
      },
      chi_tiet: orderRows
        .map((row, i) => {
          if (!isMachineRow(row)) return null
          const absoluteRowIndex = rows.findIndex((r) => r === row)
          return {
            id: `${orderId}_${i}`,
            row_number: absoluteRowIndex + 2,
            so_luong: 1,
            gia_ban: parseInt((row[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0,
            thanh_tien: parseInt((row[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0,
            gia_nhap: idxGiaNhap !== -1
              ? Math.max(0, toNumber(row[idxGiaNhap]) - (i === 0 ? accessoryCost : 0))
              : 0,
            lai: idxLai !== -1 ? toNumber(row[idxLai]) : 0,
            nguon_hang: idxNguon !== -1 ? (row[idxNguon] || "") : "",
            san_pham: {
              ten_san_pham: row[idx("Tên Sản Phẩm")],
              loai_may: row[idx("Loại Máy")],
              dung_luong: row[idx("Dung Lượng")],
              mau_sac: row[idx("Màu Sắc")],
              imei: row[idx("IMEI")],
              serial: idxSerial !== -1 ? row[idxSerial] : "",
            },
          }
        })
        .filter(Boolean) as any[],
      tong_tien: orderRows.reduce((s, r) => {
        const gia = parseInt((r[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0
        return s + (isMachineRow(r) ? gia : 0)
      }, 0),
      thanh_toan: orderRows.reduce((s, r) => {
        const gia = parseInt((r[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0
        return s + (isMachineRow(r) ? gia : 0)
      }, 0),
      giam_gia: 0,
      tong_gia_nhap: orderRows.reduce((s, r) => s + (idxGiaNhap !== -1 ? toNumber(r[idxGiaNhap]) : 0), 0),
      tong_gia_nhap_phu_kien: accessoryCost,
      tong_lai: orderRows.reduce((s, r) => s + (idxLai !== -1 ? toNumber(r[idxLai]) : 0), 0),
      tong_thu_sheet: idxTongThu !== -1 ? orderRows.reduce((s, r) => s + toNumber(r[idxTongThu]), 0) : 0,
      phi_bh: idxPhiBH !== -1 ? toNumber(first[idxPhiBH]) : 0,
      ghi_chu: first[idx("Ghi Chú")],
      hinh_thuc_van_chuyen: first[idx("Hình Thức Vận Chuyển")] || "",
      // Mã GHTK lấy từ "Hình Thức Vận Chuyển" dạng "GHTK - 1990038382" (fallback Ghi chú cũ).
      ma_ghtk: extractGhtkCode(first[idx("Hình Thức Vận Chuyển")], first[idx("Ghi Chú")]),
    }

    return NextResponse.json(orderDetail)
  } catch (error: any) {
    const message = error?.message || "Internal server error"
    const isQuota = message.toLowerCase().includes("quota") || error?.code === 429
    if (isQuota) {
      return NextResponse.json({ error: "Đang vượt hạn mức đọc Google Sheets, vui lòng thử lại sau ít giây." }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const auth = await requireManager(request)
    if (!auth.ok) return auth.response

    const { orderId: orderIdRaw } = await ctx.params
    const orderId = orderIdRaw.trim()
    const body = await request.json()
    const updates = Array.isArray(body?.updates)
      ? body.updates
      : (body?.row_number ? [{ row_number: body.row_number, gia_nhap: body.gia_nhap }] : [])

    if (!updates.length) {
      return NextResponse.json({ error: "Thiếu dữ liệu cập nhật" }, { status: 400 })
    }

    const { header, rows } = await readFromGoogleSheets(SHEET_NAME, undefined, { force: true })
    const colIndex = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n)
        if (i !== -1) return i
      }
      return -1
    }
    const idxIdDon = colIndex("ID Đơn Hàng", "Mã Đơn Hàng", "ID", "Id", "id")
    const idxGiaNhap = colIndex("Giá Nhập", "Gia Nhap")
    const idxLai = colIndex("Lãi", "Lai")
    const idxTongThu = colIndex("Tổng Thu", "Tong Thu")
    const idxGiaBan = colIndex("Giá Bán", "Gia Ban")
    const idxPhiBH = colIndex("Phí BH", "Phi BH")
    const idxPhuKien = colIndex("Phụ Kiện")
    const idxChiTietPK = colIndex("Chi Tiết PK", "Chi Tiết Phụ Kiện", "Chi Tiet PK", "Accessory Detail")

    if (idxIdDon === -1 || idxGiaNhap === -1 || idxLai === -1) {
      return NextResponse.json({ error: "Thiếu cột cần thiết trong sheet Ban_Hang" }, { status: 400 })
    }

    const orderRowIndexes = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => String(row[idxIdDon] || "").trim() === orderId)

    if (!orderRowIndexes.length) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    const accessoryCost = await getAccessoryCost(
      idxChiTietPK !== -1 ? orderRowIndexes[0]?.row[idxChiTietPK] : "",
      idxPhuKien !== -1 ? orderRowIndexes[0]?.row[idxPhuKien] : "",
    )

    const orderSheetRows = new Set(orderRowIndexes.map(({ index }) => index + 2))
    for (const update of updates) {
      if (!orderSheetRows.has(Number(update.row_number))) {
        return NextResponse.json({ error: `Dòng ${update.row_number} không thuộc đơn ${orderId}` }, { status: 400 })
      }
    }

    for (const update of updates) {
      const sheetRow = Number(update.row_number)
      const rowIndex = sheetRow - 2
      const orderPos = orderRowIndexes.findIndex(({ index }) => index === rowIndex)
      const machineCost = toNumber(update.gia_nhap)
      const storedCost = machineCost + (orderPos === 0 ? accessoryCost : 0)
      rows[rowIndex][idxGiaNhap] = String(storedCost)
    }

    const grossGiaBan = idxGiaBan !== -1
      ? orderRowIndexes.reduce((sum, { row }) => sum + toNumber(row[idxGiaBan]), 0)
      : 0
    const phiBh = idxPhiBH !== -1 ? toNumber(orderRowIndexes[0]?.row[idxPhiBH]) : 0
    const totalThu = grossGiaBan + phiBh

    orderRowIndexes.forEach(({ row, index }, pos) => {
      const cost = toNumber(rows[index][idxGiaNhap])
      rows[index][idxLai] = String((pos === 0 ? totalThu : 0) - cost)
    })

    const updatesToWrite: Array<{ range: string; value: any }> = []
    orderRowIndexes.forEach(({ index }, pos) => {
      const sheetRow = index + 2
      updatesToWrite.push({
        range: `${SHEET_NAME}!${toColumnLetter(idxGiaNhap + 1)}${sheetRow}`,
        value: rows[index][idxGiaNhap],
      })
      if (idxTongThu !== -1) {
        updatesToWrite.push({
          range: `${SHEET_NAME}!${toColumnLetter(idxTongThu + 1)}${sheetRow}`,
          value: pos === 0 ? totalThu : 0,
        })
      }
      updatesToWrite.push({
        range: `${SHEET_NAME}!${toColumnLetter(idxLai + 1)}${sheetRow}`,
        value: rows[index][idxLai],
      })
    })

    await batchUpdateRangeValues(
      updatesToWrite.map((item) => ({
        range: item.range,
        values: [[item.value]],
      })),
    )

    return NextResponse.json({
      success: true,
      orderId,
      updated: orderRowIndexes.map(({ index }) => ({
        row_number: index + 2,
        gia_nhap: Math.max(0, toNumber(rows[index][idxGiaNhap]) - (index === orderRowIndexes[0]?.index ? accessoryCost : 0)),
        lai: toNumber(rows[index][idxLai]),
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
