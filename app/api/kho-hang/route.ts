import { isManagerRole } from "@/lib/roles"
import { chuanTenMay, chuanDungLuong, chuanMau } from "@/lib/chuan-hoa-may"
import { type NextRequest, NextResponse } from "next/server"
import { branchContextFromHeaders, filterRowsByBranch, branchColumnIndex } from "@/lib/branch-context"
import { branchName, rowBranchId } from "@/lib/branches"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues, colIndex, norm, khoColIndex, nguonNhapColIndex, updateProductsNguon, updateProductsDangXuLy } from "@/lib/google-sheets"

import { getDeviceId, last5FromDeviceId } from "@/lib/device-id"
import { isConHangStatus } from "@/lib/utils/inventory-helpers"
import { sendStockEventNotification, sendProcessingDeviceMessage, deleteTelegramMessage } from "@/lib/telegram"
import { themMayVaoLo } from "@/lib/tai-chinh/ghi"
import { COT_DE_O_SHOP, datDeOShop, giaTriDeOShop, locMayDeOShop } from "@/lib/kho/de-o-shop"
import { ensureColumn } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEET = "Kho_Hang"

/* ========== helpers ========== */


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
    return isManagerRole(userRow[idxRole])
  } catch {
    return false
  }
}

function buildBodyNormMap(body: Record<string, any> = {}) {
  const bodyNormMap: Record<string, any> = {}
  Object.keys(body || {}).forEach((k) => {
    bodyNormMap[normalizeKey(k)] = body[k]
  })
  return bodyNormMap
}

function getValForHeader(
  kRaw: string,
  body: Record<string, any>,
  bodyNormMap: Record<string, any>,
  opts: { idMay: string; imeiStr: string; serialStr: string; defaultNgayNhap: string }
) {
  // Tiêu đề trong sheet có thể bị lọt khoảng trắng đầu/cuối khi sửa tay
  // (vd cột A của Kho_Hang đang là " ID Máy"). So sánh trên bản đã trim,
  // nếu không thì mọi nhánh `k === "..."` đều trượt và cột bị ghi rỗng.
  const k = String(kRaw ?? "").trim()
  const nk = normalizeKey(k)
  if (k === "ID Máy") return opts.idMay
  if (k === "IMEI") return opts.imeiStr
  if (k === "Serial") return opts.serialStr
  if (k === "Trạng Thái") return body.trang_thai || bodyNormMap["trangthai"] || "Còn hàng"
  if (k === "Trạng Thái Kho") {
    const source = body.nguon || bodyNormMap["nguon"] || bodyNormMap["nguonhang"] || ""
    return body.trang_thai_kho || bodyNormMap["trangthaikho"] || body.trang_thai_ton || bodyNormMap["trangthaiton"] || source || "Có sẵn"
  }

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
    return chuanTenMay(body.ten_san_pham || bodyNormMap["tensanpham"] || "")
  }
  if (k === "Dung Lượng") {
    return chuanDungLuong(body.dung_luong || bodyNormMap["dungluong"] || "")
  }
  if (k === "Màu Sắc") {
    return chuanMau(body.mau_sac || bodyNormMap["mausac"] || "")
  }
  if (k === "Pin (%)") {
    return body.pin || bodyNormMap["pin"] || ""
  }
  if (k === "Tình Trạng Máy") {
    return body.tinh_trang || bodyNormMap["tinhtrang"] || body.tinh_trang_may || bodyNormMap["tinhtrangmay"] || ""
  }

  if (k === "Giá Nhập") {
    const v = body.gia_nhap ?? bodyNormMap["gianhap"]
    return v !== undefined && v !== null && String(v) !== "" ? toNumber(v) : ""
  }
  if (k === "Giá Bán") {
    const v = body.gia_ban ?? bodyNormMap["giaban"]
    return v !== undefined && v !== null && String(v) !== "" ? toNumber(v) : ""
  }
  if (k === "Giảm Giá") {
    const v = body.giam_gia ?? bodyNormMap["giamgia"]
    return v !== undefined && v !== null && String(v) !== "" ? toNumber(v) : ""
  }
  if (k === "Ghi Chú") {
    return body.ghi_chu || bodyNormMap["ghichu"] || ""
  }
  if (k === "Nguồn" || k === "Nguồn Hàng") {
    return body.nguon || bodyNormMap["nguon"] || bodyNormMap["nguonhang"] || ""
  }
  if (nk === "nguonnhap" || nk === "nguonnhaphang") {
    return body.nguon_nhap || body.nguonNhap || bodyNormMap["nguonnhap"] || bodyNormMap["nguonnhaphang"] || ""
  }
  if (k === "Dạng Sim" || k === "Dạng sim" || k === "Kiểu dạng sim") {
    return body.do_sim || bodyNormMap["dangsim"] || bodyNormMap["kieudangsim"] || ""
  }
  if (k === "Để Ở Shop" || nk === "eoshop" || nk === "deoshop") {
    const v = body.de_o_shop ?? bodyNormMap["deoshop"]
    return v === undefined || v === null ? "" : String(v)
  }
  if (nk === "dangxuly") {
    return body.dang_xu_ly || bodyNormMap["dangxuly"] || "No"
  }
  return (
    body[kRaw] ??
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
    giamGia: colIndex(header, "Giảm Giá", "Giam gia", "Giam Gia"),
    ghiChu: colIndex(header, "Ghi Chú"),
    trangThai: colIndex(header, "Trạng Thái"),
    trangThaiKho: khoColIndex(header),
    nguon: colIndex(header, "Nguồn", "Nguồn Hàng", "Nguon", "Nguon Hang"),
    nguonNhap: nguonNhapColIndex(header),
    doSim: colIndex(header, "Dạng Sim", "Dạng sim", "Kiểu dạng sim"),
    dangXuLy: colIndex(header, "Đang xử lý", "Đang Xử Lý", "Dang xu ly"),
  }
}

