// lib/sheet-store/pg.ts
// "Động cơ" Postgres (Supabase) thay cho Google Sheets.
//
// Mỗi tab của Google Sheet là MỘT BẢNG Postgres cùng tên (vd bảng "Kho_Hang"), mỗi cột
// tiêu đề là một cột text cùng tên (vd "Giá Bán"), cột `_row` giữ số dòng như trên Sheet.
// Nhờ vậy:
//   * toàn bộ logic nghiệp vụ cũ (đọc theo tên cột, ghi theo ô "P5"...) chạy y nguyên;
//   * mở Supabase > Table Editor là thấy từng tab như Excel, sửa tay / nhập xuất CSV được;
//   * đọc/ghi mất vài chục ms thay vì 1-3 giây và không còn lỗi quota 429.
//
// Bảng `_sheet_meta` nhớ thứ tự cột (vị trí cột trên Sheet <-> tên cột trong bảng).
// Chỉ import file này ở server.
import { Pool, type PoolClient } from "pg"
import { indexToCol, parseA1, parseRef, type A1Range } from "./a1"

const META = "_sheet_meta"
const MAX_IDENT_BYTES = 63

type Meta = { sheet: string; tbl: string; columns: string[]; headers: string[] }

/* ------------------------------------------------------------------ pool */
const g = globalThis as any
function pool(): Pool {
  if (!g.__sheetStorePool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error("Thiếu DATABASE_URL (chuỗi kết nối Supabase)")
    g.__sheetStorePool = new Pool({
      connectionString,
      // Serverless: mỗi instance giữ ít kết nối; Supavisor (cổng 6543) lo phần còn lại.
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
    })
  }
  return g.__sheetStorePool as Pool
}

async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect()
  try {
    await c.query("begin")
    const out = await fn(c)
    await c.query("commit")
    return out
  } catch (e) {
    try { await c.query("rollback") } catch {}
    throw e
  } finally {
    c.release()
  }
}

/* ------------------------------------------------------------ identifiers */
export const qi = (name: string) => `"${String(name).replace(/"/g, '""')}"`

function truncateBytes(s: string, max = MAX_IDENT_BYTES): string {
  const buf = Buffer.from(s, "utf8")
  if (buf.length <= max) return s
  let out = s
  while (Buffer.byteLength(out, "utf8") > max) out = out.slice(0, -1)
  return out
}

/** Tên cột Postgres an toàn từ tiêu đề Sheet; trùng thì thêm " (2)", trống thì "col_X". */
function columnNameFor(header: string, position: number, taken: Set<string>): string {
  let base = String(header ?? "").trim()
  if (!base || base.startsWith("_")) base = `col_${indexToCol(position)}${base ? "_" + base : ""}`
  base = truncateBytes(base, MAX_IDENT_BYTES - 5)
  let name = base
  let n = 2
  while (taken.has(name.toLowerCase())) name = `${base} (${n++})`
  taken.add(name.toLowerCase())
  return name
}

export function tableNameFor(sheet: string): string {
  const s = truncateBytes(String(sheet).trim() || "sheet")
  return s.startsWith("_") ? `s${s}`.slice(0, MAX_IDENT_BYTES) : s
}

/* ------------------------------------------------------------- values in */
/** Chuyển giá trị code cũ gửi cho Sheets (valueInputOption RAW) thành text lưu DB. */
function toCell(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined // Sheets: null = bỏ qua ô này
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : ""
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "object") return JSON.stringify(v)
  const s = String(v)
  return s === "" ? null : s
}

/* ----------------------------------------------------------------- schema */
let schemaReady: Promise<void> | null = null
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool()
      .query(
        `create table if not exists ${META} (
           sheet text primary key,
           tbl text not null unique,
           columns text[] not null default '{}',
           headers text[] not null default '{}',
           updated_at timestamptz not null default now()
         );
         alter table ${META} enable row level security;
         create or replace function _sheet_row_default() returns trigger language plpgsql as $f$
         begin
           if new._row is null then
             execute format('select coalesce(max(_row), 1) + 1 from %I.%I', tg_table_schema, tg_table_name) into new._row;
           end if;
           new._updated_at := now();
           return new;
         end $f$;`,
      )
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null
        throw e
      })
  }
  return schemaReady
}


