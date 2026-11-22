// scripts/dev-tools/clone-db.ts
// Sao chép dữ liệu Supabase sang 1 Postgres khác (vd Postgres trên máy để test).
//   DATABASE_URL=<nguồn> tsx scripts/dev-tools/clone-db.ts dump /tmp/ban-sao.json
//   DATABASE_URL=<đích>  tsx scripts/dev-tools/clone-db.ts load /tmp/ban-sao.json
// Chỉ ĐỌC ở bước dump. Bước load xoá và tạo lại các bảng ở database đích.
import { readFileSync, writeFileSync } from "node:fs"

async function main() {
  const [mode, file] = process.argv.slice(2)
  if (!file || !["dump", "load"].includes(mode)) throw new Error("Cách dùng: clone-db.ts dump|load <file.json>")
  const pg = await import("../../lib/sheet-store/pg")
  if (mode === "dump") {
    const out: Record<string, string[][]> = {}
    for (const t of await pg.listSheets()) out[t] = await pg.readValues({ sheet: t, c1: 0, c2: Infinity, r1: 1, r2: Infinity })
    writeFileSync(file, JSON.stringify(out))
    console.log(`Đã chép ${Object.keys(out).length} bảng ra ${file}`)
  } else {
    const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, string[][]>
    for (const [t, v] of Object.entries(data)) {
      await pg.importSheet(t, v)
      console.log(`${t}: ${Math.max(v.length - 1, 0)} dòng`)
    }
  }
  await pg.closePool()
}
main().catch((e) => {
  console.error("LỖI:", e?.message || e)
  process.exit(1)
})
