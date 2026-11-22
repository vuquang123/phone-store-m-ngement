// lib/sheet-store/export-to-sheets.ts
// Sao lưu Supabase -> Google Sheet cũ. Dùng cho 2 việc:
//   1. Cron hằng đêm: Google Sheet luôn là bản sao lưu đọc được (xem/báo cáo như trước).
//   2. Quay lại Google Sheets nếu cần: chạy export rồi bỏ biến DATA_BACKEND=postgres.
// Chỉ gọi 4-5 request Sheets API cho mọi tab (batchClear + batchUpdate) nên không dính quota.
import { google } from "googleapis"
import { listSheets, readValues } from "./pg"

function sheetsClient() {
  const email = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ""
  const key = (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] })
  return google.sheets({ version: "v4", auth })
}

const quote = (t: string) => `'${t.replace(/'/g, "''")}'`

export type ExportResult = { tab: string; rows: number; cols: number }[]

/** Ghi đè các tab trên Google Sheet bằng dữ liệu đang có trong Supabase. */
export async function exportPostgresToSheets(only?: string[]): Promise<ExportResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID || ""
  if (!spreadsheetId) throw new Error("Thiếu GOOGLE_SHEETS_SPREADSHEET_ID")
  const api = sheetsClient()

  const tabs = (await listSheets()).filter((t) => !only?.length || only.includes(t))
  const data = new Map<string, string[][]>()
  for (const t of tabs) data.set(t, await readValues({ sheet: t, c1: 0, c2: Infinity, r1: 1, r2: Infinity }))

  // Tạo tab còn thiếu + nới lưới (số dòng/cột) để ghi không bị lỗi "exceeds grid limits".
  const meta = await api.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  })
  const existing = new Map((meta.data.sheets || []).map((s) => [String(s.properties?.title), s.properties!]))
  const requests: any[] = []
  for (const [t, values] of data) {
    const rows = Math.max(values.length, 1)
    const cols = Math.max(1, ...values.map((r) => r.length))
    const p = existing.get(t)
    if (!p) {
      requests.push({ addSheet: { properties: { title: t, gridProperties: { rowCount: rows + 100, columnCount: cols } } } })
      continue
    }
    const rc = p.gridProperties?.rowCount || 0
    const cc = p.gridProperties?.columnCount || 0
    if (rc < rows) requests.push({ appendDimension: { sheetId: p.sheetId, dimension: "ROWS", length: rows - rc + 100 } })
    if (cc < cols) requests.push({ appendDimension: { sheetId: p.sheetId, dimension: "COLUMNS", length: cols - cc } })
  }
  if (requests.length) await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })

  const titles = Array.from(data.keys())
  if (titles.length) {
    await api.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: titles.map(quote) } })
    await api.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: titles.map((t) => ({ range: `${quote(t)}!A1`, values: data.get(t)! })),
      },
    })
  }
  return titles.map((t) => {
    const v = data.get(t)!
    return { tab: t, rows: Math.max(v.length - 1, 0), cols: Math.max(0, ...v.map((r) => r.length)) }
  })
}