async function loadMeta(c: PoolClient | Pool, sheet: string, forUpdate = false): Promise<Meta | null> {
  const r = await c.query(
    // Google Sheets không phân biệt hoa/thường tên tab ("Hang_doi_tac" = "Hang_Doi_Tac")
    `select sheet, tbl, columns, headers from ${META} where lower(sheet) = lower($1)
     order by (sheet = $1) desc limit 1 ${forUpdate ? "for update" : ""}`,
    [sheet],
  )
  const m = r.rows[0] as Meta | undefined
  return m ?? null
}

// Luôn đọc meta mới (1 truy vấn rất nhỏ) để nhiều instance serverless không lệch cột nhau.
async function getMeta(sheet: string): Promise<Meta | null> {
  await ensureSchema()
  return loadMeta(pool(), sheet)
}

function missingSheetError(sheet: string) {
  const e = new Error(`Unable to parse range: ${sheet}`) as any
  e.code = 400
  return e
}

async function createSheetTable(c: PoolClient, sheet: string, headers: string[] = []): Promise<Meta> {
  const tbl = tableNameFor(sheet)
  const taken = new Set<string>()
  const columns = headers.map((h, i) => columnNameFor(h, i, taken))
  const colsSql = columns.map((cn) => `${qi(cn)} text`).join(", ")
  await c.query(
    `create table if not exists ${qi(tbl)} (
       _row integer primary key${colsSql ? ", " + colsSql : ""},
       _updated_at timestamptz not null default now()
     )`,
  )
  // Bật RLS (không policy): chặn truy cập qua API công khai của Supabase (anon key).
  // App và Table Editor dùng user "postgres" (chủ bảng) nên vẫn đọc/ghi bình thường.
  await c.query(`alter table ${qi(tbl)} enable row level security`)
  await c.query(
    `drop trigger if exists _row_default on ${qi(tbl)};
     create trigger _row_default before insert or update on ${qi(tbl)}
       for each row execute function _sheet_row_default();`,
  )
  await c.query(
    `insert into ${META} (sheet, tbl, columns, headers) values ($1, $2, $3, $4)
     on conflict (sheet) do update set tbl = excluded.tbl, columns = excluded.columns, headers = excluded.headers, updated_at = now()`,
    [sheet, tbl, columns, headers.map((h) => String(h ?? ""))],
  )
  const meta = { sheet, tbl, columns, headers: headers.map((h) => String(h ?? "")) }
  return meta
}

/** Đảm bảo bảng có ít nhất `count` cột (cột thừa không có tiêu đề -> "col_X"). */
async function ensureColumnCount(c: PoolClient, meta: Meta, count: number): Promise<Meta> {
  if (meta.columns.length >= count) return meta
  const taken = new Set(meta.columns.map((x) => x.toLowerCase()))
  const columns = [...meta.columns]
  const headers = [...meta.headers]
  for (let i = columns.length; i < count; i++) {
    const cn = columnNameFor("", i, taken)
    await c.query(`alter table ${qi(meta.tbl)} add column if not exists ${qi(cn)} text`)
    columns.push(cn)
    headers.push("")
  }
  await c.query(`update ${META} set columns = $2, headers = $3, updated_at = now() where sheet = $1`, [meta.sheet, columns, headers])
  const next = { ...meta, columns, headers }
  return next
}

/** Ghi dòng tiêu đề (dòng 1): đổi tên cột Postgres theo tiêu đề mới. */
async function writeHeader(c: PoolClient, meta: Meta, c1: number, cells: (string | null | undefined)[]): Promise<Meta> {
  meta = await ensureColumnCount(c, meta, c1 + cells.length)
  const headers = [...meta.headers]
  const columns = [...meta.columns]
  for (let j = 0; j < cells.length; j++) {
    const v = cells[j]
    if (v === undefined) continue
    const pos = c1 + j
    const text = v ?? ""
    if (headers[pos] === text) continue
    headers[pos] = text
    const taken = new Set(columns.filter((_, i) => i !== pos).map((x) => x.toLowerCase()))
    const wanted = columnNameFor(text, pos, taken)
    if (wanted !== columns[pos]) {
      await c.query(`alter table ${qi(meta.tbl)} rename column ${qi(columns[pos])} to ${qi(wanted)}`)
      columns[pos] = wanted
    }
  }
  await c.query(`update ${META} set columns = $2, headers = $3, updated_at = now() where sheet = $1`, [meta.sheet, columns, headers])
  const next = { ...meta, columns, headers }
  return next
}

