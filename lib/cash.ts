// lib/cash.ts
// Sổ quỹ tiền mặt — lưu trên Google Sheet tên "Tien_mat".
// Số dư "thật" luôn được TÍNH LẠI từ toàn bộ sổ (tổng thu - tổng chi),
// cột "Số Dư Sau" chỉ là ảnh chụp tại thời điểm ghi.

import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"
import { sendCashTelegram, sendCashPhoto } from "./telegram-cash"

const SHEET_NAME = "Tien_mat"

// 10 cột — ghi vào A1:J1
const HEADER = [
  "ID",
  "Loại",
  "Số Tiền",
  "Số Dư Sau",
  "Nguồn",
  "Mã Tham Chiếu",
  "Lý Do",
  "Nhân Viên",
  "Ghi Chú",
  "Created At",
] as const

export type CashType = "thu" | "chi"

export interface CashEntry {
  id: string
  loai: CashType
  so_tien: number
  so_du_sau: number
  nguon: string
  ma_tham_chieu: string
  ly_do: string
  nhan_vien: string
  ghi_chu: string
  created_at: string
}

export interface RecordCashInput {
  loai: CashType
  so_tien: number
  nguon?: string
  ma_tham_chieu?: string
  ly_do?: string
  nhan_vien?: string
  ghi_chu?: string
  /** Ảnh đính kèm (data URL/base64) — đẩy lên topic Telegram quỹ, KHÔNG lưu vào sheet. */
  image_base64?: string
}

/** Bỏ mọi ký tự không phải số để parse tiền (chuỗi vi-VN "1.000.000 đ" -> 1000000). */
function toNumber(v: any): number {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, "").replace(/(?!^)-/g, ""))
  return Number.isFinite(n) ? n : 0
}