/**
 * Tài chính: máy nhập kèm "Lô nhập" (body.ma_lo) -> ghi thêm vào sổ lô Chi_Tiet_Lo.
 * Lỗi ở bước này không làm hỏng việc nhập kho (máy đã vào Kho_Hang), chỉ báo lại cho người nhập.
 */
async function ghiSoLo(request: NextRequest, maLo: string, items: { p: any; idMay: string; imei: string; serial: string }[]) {
  if (!maLo || !items.length) return { ok: true as const, added: 0 }
  try {
    const ctx = branchContextFromHeaders(request.headers)
    const chiNhanh = branchName(ctx?.writeBranch || "1")
    const added = await themMayVaoLo(
      maLo,
      items.map(({ p, idMay, imei, serial }) => ({
        idMay,
        imei,
        serial,
        ten: chuanTenMay(p.ten_san_pham || p["Tên Sản Phẩm"] || ""),
        loaiMay: p.loai_phu_kien || p.loai_may || p["Loại Máy"] || "",
        dungLuong: chuanDungLuong(p.dung_luong || p["Dung Lượng"] || ""),
        mau: chuanMau(p.mau_sac || p["Màu Sắc"] || ""),
        pin: p.pin || p["Pin (%)"] || "",
        tinhTrang: p.tinh_trang || p.tinh_trang_may || p["Tình Trạng Máy"] || "",
        dangSim: p.do_sim || p["Dạng Sim"] || "",
        giaNhap: p.gia_nhap ?? p["Giá Nhập"] ?? p["Giá nhập"] ?? "",
        giaBan: p.gia_ban ?? p["Giá Bán"] ?? "",
      })),
      chiNhanh,
    )
    return { ok: true as const, added }
  } catch (e: any) {
    console.error("[Tài chính] ghi sổ lô lỗi:", e)
    return { ok: false as const, error: `Máy đã nhập kho nhưng chưa ghi được vào lô ${maLo}: ${e?.message || e}` }
  }
}