async function lockSheet(c: PoolClient, sheet: string) {
  await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [`sheet:${sheet.toLowerCase()}`])
}

/** Khoá + nạp meta mới nhất trong transaction; tạo bảng nếu `create`. */
async function metaForWrite(c: PoolClient, sheet: string, create: boolean): Promise<Meta> {
  await ensureSchema()
  await lockSheet(c, sheet)
  const m = await loadMeta(c, sheet, true)
  if (m) return m
  if (!create) throw missingSheetError(sheet)
  return createSheetTable(c, sheet)
}

/* ------------------------------------------------------------------- read */
function trimRow(row: string[]): string[] {
  let end = row.length
  while (end > 0 && (row[end - 1] === "" || row[end - 1] == null)) end--
  return end === row.length ? row : row.slice(0, end)
}

/** Giống spreadsheets.values.get (FORMATTED_VALUE): mảng 2 chiều, bỏ ô/dòng trống ở cuối. */
export async function readValues(range: string | A1Range): Promise<string[][]> {
  const a = typeof range === "string" ? parseA1(range) : range
  const meta = await getMeta(a.sheet)
  if (!meta) throw missingSheetError(a.sheet)

  const lastCol = Math.min(a.c2, meta.columns.length - 1)
  const cols = meta.columns.slice(a.c1, lastCol + 1)
  const out: string[][] = []

  if (a.r1 <= 1) out.push(trimRow(meta.headers.slice(a.c1, lastCol + 1).map((h) => h ?? "")))
  const from = Math.max(a.r1, 2)
  if (a.r2 >= from && cols.length) {
    const params: any[] = [from]
    let where = `_row >= $1`
    if (Number.isFinite(a.r2)) {
      params.push(a.r2)
      where += ` and _row <= $2`
    }
    let res
    try {
      res = await pool().query({
        text: `select _row, ${cols.map(qi).join(", ")} from ${qi(meta.tbl)} where ${where} order by _row`,
        values: params,
        rowMode: "array",
      })
    } catch (e: any) {
      // Cột bị đổi tên tay trong Supabase -> nạp lại meta rồi thử lại 1 lần.
      if (e?.code === "42703" || e?.code === "42P01") {
        throw new Error(`Bảng "${meta.tbl}" bị đổi cấu trúc ngoài app (${e.message}). Kiểm tra lại cột trong Supabase.`)
      }
      throw e
    }
    let expected = from
    for (const r of res.rows as any[][]) {
      const rowNo = Number(r[0])
      while (expected < rowNo) {
        out.push([])
        expected++
      }
      out.push(trimRow(r.slice(1).map((v) => (v == null ? "" : String(v)))))
      expected = rowNo + 1
    }
  } else if (a.r1 <= 1 && !cols.length) {
    // bảng chưa có cột
  }
  while (out.length && out[out.length - 1].length === 0 && !(a.r1 <= 1 && out.length === 1)) out.pop()
  if (out.length === 1 && a.r1 <= 1 && out[0].length === 0) return []
  return out
}

/** UNFORMATTED_VALUE: chuỗi số -> number (dùng cho đọc tồn phụ kiện). */
export async function readValuesUnformatted(range: string): Promise<any[][]> {
  const rows = await readValues(range)
  return rows.map((row) =>
    row.map((v) => {
      const s = String(v).trim()
      if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
      if (s === "TRUE") return true
      if (s === "FALSE") return false
      return v
    }),
  )
}