/** Tạo ID: ưu tiên crypto.randomUUID, fallback timestamp. */
function genId(): string {
  try {
    const c = (globalThis as any).crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch {}
  return `cash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Nếu sheet trống hoặc thiếu cột thì ghi lại HEADER (giống pattern lib/notifications.ts). */
async function ensureHeader() {
  try {
    const { header } = await readFromGoogleSheets(SHEET_NAME)
    if (!header || header.length === 0) {
      await updateRangeValues(`'${SHEET_NAME}'!A1:J1`, [HEADER as unknown as any[]])
      return
    }
    const lower = header.map((h) => (h || "").trim().toLowerCase())
    const missing = HEADER.some((h) => !lower.includes(h.trim().toLowerCase()))
    if (missing) {
      await updateRangeValues(`'${SHEET_NAME}'!A1:J1`, [HEADER as unknown as any[]])
    }
  } catch {
    try {
      await updateRangeValues(`'${SHEET_NAME}'!A1:J1`, [HEADER as unknown as any[]])
    } catch {}
  }
}

/** Đọc toàn bộ sổ, map theo tên cột (so khớp lowercase), sort created_at giảm dần. */
export async function getCashEntries(): Promise<CashEntry[]> {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET_NAME)
  const lower = header.map((h) => (h || "").trim().toLowerCase())
  const idx = (name: string) => lower.indexOf(name.trim().toLowerCase())

  const iID = idx("ID")
  const iLoai = idx("Loại")
  const iSoTien = idx("Số Tiền")
  const iSoDu = idx("Số Dư Sau")
  const iNguon = idx("Nguồn")
  const iMaTC = idx("Mã Tham Chiếu")
  const iLyDo = idx("Lý Do")
  const iNV = idx("Nhân Viên")
  const iGhiChu = idx("Ghi Chú")
  const iCreated = idx("Created At")

  const entries: CashEntry[] = (rows || [])
    .filter((r) => r && (iID === -1 || r[iID]))
    .map((r) => ({
      id: iID !== -1 ? String(r[iID] || "") : "",
      loai: (String(r[iLoai] || "").trim().toLowerCase() === "chi" ? "chi" : "thu") as CashType,
      so_tien: toNumber(r[iSoTien]),
      so_du_sau: toNumber(r[iSoDu]),
      nguon: iNguon !== -1 ? String(r[iNguon] || "") : "",
      ma_tham_chieu: iMaTC !== -1 ? String(r[iMaTC] || "") : "",
      ly_do: iLyDo !== -1 ? String(r[iLyDo] || "") : "",
      nhan_vien: iNV !== -1 ? String(r[iNV] || "") : "",
      ghi_chu: iGhiChu !== -1 ? String(r[iGhiChu] || "") : "",
      created_at: iCreated !== -1 ? String(r[iCreated] || "") : "",
    }))

  entries.sort((a, b) => {
    const ta = Date.parse(a.created_at) || 0
    const tb = Date.parse(b.created_at) || 0
    return tb - ta
  })
  return entries
}

/** Số dư "thật" = tổng(thu) - tổng(chi) trên toàn bộ sổ. */
export async function getCashBalance(): Promise<number> {
  const entries = await getCashEntries()
  return entries.reduce((sum, e) => sum + (e.loai === "thu" ? e.so_tien : -e.so_tien), 0)
}

/** Ghi 1 dòng vào sổ. balanceAfter = số dư hiện tại ± so_tien (ảnh chụp lưu cột "Số Dư Sau"). */
export async function addCashEntry(
  input: RecordCashInput,
): Promise<{ id: string; balanceAfter: number; entry: CashEntry }> {
  const so_tien = Math.abs(toNumber(input.so_tien))
  if (!(so_tien > 0)) {
    throw new Error("Số tiền phải lớn hơn 0")
  }
  const loai: CashType = input.loai === "chi" ? "chi" : "thu"

  const current = await getCashBalance()
  const balanceAfter = loai === "thu" ? current + so_tien : current - so_tien

  const id = genId()
  const created_at = new Date().toISOString()

  const entry: CashEntry = {
    id,
    loai,
    so_tien,
    so_du_sau: balanceAfter,
    nguon: input.nguon || "",
    ma_tham_chieu: input.ma_tham_chieu || "",
    ly_do: input.ly_do || "",
    nhan_vien: input.nhan_vien || "",
    ghi_chu: input.ghi_chu || "",
    created_at,
  }

  // Ghi đúng thứ tự HEADER
  const row = [
    entry.id,
    entry.loai,
    entry.so_tien,
    entry.so_du_sau,
    entry.nguon,
    entry.ma_tham_chieu,
    entry.ly_do,
    entry.nhan_vien,
    entry.ghi_chu,
    entry.created_at,
  ]
  await ensureHeader()
  await appendToGoogleSheets(SHEET_NAME, row)

  return { id, balanceAfter, entry }
}

/** Ghi sổ + thông báo (best-effort). Lỗi thông báo/Telegram KHÔNG làm hỏng ghi sổ. */
export async function recordCashTransaction(
  input: RecordCashInput,
): Promise<{ id: string; balanceAfter: number }> {
  const { id, balanceAfter, entry } = await addCashEntry(input)

  const dauHieu = entry.loai === "thu" ? "+" : "-"
  const tienStr = entry.so_tien.toLocaleString("vi-VN") + "₫"
  const soDuStr = balanceAfter.toLocaleString("vi-VN") + "₫"

  // Notification (best-effort)
  try {
    await addNotification({
      loai: "tien_mat",
      tieu_de: entry.loai === "thu" ? "Nhập quỹ tiền mặt" : "Xuất quỹ tiền mặt",
      noi_dung:
        `${dauHieu}${tienStr}` +
        (entry.ly_do ? ` • ${entry.ly_do}` : "") +
        (entry.nhan_vien ? ` • ${entry.nhan_vien}` : "") +
        ` • Số dư: ${soDuStr}`,
      nguoi_gui_id: entry.nhan_vien || "system",
      nguoi_nhan_id: "all",
    })
  } catch (e) {
    console.warn("[CASH] addNotification fail:", e)
  }

  // Telegram (best-effort)
  try {
    await sendCashTelegram({
      loai: entry.loai,
      so_tien: entry.so_tien,
      so_du_sau: balanceAfter,
      ly_do: entry.ly_do,
      nhan_vien: entry.nhan_vien,
      ma_tham_chieu: entry.ma_tham_chieu,
      nguon: entry.nguon,
    })
  } catch (e) {
    console.warn("[CASH] sendCashTelegram fail:", e)
  }

  // Ảnh đính kèm (best-effort): đẩy lên topic Telegram quỹ để minh bạch.
  if (input.image_base64) {
    try {
      const dauHieu2 = entry.loai === "thu" ? "+" : "-"
      await sendCashPhoto(
        input.image_base64,
        `💰 ${entry.loai === "thu" ? "Nhập" : "Xuất"} quỹ ${dauHieu2}${tienStr}` +
          (entry.ly_do ? ` • ${entry.ly_do}` : "") +
          (entry.ma_tham_chieu ? ` • ${entry.ma_tham_chieu}` : ""),
      )
    } catch (e) {
      console.warn("[CASH] sendCashPhoto fail:", e)
    }
  }

  return { id, balanceAfter }
}
