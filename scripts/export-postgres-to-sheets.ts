// scripts/export-postgres-to-sheets.ts
// Chép dữ liệu Supabase NGƯỢC về Google Sheet (ghi đè các tab trên Sheet).
// Dùng khi muốn sao lưu tay, hoặc trước khi quay lại chạy bằng Google Sheets.
//
//   pnpm db:export --yes                  # tất cả các tab
//   pnpm db:export --yes Kho_Hang Ban_Hang
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

async function main() {
  const args = process.argv.slice(2)
  if (!args.includes("--yes")) {
    console.log("Lệnh này GHI ĐÈ các tab trên Google Sheet bằng dữ liệu Supabase. Thêm --yes để chạy.")
    process.exit(1)
  }
  const only = args.filter((a) => !a.startsWith("--"))
  const { exportPostgresToSheets } = await import("../lib/sheet-store/export-to-sheets")
  const { closePool } = await import("../lib/sheet-store/pg")
  const res = await exportPostgresToSheets(only)
  console.table(res)
  await closePool()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
