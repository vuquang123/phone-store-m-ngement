// app/api/quan-tri/route.ts
// API cho trang "Quản trị dữ liệu": đọc/sửa/thêm/xoá dòng của các bảng như bảng tính.
// Chỉ QUẢN LÝ dùng được. Chạy được với cả Google Sheets lẫn Supabase (qua lib/google-sheets).
//
// Chống ghi đè: mỗi thay đổi gửi kèm giá trị CŨ mà người dùng thấy. Nếu trong lúc đó
// người khác (hoặc màn hình bán hàng) đã đổi ô đó, thay đổi bị từ chối và báo "xung đột".
import { type NextRequest, NextResponse } from "next/server"
import { DateTime } from "luxon"
import { getServerUser } from "@/lib/auth"
import {
  readFromGoogleSheets,
  batchUpdateRangeValues,
  appendMultipleToGoogleSheets,
  appendToGoogleSheets,
  deleteSheetRows,
  colIndex,
} from "@/lib/google-sheets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Các bảng được phép sửa ở trang này (USERS và Dòng tiền có màn hình riêng, không mở ở đây). */
const EDITABLE_TABLES: Record<string, { label: string; key: string[] }> = {
  Kho_Hang: { label: "Kho hàng", key: ["ID Máy", "IMEI", "Serial"] },
  Phu_Kien: { label: "Phụ kiện", key: ["ID"] },
  Khach_Hang: { label: "Khách hàng", key: ["Số Điện Thoại"] },
  Hang_Doi_Tac: { label: "Hàng đối tác", key: ["ID Máy", "IMEI"] },
  Dat_Coc: { label: "Đặt cọc", key: ["ID Đơn Hàng"] },
  Ban_Hang: { label: "Đơn bán", key: ["Mã đơn hàng", "Mã Đơn Hàng", "ID Đơn Hàng"] },
  GOI_BAO_HANH: { label: "Gói bảo hành", key: ["Mã Gói"] },
  HOP_DONG_BAO_HANH: { label: "Hợp đồng bảo hành", key: ["Mã HĐ"] },
  Bao_Hanh: { label: "Máy gửi bảo hành", key: ["IMEI"] },
  CNC: { label: "Máy gửi CNC", key: ["IMEI"] },
  Hoan_Tra: { label: "Hoàn trả", key: ["ID"] },
}

/** Cột không bao giờ trả ra / cho sửa. */
const HIDDEN_COLUMNS = ["mật khẩu", "mat khau", "password"]

