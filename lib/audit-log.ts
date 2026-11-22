// Lịch sử chỉnh sửa ở trang Quản trị dữ liệu: ai sửa, lúc nào, bảng nào, ô nào, giá trị cũ -> mới.
// Lưu ở tab/bảng "Lich_Su_Quan_Tri" (tự tạo nếu chưa có). Ghi lỗi không làm hỏng thao tác chính.
import { DateTime } from "luxon"
import {
  appendMultipleToGoogleSheets,
  ensureSheetExists,
  readFromGoogleSheets,
  updateRangeValues,
} from "@/lib/google-sheets"
import { roleLabel } from "@/lib/roles"
import type { SessionUser } from "@/lib/auth"

export const AUDIT_SHEET = "Lich_Su_Quan_Tri"
const HEADER = ["Thời Gian", "Email", "Người Sửa", "Vai Trò", "Bảng", "Thao Tác", "Dòng", "Mã", "Cột", "Giá Trị Cũ", "Giá Trị Mới"]
const MAX_LEN = 500

export type AuditEntry = {
  table: string
  action: "Sửa" | "Thêm" | "Xoá" | "Nhập file" | "Thêm nợ" | "Sửa nợ" | "Trả nợ" | string
  row?: number | string
  key?: string
  column?: string
  oldValue?: unknown
  newValue?: unknown
}

let ensured = false
async function ensureAuditSheet() {
  if (ensured) return
  await ensureSheetExists(AUDIT_SHEET)
  const { header } = await readFromGoogleSheets(AUDIT_SHEET, undefined, { force: true })
  if (String(header?.[0] ?? "").trim() !== HEADER[0]) {
    await updateRangeValues(`'${AUDIT_SHEET}'!A1:K1`, [HEADER])
  }
  ensured = true
}

const cut = (v: unknown) => {
  const s = v == null ? "" : String(v)
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN) + "…" : s
}

/** Tóm tắt cả dòng thành "Cột: giá trị; ..." (bỏ ô trống) để ghi khi thêm/xoá dòng. */
export function summarizeRow(header: (string | null)[], cells: unknown[]) {
  return header
    .map((h, i) => (h && String(cells[i] ?? "").trim() ? `${String(h).trim()}: ${String(cells[i]).trim()}` : ""))
    .filter(Boolean)
    .join("; ")
}

export async function logAdminChanges(user: SessionUser, entries: AuditEntry[]) {
  if (!entries.length) return
  try {
    await ensureAuditSheet()
    const now = DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("yyyy-MM-dd HH:mm:ss")
    const rows = entries.map((e) => [
      now,
      user.email || "",
      user.name || user.employeeId || "",
      roleLabel(user.role),
      e.table,
      e.action,
      e.row == null ? "" : String(e.row),
      cut(e.key),
      cut(e.column),
      cut(e.oldValue),
      cut(e.newValue),
    ])
    await appendMultipleToGoogleSheets(AUDIT_SHEET, rows)
  } catch (err) {
    console.error("[audit-log] không ghi được lịch sử:", err)
  }
}

export type AuditRow = {
  time: string; email: string; name: string; role: string; table: string; action: string
  row: string; key: string; column: string; oldValue: string; newValue: string
}

export async function readAdminHistory(opts: { table?: string; limit?: number } = {}): Promise<AuditRow[]> {
  let data: { header: string[]; rows: string[][] }
  try {
    data = await readFromGoogleSheets(AUDIT_SHEET, undefined, { force: true })
  } catch {
    return []
  }
  const out: AuditRow[] = []
  for (let i = data.rows.length - 1; i >= 0 && out.length < (opts.limit ?? 500); i--) {
    const r = data.rows[i] || []
    if (!r.some((v) => String(v ?? "").trim())) continue
    const row: AuditRow = {
      time: String(r[0] ?? ""), email: String(r[1] ?? ""), name: String(r[2] ?? ""), role: String(r[3] ?? ""),
      table: String(r[4] ?? ""), action: String(r[5] ?? ""), row: String(r[6] ?? ""), key: String(r[7] ?? ""),
      column: String(r[8] ?? ""), oldValue: String(r[9] ?? ""), newValue: String(r[10] ?? ""),
    }
    if (opts.table && row.table !== opts.table) continue
    out.push(row)
  }
  return out
}
