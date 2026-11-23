// lib/client/doc-bang-tinh.ts
// Đọc file Excel (.xlsx) hoặc CSV ngay trên trình duyệt, không cần thư viện ngoài:
// .xlsx là file zip chứa XML -> giải nén bằng DecompressionStream rồi đọc sheet đầu tiên.
// Trả về mảng các hàng, mỗi hàng là mảng chuỗi.

async function giaiNen(data: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return data
  if (method !== 8) throw new Error("File Excel nén kiểu lạ, hãy lưu lại bằng Excel/Google Sheets rồi thử lại")
  const ds = new DecompressionStream("deflate-raw")
  const out = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

async function docZip(buf: ArrayBuffer): Promise<Map<string, () => Promise<Uint8Array>>> {
  const v = new DataView(buf)
  const u8 = new Uint8Array(buf)
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("Không đọc được file. Hãy chọn file .xlsx hoặc .csv")
  const soMuc = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const td = new TextDecoder()
  const files = new Map<string, () => Promise<Uint8Array>>()
  for (let n = 0; n < soMuc; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break
    const method = v.getUint16(p + 10, true)
    const nen = v.getUint32(p + 20, true)
    const dt = v.getUint16(p + 28, true)
    const ex = v.getUint16(p + 30, true)
    const cm = v.getUint16(p + 32, true)
    const off = v.getUint32(p + 42, true)
    const ten = td.decode(u8.subarray(p + 46, p + 46 + dt))
    files.set(ten, async () => {
      const ln = v.getUint16(off + 26, true)
      const le = v.getUint16(off + 28, true)
      const s = off + 30 + ln + le
      return giaiNen(u8.subarray(s, s + nen), method)
    })
    p += 46 + dt + ex + cm
  }
  return files
}

const xml = async (files: Map<string, () => Promise<Uint8Array>>, ten: string) => {
  const f = files.get(ten)
  if (!f) return null
  return new DOMParser().parseFromString(new TextDecoder().decode(await f()), "application/xml")
}
const theo = (doc: Document | Element, ten: string) => Array.from(doc.getElementsByTagName(ten))
const cotSo = (ref: string) => {
  const m = ref.match(/^[A-Z]+/)
  if (!m) return -1
  let n = 0
  for (const ch of m[0]) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
/** Số lớn (IMEI) đôi khi lưu dạng 3.59969125998479E+14 -> đổi về chuỗi chữ số đầy đủ. */
const soThanhChuoi = (s: string) => {
  if (!/e/i.test(s)) return s
  const n = Number(s)
  return Number.isFinite(n) ? n.toLocaleString("fullwide", { useGrouping: false, maximumFractionDigits: 10 }) : s
}

export async function docXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await docZip(buf)
  // sheet đầu tiên theo workbook.xml
  let duongDan = "xl/worksheets/sheet1.xml"
  const wb = await xml(files, "xl/workbook.xml")
  const rels = await xml(files, "xl/_rels/workbook.xml.rels")
  const sheet0 = wb ? theo(wb, "sheet")[0] : undefined
  if (sheet0 && rels) {
    const rid = sheet0.getAttribute("r:id") || sheet0.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
    const rel = theo(rels, "Relationship").find((r) => r.getAttribute("Id") === rid)
    const t = rel?.getAttribute("Target")
    if (t) duongDan = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`
  }
  if (!files.has(duongDan)) duongDan = [...files.keys()].find((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)) || duongDan
  const ss = await xml(files, "xl/sharedStrings.xml")
  const chuoi = ss ? theo(ss, "si").map((si) => theo(si, "t").map((t) => t.textContent || "").join("")) : []
  const sh = await xml(files, duongDan)
  if (!sh) throw new Error("File Excel không có trang tính nào")
  const hang: string[][] = []
  for (const row of theo(sh, "row")) {
    const r = Number(row.getAttribute("r")) - 1
    const out: string[] = []
    let i = 0
    for (const c of theo(row, "c")) {
      const ref = c.getAttribute("r")
      const ci = ref ? cotSo(ref) : i
      const t = c.getAttribute("t")
      const vEl = theo(c, "v")[0]
      let val = ""
      if (t === "s") val = chuoi[Number(vEl?.textContent)] ?? ""
      else if (t === "inlineStr") val = theo(c, "t").map((x) => x.textContent || "").join("")
      else val = soThanhChuoi(vEl?.textContent ?? "")
      out[ci] = val.trim()
      i = ci + 1
    }
    hang[r >= 0 ? r : hang.length] = Array.from(out, (x) => x ?? "")
  }
  return Array.from(hang, (x) => x ?? [])
}

/** CSV (phẩy hoặc chấm phẩy) hoặc dữ liệu dán từ Excel (tab). */
export function docCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "")
  const dongDau = t.split(/\r?\n/)[0] || ""
  const sep = dongDau.includes("\t") ? "\t" : (dongDau.match(/;/g) || []).length > (dongDau.match(/,/g) || []).length ? ";" : ","
  const out: string[][] = []
  let row: string[] = []
  let cell = ""
  let q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) {
      row.push(cell.trim())
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++
      row.push(cell.trim())
      out.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell.trim())
    out.push(row)
  }
  return out
}

export async function docFileBang(file: File): Promise<string[][]> {
  if (/\.xls$/i.test(file.name)) throw new Error("File .xls đời cũ chưa đọc được. Mở bằng Excel rồi lưu thành .xlsx (hoặc tải về dạng .xlsx từ Google Sheets)")
  if (/\.(csv|txt|tsv)$/i.test(file.name)) return docCsv(await file.text())
  return docXlsx(await file.arrayBuffer())
}
