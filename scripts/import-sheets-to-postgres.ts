// scripts/import-sheets-to-postgres.ts
// Chép TOÀN BỘ các tab của Google Sheet sang Supabase (Postgres), mỗi tab thành 1 bảng.
// Chạy lại bao nhiêu lần cũng được: mỗi lần chạy sẽ xoá bảng cũ và chép lại từ Sheet.
//
//   pnpm db:import                      # chép tất cả các tab
//   pnpm db:import Kho_Hang Ban_Hang    # chỉ chép vài tab
//   pnpm db:import --check              # chỉ so sánh Sheet và Supabase, không ghi
//
// Cần trong .env.local: GOOGLE_* (như hiện tại) + DATABASE_URL (hoặc DIRECT_URL).
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import { createHash } from "node:crypto"
import { google } from "googleapis"

// Script chạy 1 lần, dùng kết nối trực tiếp (cổng 5432) nếu có.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID || ""
const EMAIL = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ""
const KEY = (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "")
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\\n/g, "\n")

function trimRow(row: any[]): string[] {
  const r = row.map((v) => (v == null ? "" : String(v)))
  let end = r.length
  while (end > 0 && r[end - 1] === "") end--
  return r.slice(0, end)
}
function digest(values: any[][]): string {
  const rows = values.map(trimRow)
  while (rows.length && rows[rows.length - 1].length === 0) rows.pop()
  return createHash("sha1").update(JSON.stringify(rows)).digest("hex").slice(0, 12)
}

async function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes("--check")
  const only = args.filter((a) => !a.startsWith("--"))
  if (!SPREADSHEET_ID || !EMAIL || !KEY) throw new Error("Thiếu GOOGLE_SHEETS_SPREADSHEET_ID / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY")
  if (!process.env.DATABASE_URL) throw new Error("Thiếu DATABASE_URL / DIRECT_URL (chuỗi kết nối Supabase)")

  const pg = await import("../lib/sheet-store/pg")
  const auth = new google.auth.JWT({ email: EMAIL, key: KEY, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const sheets = google.sheets({ version: "v4", auth })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: "sheets.properties.title" })
  const titles = (meta.data.sheets || []).map((s) => String(s.properties?.title || "")).filter(Boolean)
  const targets = only.length ? titles.filter((t) => only.includes(t)) : titles
  const missing = only.filter((t) => !titles.includes(t))
  if (missing.length) console.warn("Không có các tab:", missing.join(", "))

  console.log(`${checkOnly ? "Kiểm tra" : "Chép"} ${targets.length} tab từ Google Sheet -> Supabase\n`)
  const report: Array<Record<string, string | number>> = []
  let bad = 0
  for (const title of targets) {
    const t0 = Date.now()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title.replace(/'/g, "''")}'`,
    })
    const values = (res.data.values || []) as any[][]
    if (!checkOnly) await pg.importSheet(title, values)
    let after: any[][] = []
    try {
      after = await pg.readValues({ sheet: title, c1: 0, c2: Infinity, r1: 1, r2: Infinity })
    } catch {
      after = []
    }
    const same = digest(values) === digest(after)
    if (!same) bad++
    report.push({
      tab: title,
      "dòng Sheet": Math.max(values.length - 1, 0),
      "dòng DB": Math.max(after.length - 1, 0),
      "khớp": same ? "OK" : "LỆCH",
      ms: Date.now() - t0,
    })
    // Sheets API giới hạn ~60 lần đọc/phút
    await new Promise((r) => setTimeout(r, 1100))
  }
  console.table(report)
  await pg.closePool()
  if (bad) {
    console.error(`\n${bad} tab chưa khớp. Chạy lại lệnh cho các tab đó.`)
    process.exit(1)
  }
  console.log("\nXong. Tất cả các tab đều khớp với Google Sheet.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