/* ========== GET: list + filters + pagination ========== */
export async function GET(request: NextRequest) {
  try {
    const manager = await isManager(request)
    const force = new URL(request.url).searchParams.get("refresh") === "1"
    const { header, rows: allRows } = await readFromGoogleSheets(SHEET, undefined, { force })
    const branchCtx = branchContextFromHeaders(request.headers)
    // Máy "Để Ở Shop" = No (lô mới chưa chốt giá) chỉ chủ shop + quản lý thấy
    const rows = locMayDeOShop(header, filterRowsByBranch(header, allRows, branchCtx), manager ? "quan_ly" : null)
    const bIdx = branchColumnIndex(header)
    const idx = idxKho(header)
    const products = rows.map((row) => ({
      chi_nhanh: branchName(rowBranchId(bIdx !== -1 ? row[bIdx] : "")),
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
      giam_gia: idx.giamGia !== -1 ? toNumber(row[idx.giamGia]) : 0,
      trang_thai: row[idx.trangThai],
      trang_thai_kho: idx.trangThaiKho !== -1 ? row[idx.trangThaiKho] : (isConHangStatus(row[idx.trangThai]) ? "Có sẵn" : ""),
      nguon: (idx.nguon !== -1 && row[idx.nguon]) ? row[idx.nguon] : (idx.trangThaiKho !== -1 ? row[idx.trangThaiKho] : ""),
      nguon_nhap: manager && idx.nguonNhap !== -1 ? (row[idx.nguonNhap] || "") : "",
      ghi_chu: row[idx.ghiChu],
      do_sim: idx.doSim !== -1 ? row[idx.doSim] : "",
      dang_xu_ly: idx.dangXuLy !== -1 ? String(row[idx.dangXuLy] || "").trim() : "",
      ngay_nhap: row[idx.ngayNhap],
      de_o_shop: giaTriDeOShop(header, row),
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
    // "Để Ở Shop": chỉ quản lý/chủ shop được nhập máy ẩn với nhân viên (lô mới chưa chốt giá)
    let coDeOShop = false
    if (Array.isArray(body?.products) && body.products.some((p: any) => p && p.de_o_shop !== undefined && p.de_o_shop !== "")) {
      if (await isManager(request)) {
        await ensureColumn(SHEET, COT_DE_O_SHOP)
        coDeOShop = true
      } else {
        body.products.forEach((p: any) => p && delete p.de_o_shop)
      }
    }
    if (body?.action === "set_de_o_shop") {
      if (!(await isManager(request))) return NextResponse.json({ error: "Chỉ quản lý hoặc chủ shop được đổi Để ở shop" }, { status: 403 })
      const ids = Array.isArray(body.productIds) ? body.productIds.map(String) : []
      if (!ids.length) return NextResponse.json({ error: "Chưa chọn máy" }, { status: 400 })
      const r = await datDeOShop(ids, body.value === "No" ? "No" : "Yes")
      return NextResponse.json({ ok: true, cap_nhat: r.capNhat })
    }
    const { header, rows } = await readFromGoogleSheets(SHEET, undefined, body?.bo_qua_trung || coDeOShop ? { force: true } : undefined)
    const sendImportMessage = async (count: number, items: any[]) => {
      if (!count || !Array.isArray(items) || !items.length) return
      try {
        const devices = items.map((p: any) => ({
          name: chuanTenMay(p.ten_san_pham || p["Tên Sản Phẩm"]),
          imei: p.imei || p["IMEI"],
          serial: p.serial || p["Serial"],
          mau_sac: chuanMau(p.mau_sac || p["Màu Sắc"]),
          dung_luong: chuanDungLuong(p.dung_luong || p["Dung Lượng"]),
          tinh_trang: p.tinh_trang || p.tinh_trang_may || p["Tình Trạng Máy"],
          pin: p.pin || p["Pin (%)"],
          do_sim: p.do_sim || p["Dạng Sim"] || p["Dạng sim"] || p["Kiểu dạng sim"],
          // Dialog nhập hàng gửi Lock/Quốc tế ở field loai_phu_kien (ghi vào cột "Loại Máy")
          loai_may: p.loai_phu_kien || p.loai_may || p["Loại Máy"],
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
      // Nhập lô từ Excel (body.bo_qua_trung): bỏ qua máy đã có trong kho hoặc lặp lại trong cùng file
      const boQua: string[] = []
      if (body.bo_qua_trung) {
        const iIm = colIndex(header, "IMEI")
        const iSe = colIndex(header, "Serial")
        const daCo = new Set<string>()
        for (const r of rows) {
          for (const j of [iIm, iSe]) if (j !== -1 && String(r[j] || "").trim()) daCo.add(String(r[j]).trim().toUpperCase())
        }
        body.products = body.products.filter((p: any) => {
          const ids = [p.imei || p["IMEI"], p.serial || p["Serial"]].map((x) => String(x || "").trim().toUpperCase()).filter(Boolean)
          if (ids.some((id) => daCo.has(id))) {
            boQua.push(ids[0])
            return false
          }
          ids.forEach((id) => daCo.add(id))
          return true
        })
      }
      let added = 0
      const soLoItems: { p: any; idMay: string; imei: string; serial: string }[] = []
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
        if (result.success) {
          added++
          soLoItems.push({ p, idMay, imei: imeiStr, serial: serialStr })
        }
      }
      // Máy "Để Ở Shop" = No (nhân viên chưa thấy) thì không báo nhập kho lên nhóm Telegram
      const baoNhap = soLoItems.map((x) => x.p).filter((p: any) => String(p?.de_o_shop || "") !== "No")
      if (baoNhap.length > 0) {
        await sendImportMessage(baoNhap.length, baoNhap)
      }
      const soLo = await ghiSoLo(request, String(body.ma_lo || "").trim(), soLoItems)
      return NextResponse.json({ ok: true, added, so_lo: soLo, bo_qua: boQua }, { status: 200 })
    } else if (body.action === "bulk_update_nguon" && Array.isArray(body.productIds) && body.nguon) {
      const result: any = await updateProductsNguon(body.productIds, body.nguon, body.employeeId || "NV-UNKNOWN")
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      // Gửi thông báo Telegram khi chuyển kho thành công
      if (result.devices && result.devices.length > 0) {
        await sendStockEventNotification({
          type: "transfer",
          total: result.devices.length,
          to: body.nguon,
          devices: result.devices,
          employee: body.employeeId
        }).catch(e => console.error("[TG] transfer notify fail:", e))
      }
      return NextResponse.json({ ok: true, updated: body.productIds.length }, { status: 200 })
    } else if (body.action === "toggle_dang_xu_ly" && Array.isArray(body.productIds) && body.productIds.length > 0) {
      // Toggle trạng thái "Đang xử lý": ghi tên nhân viên (employeeName) hoặc "No".
      // Có thể đặt giá trị cụ thể qua body.value.
      const employeeName = body.employeeName || body.employeeId || ""
      const result: any = await updateProductsDangXuLy(body.productIds, employeeName, body.value)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      // Telegram topic "Máy đang xử lý":
      // - Đánh dấu xử lý -> gửi 1 tin/máy, lưu message_id vào cột "TG Msg Xử Lý"
      // - Hủy xử lý -> xóa đúng tin nhắn của máy đó
      if (Array.isArray(result.updated) && result.updated.length > 0) {
        for (const d of result.updated) {
          try {
            if (String(d.dang_xu_ly || "").toLowerCase() === "no") {
              const msgId = Number(d.tg_msg_id)
              if (Number.isFinite(msgId) && msgId > 0) {
                await deleteTelegramMessage(msgId)
              }
            } else {
              const sent = await sendProcessingDeviceMessage(d, employeeName || "NV-UNKNOWN")
              if (sent?.success && sent.message_id && d.tg_msg_cell) {
                await updateRangeValues(d.tg_msg_cell, [[String(sent.message_id)]])
              }
            }
          } catch (e) {
            console.error("[TG] processing toggle notify fail:", e)
          }
        }
      }
      return NextResponse.json({ ok: true, updated: result.updated }, { status: 200 })
    } else if (body.action === "update" && body.id) {
      // Tìm index cột ID Máy
      const idxId = colIndex(header, "ID Máy")
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
      const bodyNormMap = buildBodyNormMap(body)
      const newRow = header.map((kRaw, i) => {
        const k = String(kRaw ?? "").trim()
        const nk = normalizeKey(k)
        // Ưu tiên các key cụ thể trong body hoặc bodyNormMap
        if (k === "Nguồn" || k === "Nguồn Hàng") {
          return body.nguon || bodyNormMap["nguon"] || bodyNormMap["nguonhang"] || oldRow[i] || ""
        }
        if (body[k] !== undefined && body[k] !== null && body[k] !== "") {
          return body[k]
        }
        if (bodyNormMap[nk] !== undefined && bodyNormMap[nk] !== null && bodyNormMap[nk] !== "") {
          return bodyNormMap[nk]
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
      const soLo = await ghiSoLo(request, String(body.ma_lo || "").trim(), [{ p: body, idMay, imei: imeiStr, serial: serialStr }])
      return NextResponse.json({ ok: true, created: true, id_may: idMay, so_lo: soLo }, { status: 201 })
    }
  } catch (err) {
    console.error("Kho_Hang POST error:", err)
    return NextResponse.json({ error: "Internal server error", raw: String(err) }, { status: 500 })
  }
}