/* ------------------------------------------------------------------ write */
async function writeRowCells(c: PoolClient, meta: Meta, rowNo: number, c1: number, cells: (string | null | undefined)[]) {
  const sets: string[] = []
  const vals: any[] = [rowNo]
  const insCols: string[] = ["_row"]
  for (let j = 0; j < cells.length; j++) {
    const v = cells[j]
    if (v === undefined) continue
    const cn = meta.columns[c1 + j]
    vals.push(v)
    insCols.push(qi(cn))
    sets.push(`${qi(cn)} = excluded.${qi(cn)}`)
  }
  if (!sets.length) return
  const ph = vals.map((_, i) => `$${i + 1}`).join(", ")
  await c.query(
    `insert into ${qi(meta.tbl)} (${insCols.join(", ")}) values (${ph})
     on conflict (_row) do update set ${sets.join(", ")}`,
    vals,
  )
}

async function writeGrid(c: PoolClient, meta: Meta, a: A1Range, values: any[][]): Promise<Meta> {
  const width = values.reduce((w, r) => Math.max(w, Array.isArray(r) ? r.length : 0), 0)
  meta = await ensureColumnCount(c, meta, a.c1 + width)
  for (let i = 0; i < values.length; i++) {
    const rowNo = a.r1 + i
    const cells = (Array.isArray(values[i]) ? values[i] : [values[i]]).map(toCell)
    if (rowNo === 1) meta = await writeHeader(c, meta, a.c1, cells)
    else await writeRowCells(c, meta, rowNo, a.c1, cells)
  }
  return meta
}

/** spreadsheets.values.update (RAW). Tạo bảng nếu chưa có. */
export async function updateValues(range: string, values: any[][]) {
  const a = parseA1(range)
  await withTx(async (c) => {
    const meta = await metaForWrite(c, a.sheet, true)
    await writeGrid(c, meta, a, values)
  })
}

export async function batchUpdateValues(items: Array<{ range: string; values: any[][] }>) {
  if (!items.length) return
  await withTx(async (c) => {
    const key = (s: string) => s.toLowerCase()
    const names = new Map<string, string>()
    for (const it of items) {
      const sh = parseA1(it.range).sheet
      if (!names.has(key(sh))) names.set(key(sh), sh)
    }
    const metas = new Map<string, Meta>()
    for (const k of Array.from(names.keys()).sort()) metas.set(k, await metaForWrite(c, names.get(k)!, true))
    for (const it of items) {
      const a = parseA1(it.range)
      metas.set(key(a.sheet), await writeGrid(c, metas.get(key(a.sheet))!, a, it.values))
    }
  })
}

async function lastDataRow(c: PoolClient, meta: Meta): Promise<number> {
  const r = await c.query(`select coalesce(max(_row), 1) as m from ${qi(meta.tbl)}`)
  return Number(r.rows[0].m)
}

/** spreadsheets.values.append: ghi nối sau dòng cuối có dữ liệu (có khoá, không đè nhau). */
export async function appendValues(sheet: string, rows: any[][]) {
  if (!rows.length) return
  await withTx(async (c) => {
    let meta = await metaForWrite(c, sheet, true)
    const start = (await lastDataRow(c, meta)) + 1
    meta = await writeGrid(c, meta, { sheet, c1: 0, c2: Infinity, r1: start, r2: Infinity }, rows)
  })
}

/** spreadsheets.values.clear */
async function clearIn(c: PoolClient, meta: Meta, a: A1Range) {
  const fullWidth = a.c1 === 0 && a.c2 >= meta.columns.length - 1
  const from = Math.max(a.r1, 2)
  const params: any[] = [from]
  let where = `_row >= $1`
  if (Number.isFinite(a.r2)) {
    params.push(a.r2)
    where += ` and _row <= $2`
  }
  if (fullWidth) {
    await c.query(`delete from ${qi(meta.tbl)} where ${where}`, params)
  } else {
    const cols = meta.columns.slice(a.c1, Math.min(a.c2, meta.columns.length - 1) + 1)
    if (cols.length) await c.query(`update ${qi(meta.tbl)} set ${cols.map((cn) => `${qi(cn)} = null`).join(", ")} where ${where}`, params)
  }
  if (a.r1 <= 1) {
    const blanks = meta.headers.slice(a.c1, Math.min(a.c2, meta.headers.length - 1) + 1).map(() => null)
    if (blanks.length) await writeHeader(c, meta, a.c1, blanks)
  }
}

