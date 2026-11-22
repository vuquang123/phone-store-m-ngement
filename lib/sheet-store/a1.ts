// lib/sheet-store/a1.ts
// Phân tích địa chỉ kiểu Google Sheets ("'Kho_Hang'!P5:Q7", "Ban_Hang!A2", "USERS")
// để lớp Postgres hiểu được các lệnh đọc/ghi mà code cũ đang gửi cho Sheets.

export type A1Range = {
  sheet: string
  /** cột bắt đầu, đếm từ 0 */
  c1: number
  /** cột kết thúc (bao gồm), đếm từ 0; Infinity = tới hết */
  c2: number
  /** dòng bắt đầu, đếm từ 1 như Sheets (dòng 1 = tiêu đề) */
  r1: number
  /** dòng kết thúc (bao gồm); Infinity = tới hết */
  r2: number
}

export function colToIndex(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function indexToCol(index: number): string {
  let n = index + 1
  let s = ""
  while (n > 0) {
    const mod = (n - 1) % 26
    s = String.fromCharCode(65 + mod) + s
    n = Math.floor((n - mod) / 26)
  }
  return s
}

/** Tách "'Tên sheet'!A1:B2" -> { sheet, ref }. Không có "!" thì cả chuỗi là tên sheet. */
export function splitSheetRef(range: string): { sheet: string; ref: string } {
  const s = String(range || "").trim()
  const m = s.match(/^'((?:[^']|'')*)'(?:!(.*))?$/)
  if (m) return { sheet: m[1].replace(/''/g, "'"), ref: (m[2] || "").trim() }
  const bang = s.lastIndexOf("!")
  if (bang === -1) return { sheet: s, ref: "" }
  return { sheet: s.slice(0, bang), ref: s.slice(bang + 1).trim() }
}

function parseCell(cell: string): { c?: number; r?: number } {
  const m = cell.trim().toUpperCase().match(/^\$?([A-Z]*)\$?(\d*)$/)
  if (!m) throw new Error(`Địa chỉ ô không hợp lệ: ${cell}`)
  return {
    c: m[1] ? colToIndex(m[1]) : undefined,
    r: m[2] ? Number(m[2]) : undefined,
  }
}

/** Phân tích phần sau dấu "!" (vd "A1:ZZ10000", "P5", "A:C", "2:2"). */
export function parseRef(sheet: string, ref: string): A1Range {
  if (!ref) return { sheet, c1: 0, c2: Infinity, r1: 1, r2: Infinity }
  const [a, b] = ref.split(":")
  const p1 = parseCell(a)
  const p2 = b !== undefined ? parseCell(b) : p1
  return {
    sheet,
    c1: p1.c ?? 0,
    c2: b === undefined ? (p1.c ?? Infinity) : (p2.c ?? Infinity),
    r1: p1.r ?? 1,
    r2: b === undefined ? (p1.r ?? Infinity) : (p2.r ?? Infinity),
  }
}

export function parseA1(range: string): A1Range {
  const { sheet, ref } = splitSheetRef(range)
  return parseRef(sheet, ref)
}
