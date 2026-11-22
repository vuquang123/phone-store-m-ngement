// scripts/setup-branches.ts
// Chuẩn bị dữ liệu cho 2 chi nhánh (DEV PỒ = 1, T1s = 2). Chạy 1 lần trước khi dùng
// bản web có chi nhánh. Chạy lại cũng an toàn (chỉ điền chỗ còn thiếu).
//
//   pnpm db:branches            # xem trước sẽ làm gì, KHÔNG ghi
//   pnpm db:branches --yes      # ghi vào Supabase
//   pnpm db:branches --yes --sheet   # ghi xong chép các tab đã đổi sang Google Sheet
//
// Việc làm:
//  1. USERS: lấy cột "Chi nhánh" anh đã thêm trên Google Sheet đưa vào Supabase
//     (khớp theo Email; giữ mật khẩu và lần đăng nhập mới nhất đang có trong Supabase).
//  2. Các bảng chia theo chi nhánh (Kho_Hang, Ban_Hang, Khach_Hang, ...): thêm cột
//     "Chi Nhánh" ở cuối nếu chưa có, dòng cũ chưa ghi chi nhánh -> "DEV PỒ".
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import { google } from "googleapis"

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

const APPLY = process.argv.includes("--yes")
const TO_SHEET = process.argv.includes("--sheet")
const SKIP_USERS = process.argv.includes("--skip-users")

const fold = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()

async function readSheetUsers(): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID || ""
  const email = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ""
  const key = (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] })
  const api = google.sheets({ version: "v4", auth })
  const res = await api.spreadsheets.values.get({ spreadsheetId, range: "'USERS'!A1:ZZ1000" })
  return (res.data.values || []).map((r) => r.map((v) => (v == null ? "" : String(v))))
}