const colLetter = (i: number) => {
  let n = i + 1
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - m) / 26)
  }
  return s
}
const q = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`
const same = (a: unknown, b: unknown) => String(a ?? "").trim() === String(b ?? "").trim()

function guard(req: NextRequest) {
  const user = getServerUser(req)
  if (!user) return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) }
  if (user.role !== "quan_ly") {
    return { error: NextResponse.json({ error: "Chỉ quản lý mới dùng được trang này" }, { status: 403 }) }
  }
  return { user }
}

function tableOf(req: NextRequest, bodyTable?: string) {
  const table = String(bodyTable ?? req.nextUrl.searchParams.get("table") ?? "")
  if (!EDITABLE_TABLES[table]) return null
  return table
}

/* ================================ GET ================================ */
export async function GET(req: NextRequest) {
  const g = guard(req)
  if (g.error) return g.error

  if (req.nextUrl.searchParams.get("list")) {
    return NextResponse.json({
      tables: Object.entries(EDITABLE_TABLES).map(([id, t]) => ({ id, label: t.label })),
    })
  }

  const table = tableOf(req)
  if (!table) return NextResponse.json({ error: "Bảng không hợp lệ" }, { status: 400 })
  try {
    const { header, rows } = await readFromGoogleSheets(table, undefined, { force: true })
    const hidden = header.map((h) => HIDDEN_COLUMNS.includes(String(h).trim().toLowerCase()))
    return NextResponse.json({
      table,
      label: EDITABLE_TABLES[table].label,
      header: header.map((h, i) => (hidden[i] ? null : h)),
      // rowNumber = số dòng thật trên bảng (dòng 1 là tiêu đề)
      rows: rows
        .map((r, i) => ({ rowNumber: i + 2, cells: header.map((_, c) => (hidden[c] ? "" : String(r[c] ?? ""))) }))
        .filter((r) => r.cells.some((v) => v !== "")),
      loadedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Không đọc được dữ liệu" }, { status: 500 })
  }
}

/* ================================ POST ================================ */
type Change = { row: number; col: number; old: string; value: string }

export async function POST(req: NextRequest) {
  const g = guard(req)
  if (g.error) return g.error
  const user = g.user!

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 })
  }
  const table = tableOf(req, body?.table)
  if (!table) return NextResponse.json({ error: "Bảng không hợp lệ" }, { status: 400 })

  try {
    const { header, rows } = await readFromGoogleSheets(table, undefined, { force: true })
    const hidden = new Set(
      header.map((h, i) => (HIDDEN_COLUMNS.includes(String(h).trim().toLowerCase()) ? i : -1)).filter((i) => i >= 0),
    )
    const cell = (rowNumber: number, col: number) => String(rows[rowNumber - 2]?.[col] ?? "")

    /* ---------- sửa ô ---------- */
    if (body.action === "update") {
      const changes: Change[] = Array.isArray(body.changes) ? body.changes : []
      const ok: Change[] = []
      const conflicts: Array<Change & { current: string }> = []
      for (const ch of changes) {
        const row = Number(ch.row)
        const col = Number(ch.col)
        if (!Number.isInteger(row) || row < 2 || !Number.isInteger(col) || col < 0 || col >= header.length) continue
        if (hidden.has(col)) continue
        const current = cell(row, col)
        if (!same(current, ch.old)) conflicts.push({ ...ch, current })
        else if (!same(current, ch.value)) ok.push({ row, col, old: current, value: String(ch.value ?? "") })
      }
      if (ok.length) {
        await batchUpdateRangeValues(
          ok.map((c) => ({ range: `${q(table)}!${colLetter(c.col)}${c.row}`, values: [[c.value]] })),
        )
        await logKhoStatus(table, header, rows, ok, user.employeeId || user.email)
      }
      return NextResponse.json({ ok: true, saved: ok.length, conflicts })
    }

    /* ---------- thêm dòng ---------- */
    if (body.action === "append") {
      const list: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : []
      const toRow = (obj: Record<string, string>) =>
        header.map((h, i) => (hidden.has(i) ? "" : String(obj?.[h] ?? "")))
      const data = list.map(toRow).filter((r) => r.some((v) => v !== ""))
      if (!data.length) return NextResponse.json({ ok: true, added: 0 })
      await appendMultipleToGoogleSheets(table, data)
      return NextResponse.json({ ok: true, added: data.length })
    }

    /* ---------- xoá dòng ---------- */
    if (body.action === "delete") {
      const items: Array<{ row: number; cells: string[] }> = Array.isArray(body.rows) ? body.rows : []
      const conflicts: number[] = []
      const okRows: number[] = []
      for (const it of items) {
        const row = Number(it.row)
        const cur = rows[row - 2] || []
        const matches = header.every((_, c) => hidden.has(c) || same(cur[c], it.cells?.[c]))
        if (!Number.isInteger(row) || row < 2 || !matches) conflicts.push(row)
        else okRows.push(row)
      }
      // Xoá từ dưới lên để số dòng phía trên không bị lệch
      for (const r of okRows.sort((a, b) => b - a)) await deleteSheetRows(table, r, 1)
      return NextResponse.json({ ok: true, deleted: okRows.length, conflicts })
    }

    /* ---------- nhập file: cập nhật theo khoá + thêm dòng mới ---------- */
    if (body.action === "import") {
      const list: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : []
      const keyName = EDITABLE_TABLES[table].key.find((k) => colIndex(header, k) !== -1)
      const keyIdx = keyName ? colIndex(header, keyName) : -1
      if (keyIdx === -1) return NextResponse.json({ error: "Bảng không có cột khoá để đối chiếu" }, { status: 400 })
      const byKey = new Map<string, number>()
      rows.forEach((r, i) => {
        const k = String(r[keyIdx] ?? "").trim()
        if (k && !byKey.has(k)) byKey.set(k, i + 2)
      })
      const updates: Change[] = []
      const appends: string[][] = []
      for (const obj of list) {
        const k = String(obj?.[header[keyIdx]] ?? "").trim()
        const existing = k ? byKey.get(k) : undefined
        if (existing) {
          header.forEach((h, c) => {
            if (hidden.has(c) || !(h in obj)) return
            const v = String(obj[h] ?? "")
            if (!same(cell(existing, c), v)) updates.push({ row: existing, col: c, old: cell(existing, c), value: v })
          })
        } else {
          const r = header.map((h, c) => (hidden.has(c) ? "" : String(obj?.[h] ?? "")))
          if (r.some((v) => v !== "")) appends.push(r)
        }
      }
      if (body.dryRun) {
        return NextResponse.json({ ok: true, dryRun: true, key: header[keyIdx], updatedCells: updates.length, updatedRows: new Set(updates.map((u) => u.row)).size, added: appends.length })
      }
      if (updates.length) {
        await batchUpdateRangeValues(updates.map((c) => ({ range: `${q(table)}!${colLetter(c.col)}${c.row}`, values: [[c.value]] })))
        await logKhoStatus(table, header, rows, updates, user.employeeId || user.email)
      }
      if (appends.length) await appendMultipleToGoogleSheets(table, appends)
      return NextResponse.json({ ok: true, key: header[keyIdx], updatedCells: updates.length, updatedRows: new Set(updates.map((u) => u.row)).size, added: appends.length })
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 })
  } catch (e: any) {
    console.error("[quan-tri]", e)
    return NextResponse.json({ error: e?.message || "Lỗi máy chủ" }, { status: 500 })
  }
}

/** Đổi "Trạng Thái" máy trong kho -> ghi Lich_Su_Trang_Thai_May như các màn hình khác. */
async function logKhoStatus(table: string, header: string[], rows: string[][], changes: Change[], who: string) {
  if (table !== "Kho_Hang") return
  const st = colIndex(header, "Trạng Thái")
  if (st === -1) return
  const imei = colIndex(header, "IMEI")
  const serial = colIndex(header, "Serial")
  const name = colIndex(header, "Tên Sản Phẩm")
  const now = DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("HH:mm:ss dd/MM/yyyy")
  for (const c of changes.filter((x) => x.col === st)) {
    const r = rows[c.row - 2] || []
    const dev = String((imei !== -1 && r[imei]) || (serial !== -1 && r[serial]) || "")
    try {
      await appendToGoogleSheets("Lich_Su_Trang_Thai_May", [dev.slice(-5), name !== -1 ? r[name] : "", c.old, c.value, now, who])
    } catch {}
  }
}