export async function clearValues(range: string) {
  const a = parseA1(range)
  await withTx(async (c) => {
    const meta = await metaForWrite(c, a.sheet, false)
    await clearIn(c, meta, a)
  })
}

/** Xoá toàn bộ dữ liệu (giữ tiêu đề) rồi ghi lại — tất cả trong 1 transaction. */
export async function replaceValues(sheet: string, startRange: string, rows: any[][]) {
  await withTx(async (c) => {
    let meta = await metaForWrite(c, sheet, true)
    await c.query(`delete from ${qi(meta.tbl)} where _row >= 2`)
    if (rows.length) {
      meta = await writeGrid(c, meta, parseRef(sheet, startRange || "A2"), rows)
    }
  })
}

/** deleteDimension ROWS: xoá dòng và đẩy các dòng phía dưới lên (như Sheets). */
export async function deleteRows(sheet: string, startRow: number, count = 1) {
  if (startRow < 2 || count < 1) return
  await withTx(async (c) => {
    const meta = await metaForWrite(c, sheet, false)
    const end = startRow + count - 1
    await c.query(`delete from ${qi(meta.tbl)} where _row between $1 and $2`, [startRow, end])
    // 2 bước để không đụng khoá chính khi dời số dòng
    await c.query(`update ${qi(meta.tbl)} set _row = -(_row - $2) where _row > $1`, [end, count])
    await c.query(`update ${qi(meta.tbl)} set _row = -_row where _row < 0`)
  })
}

export async function sheetExists(sheet: string): Promise<boolean> {
  return (await getMeta(sheet)) !== null
}

export async function createSheet(sheet: string) {
  await withTx(async (c) => {
    await metaForWrite(c, sheet, true)
  })
}

export async function listSheets(): Promise<string[]> {
  await ensureSchema()
  const r = await pool().query(`select sheet from ${META} order by sheet`)
  return r.rows.map((x: any) => x.sheet)
}

/* --------------------------------------------------------- import (script) */
/** Tạo lại bảng của 1 tab từ dữ liệu lấy trên Sheets (dòng 0 = tiêu đề). */
export async function importSheet(sheet: string, values: any[][]) {
  const headers = (values[0] || []).map((h) => String(h ?? ""))
  const width = values.reduce((w, r) => Math.max(w, (r || []).length), headers.length)
  while (headers.length < width) headers.push("")
  await ensureSchema()
  await withTx(async (c) => {
    await lockSheet(c, sheet)
    const old = await loadMeta(c, sheet, true)
    if (old) await c.query(`drop table if exists ${qi(old.tbl)}`)
    else await c.query(`drop table if exists ${qi(tableNameFor(sheet))}`)
    await c.query(`delete from ${META} where sheet = $1`, [sheet])
    const meta = await createSheetTable(c, sheet, headers)
    const rows = values.slice(1)
    const BATCH = 200
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows
        .slice(i, i + BATCH)
        .map((r, k) => ({ rowNo: i + k + 2, cells: (r || []).map((v) => toCell(v) ?? null) }))
        .filter((x) => x.cells.some((v) => v !== null))
      if (!chunk.length) continue
      const cols = ["_row", ...meta.columns.map(qi)]
      const vals: any[] = []
      const tuples = chunk.map((x) => {
        const rowVals = [x.rowNo, ...meta.columns.map((_, j) => x.cells[j] ?? null)]
        const ph = rowVals.map((v) => {
          vals.push(v)
          return `$${vals.length}`
        })
        return `(${ph.join(", ")})`
      })
      await c.query(`insert into ${qi(meta.tbl)} (${cols.join(", ")}) values ${tuples.join(", ")}`, vals)
    }
  })
}

export async function closePool() {
  if (g.__sheetStorePool) {
    await (g.__sheetStorePool as Pool).end()
    g.__sheetStorePool = undefined
  }
}
