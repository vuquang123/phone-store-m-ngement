// lib/ghi-chu.ts
// Ghi chú bàn giao ca — lưu trên Google Sheet "Ghi_chu".
// Ca trước tạo note vấn đề cần xử lý; ca sau xem & đánh dấu hoàn thành.
// Pattern header/IO giống lib/notifications.ts & lib/cash.ts.

import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues } from "@/lib/google-sheets"
import { DateTime } from "luxon"

export type NoteStatus = "chua_xu_ly" | "hoan_thanh"

export interface Note {
  id: string
  noiDung: string
  nguoiTao: string
  nguoiHoanThanh?: string
  createdAt: string // ISO — ngày tạo
  completedAt?: string // ISO — ngày hoàn thành (rỗng khi chưa xong)
  status: NoteStatus
}

const SHEET_NAME = "Ghi_chu"

// 7 cột — ghi vào A1:G1
const HEADER = [
  "ID",
  "Nội Dung",
  "Người Tạo",
  "Người Hoàn Thành",
  "Trạng Thái",
  "Created At",
  "Completed At",
] as const

// Phạm vi header tự đếm theo số cột (A..G)
const HEADER_RANGE = `'${SHEET_NAME}'!A1:${colLetter(HEADER.length)}1`

function colLetter(n: number): string {
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - m) / 26)
  }
  return s || "A"
}

/** Tạo ID: ưu tiên crypto.randomUUID, fallback timestamp. */
function genId(): string {
  try {
    const c = (globalThis as any).crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch {}
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Nếu sheet trống hoặc thiếu cột thì ghi lại HEADER. */
async function ensureHeader() {
  try {
    const { header } = await readFromGoogleSheets(SHEET_NAME)
    if (!header || header.length === 0) {
      await updateRangeValues(HEADER_RANGE, [HEADER as unknown as any[]])
      return
    }
    const lower = header.map((h) => (h || "").trim().toLowerCase())
    const missing = HEADER.some((h) => !lower.includes(h.trim().toLowerCase()))
    if (missing) {
      await updateRangeValues(HEADER_RANGE, [HEADER as unknown as any[]])
    }
  } catch {
    try { await updateRangeValues(HEADER_RANGE, [HEADER as unknown as any[]]) } catch {}
  }
}

/** Index các cột theo tên (so khớp lowercase). */
function columnIndexes(header: string[]) {
  const idx = (name: string) => header.findIndex((h) => (h || "").trim().toLowerCase() === name.trim().toLowerCase())
  return {
    iID: idx("id"),
    iNoiDung: idx("nội dung"),
    iNguoiTao: idx("người tạo"),
    iNguoiHoanThanh: idx("người hoàn thành"),
    iTrangThai: idx("trạng thái"),
    iCreated: idx("created at"),
    iCompleted: idx("completed at"),
  }
}

function rowToNote(r: string[], c: ReturnType<typeof columnIndexes>): Note {
  const status: NoteStatus = (r[c.iTrangThai] || "").trim() === "hoan_thanh" ? "hoan_thanh" : "chua_xu_ly"
  return {
    id: r[c.iID] || "",
    noiDung: r[c.iNoiDung] || "",
    nguoiTao: r[c.iNguoiTao] || "",
    nguoiHoanThanh: r[c.iNguoiHoanThanh] || undefined,
    createdAt: r[c.iCreated] || "",
    completedAt: r[c.iCompleted] || undefined,
    status,
  }
}

function noteToRow(n: Note): any[] {
  return [
    n.id,
    n.noiDung,
    n.nguoiTao,
    n.nguoiHoanThanh || "",
    n.status,
    n.createdAt,
    n.completedAt || "",
  ]
}

/** Tạo ghi chú mới. */
export async function addNote({ noiDung, nguoiTao }: { noiDung: string; nguoiTao: string }): Promise<Note> {
  await ensureHeader()
  const note: Note = {
    id: genId(),
    noiDung: String(noiDung || "").trim(),
    nguoiTao: nguoiTao || "N/A",
    createdAt: new Date().toISOString(),
    completedAt: undefined,
    status: "chua_xu_ly",
  }
  await appendToGoogleSheets(SHEET_NAME, noteToRow(note))
  return note
}

/** Danh sách ghi chú, mới nhất trước, cắt theo limit. */
export async function getNotes(limit = 300): Promise<Note[]> {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET_NAME, undefined, { force: true })
  const c = columnIndexes(header)
  if (c.iID === -1) return []
  const items = rows
    .filter((r) => (r[c.iID] || "").trim() !== "")
    .map((r) => rowToNote(r, c))
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
  return items.slice(0, limit)
}

/**
 * Đánh dấu hoàn thành. Nếu đã hoàn thành -> trả nguyên trạng (không ghi đè).
 * Không tìm thấy id -> trả null.
 */
export async function completeNote(id: string, nguoiHoanThanh: string): Promise<Note | null> {
  await ensureHeader()
  const { header, rows } = await readFromGoogleSheets(SHEET_NAME, undefined, { force: true })
  const c = columnIndexes(header)
  if (c.iID === -1) return null
  const rowIdx = rows.findIndex((r) => (r[c.iID] || "").trim() === String(id).trim())
  if (rowIdx === -1) return null

  const current = rowToNote(rows[rowIdx], c)
  if (current.status === "hoan_thanh") return current // đã xong -> không ghi đè

  const updated: Note = {
    ...current,
    status: "hoan_thanh",
    nguoiHoanThanh: nguoiHoanThanh || "N/A",
    completedAt: new Date().toISOString(),
  }

  // Dòng dữ liệu đầu tiên là dòng sheet số 2 (header là dòng 1).
  const sheetRow = rowIdx + 2
  const range = `'${SHEET_NAME}'!A${sheetRow}:${colLetter(HEADER.length)}${sheetRow}`
  await updateRangeValues(range, [noteToRow(updated)])
  return updated
}

/* ----------------------------- Telegram message ----------------------------- */
function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function fmtVN(iso?: string): string {
  if (!iso) return ""
  const dt = DateTime.fromISO(iso, { zone: "Asia/Ho_Chi_Minh" })
  return dt.isValid ? dt.toFormat("dd/MM/yyyy HH:mm") : iso
}

/** Dựng message HTML cho Telegram. */
export function buildNoteMessage(note: Note, kind: "created" | "completed"): string {
  if (kind === "created") {
    return [
      "📝 <b>GHI CHÚ MỚI</b>",
      `Nội dung: ${escapeHtml(note.noiDung)}`,
      `Người tạo: ${escapeHtml(note.nguoiTao)}`,
      `Ngày tạo: ${fmtVN(note.createdAt)}`,
      "Trạng thái: Chưa xử lý",
    ].join("\n")
  }
  return [
    "✅ <b>GHI CHÚ ĐÃ HOÀN THÀNH</b>",
    `Nội dung: ${escapeHtml(note.noiDung)}`,
    `Người tạo: ${escapeHtml(note.nguoiTao)}`,
    `Ngày tạo: ${fmtVN(note.createdAt)}`,
    `Người hoàn thành: ${escapeHtml(note.nguoiHoanThanh || "")}`,
    `Ngày hoàn thành: ${fmtVN(note.completedAt)}`,
  ].join("\n")
}
