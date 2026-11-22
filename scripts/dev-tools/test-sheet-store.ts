// Kiểm thử lớp Postgres (lib/sheet-store) — CHỈ chạy với database thử ở máy (localhost),
// vì script tạo/ghi bảng "Test_Sheet" và đọc "Kho_Hang".
//   DATABASE_URL=postgres://postgres@localhost:5432/postgres pnpm exec tsx scripts/dev-tools/test-sheet-store.ts
import assert from "node:assert"
process.env.DATA_BACKEND = "postgres"
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "")) {
  console.error("Chỉ chạy với DATABASE_URL trỏ tới localhost.")
  process.exit(1)
}
async function main() {
  const gs = await import("../../lib/google-sheets")
  const S = "Test_Sheet"
  await gs.ensureSheetHeader(S, ["ID", "Tên", "Giá", "Trạng Thái", "Trạng Thái"])
  let d = await gs.readFromGoogleSheets(S)
  assert.deepStrictEqual(d.header, ["ID", "Tên", "Giá", "Trạng Thái", "Trạng Thái"])
  assert.deepStrictEqual(d.rows, [])
  await gs.appendToGoogleSheets(S, ["A1", "iPhone", 1000, true])
  await gs.appendMultipleToGoogleSheets(S, [["A2", "iPad", "", null, "Kho trong"], ["A3", "Mac"]])
  d = await gs.readFromGoogleSheets(S)
  assert.deepStrictEqual(d.rows, [["A1", "iPhone", "1000", "TRUE"], ["A2", "iPad", "", "", "Kho trong"], ["A3", "Mac"]])
  await gs.updateRangeValues(`'${S}'!C3`, [["2.000.000 đ"]])
  await gs.updateRangeValues(`${S}!A6:B6`, [["A5", "gap"]])
  d = await gs.readFromGoogleSheets(S)
  assert.deepStrictEqual(d.rows[1], ["A2", "iPad", "2.000.000 đ", "", "Kho trong"])
  assert.deepStrictEqual(d.rows[3], [])
  assert.deepStrictEqual(d.rows[4], ["A5", "gap"])
  const idx = await gs.ensureColumn(S, "Ghi chú")
  assert.strictEqual(idx, 5)
  await gs.batchUpdateRangeValues([{ range: `'${S}'!F2`, values: [["note"]] }, { range: `'${S}'!G7`, values: [["beyond"]] }])
  d = await gs.readFromGoogleSheets(S)
  assert.strictEqual(d.header[5], "Ghi chú")
  assert.deepStrictEqual(d.rows[0], ["A1", "iPhone", "1000", "TRUE", "", "note"])
  assert.deepStrictEqual(d.rows[5], ["", "", "", "", "", "", "beyond"])
  const fresh = await gs.readRangeValuesFresh(`'${S}'!C2:C3`)
  assert.deepStrictEqual(fresh, [[1000], ["2.000.000 đ"]])
  await gs.deleteSheetRows(S, 3, 1)
  d = await gs.readFromGoogleSheets(S)
  assert.deepStrictEqual(d.rows.map((r) => r[0] || ""), ["A1", "A3", "", "A5", ""])
  await gs.appendToGoogleSheets(S, ["A9"])
  d = await gs.readFromGoogleSheets(S)
  assert.strictEqual(d.rows[d.rows.length - 1][0], "A9")
  await gs.syncToGoogleSheets(S, [["X1", "only"], ["X2"]])
  d = await gs.readFromGoogleSheets(S)
  assert.deepStrictEqual(d.rows, [["X1", "only"], ["X2"]])
  const part = await gs.readFromGoogleSheets(S, "A1:B2")
  assert.deepStrictEqual(part, { header: ["ID", "Tên"], rows: [["X1", "only"]] })
  // concurrent appends do not overwrite each other
  await Promise.all(Array.from({ length: 10 }, (_, i) => gs.appendToGoogleSheets(S, [`C${i}`])))
  d = await gs.readFromGoogleSheets(S)
  assert.strictEqual(d.rows.length, 12)
  let err = ""
  try { await gs.readFromGoogleSheets("Khong_Ton_Tai", undefined, { silent: true }) } catch (e: any) { err = e.message }
  assert.match(err, /Unable to parse range/)
  // real data sample
  const kho = await gs.readFromGoogleSheets("Kho_Hang")
  console.log("Kho_Hang header:", kho.header.slice(0, 6), "rows", kho.rows.length)
  console.log("ALL OK")
  const pg = await import("../../lib/sheet-store/pg"); await pg.closePool()
}
main().catch((e) => { console.error(e); process.exit(1) })