async function main() {
  const pg = await import("../lib/sheet-store/pg")
  const { BRANCH_TABS, BRANCHES, isBranchColumn } = await import("../lib/branches")
  const { Pool } = await import("pg")
  const pool = new Pool({
    connectionString: pg.cleanConnectionString(process.env.DATABASE_URL),
    ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "") ? undefined : { rejectUnauthorized: false },
  })
  const qi = pg.qi
  const DEV = BRANCHES[0].name
  const changedTabs: string[] = []

  console.log(APPLY ? "== GHI THẬT vào Supabase ==" : "== XEM TRƯỚC (thêm --yes để ghi) ==")

  /* ---------------- 1. USERS ---------------- */
  if (!SKIP_USERS) {
    const sheet = await readSheetUsers()
    const sh = sheet[0] || []
    const shBranch = sh.findIndex((h) => isBranchColumn(h))
    if (shBranch === -1) {
      console.log("USERS: Google Sheet chưa có cột Chi nhánh, bỏ qua bước này.")
    } else {
      const db = await pg.readValues({ sheet: "USERS", c1: 0, c2: Infinity, r1: 1, r2: Infinity })
      const dh = db[0] || []
      const col = (h: string[], ...names: string[]) => h.findIndex((x) => names.some((n) => fold(x) === fold(n)))
      const sEmail = col(sh, "Email")
      const dEmail = col(dh, "Email")
      // Cột Supabase giữ giá trị mới hơn Sheet (đăng nhập sau khi chuyển sang Supabase)
      const keepFromDb = ["Mật Khẩu", "Lần Đăng Nhập Cuối"]
      const dbByEmail = new Map<string, string[]>()
      for (const r of db.slice(1)) if (r[dEmail]) dbByEmail.set(fold(r[dEmail]), r)
      const width = sh.length
      const out: string[][] = [sh.slice()]
      const seen = new Set<string>()
      for (const r of sheet.slice(1)) {
        if (!r.some((x) => String(x).trim())) continue
        const row = Array.from({ length: width }, (_, i) => r[i] ?? "")
        const e = fold(row[sEmail])
        const d = dbByEmail.get(e)
        if (d) {
          for (const name of keepFromDb) {
            const si = col(sh, name)
            const di = col(dh, name)
            if (si !== -1 && di !== -1 && d[di]) row[si] = d[di]
          }
        }
        if (e) seen.add(e)
        out.push(row)
      }
      // Tài khoản chỉ có trong Supabase (tạo sau khi chuyển) -> giữ lại
      for (const [e, d] of dbByEmail) {
        if (seen.has(e)) continue
        const row = sh.map((h) => {
          const di = col(dh, h)
          return di === -1 ? "" : d[di] ?? ""
        })
        out.push(row)
        console.log(`USERS: giữ tài khoản chỉ có trong Supabase: ${d[dEmail]}`)
      }
      const counts = out.slice(1).reduce<Record<string, number>>((a, r) => {
        const k = String(r[shBranch] || "").trim() || "(trống = DEV PỒ)"
        a[k] = (a[k] || 0) + 1
        return a
      }, {})
      console.log(`USERS: ${out.length - 1} tài khoản, cột Chi nhánh ở vị trí ${shBranch + 1}. Phân bổ:`, counts)
      if (APPLY) {
        await pg.importSheet("USERS", out)
        changedTabs.push("USERS")
        console.log("USERS: đã cập nhật Supabase theo bố cục mới của Google Sheet.")
      }
    }
  }

  /* ---------------- 2. Cột Chi Nhánh cho các bảng ---------------- */
  const existing = await pg.listSheets()
  for (const tab of BRANCH_TABS) {
    const real = existing.find((t) => t.toLowerCase() === tab.toLowerCase())
    if (!real) {
      console.log(`${tab}: chưa có bảng, bỏ qua (bảng mới sẽ tự có cột khi tạo).`)
      continue
    }
    const meta = (await pool.query(`select tbl, columns, headers from _sheet_meta where sheet = $1`, [real])).rows[0]
    let pos = (meta.headers as string[]).findIndex((h) => isBranchColumn(h))
    const lastHeader = (() => {
      let n = meta.headers.length
      while (n > 0 && !String(meta.headers[n - 1] || "").trim()) n--
      return n
    })()
    if (pos === -1) {
      console.log(`${tab}: thêm cột "Chi Nhánh" ở cột thứ ${lastHeader + 1}`)
      if (APPLY) {
        const { indexToCol } = await import("../lib/sheet-store/a1")
        await pg.updateValues(`'${real}'!${indexToCol(lastHeader)}1`, [["Chi Nhánh"]])
      }
      pos = lastHeader
    }
    if (!APPLY) {
      const total = (await pool.query(`select count(*)::int as n from ${qi(meta.tbl)} where _row >= 2`)).rows[0].n
      console.log(`${tab}: ${total} dòng sẽ được gán "${DEV}" nếu chưa có chi nhánh`)
      continue
    }
    const fresh = (await pool.query(`select tbl, columns from _sheet_meta where sheet = $1`, [real])).rows[0]
    const cols = fresh.columns as string[]
    const bcol = cols[pos]
    const others = cols.filter((_, i) => i !== pos)
    const hasData = others.length ? `coalesce(${others.map((c) => `nullif(${qi(c)}, '')`).join(", ")}) is not null` : "true"
    const r = await pool.query(
      `update ${qi(fresh.tbl)} set ${qi(bcol)} = $1 where _row >= 2 and coalesce(${qi(bcol)}, '') = '' and ${hasData}`,
      [DEV],
    )
    console.log(`${tab}: gán "${DEV}" cho ${r.rowCount} dòng`)
    changedTabs.push(real)
  }

  if (APPLY && TO_SHEET && changedTabs.length) {
    const { exportPostgresToSheets } = await import("../lib/sheet-store/export-to-sheets")
    const res = await exportPostgresToSheets(changedTabs)
    console.log("Đã chép sang Google Sheet:", res.map((x) => `${x.tab} (${x.rows} dòng)`).join(", "))
  }

  await pool.end()
  await pg.closePool()
  console.log("Xong.")
}

main().catch((e) => {
  console.error("LỖI:", e?.message || e)
  process.exit(1)
})
