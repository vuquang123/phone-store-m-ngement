// Chuẩn hoá cách viết Tên máy / Dung lượng / Màu sắc (dùng chung client + server).
//
// Quy ước (chủ shop chốt 25/11/2026):
//   - Dung lượng: số + dấu cách + đơn vị: "32 GB", "256 GB", "1 TB".
//     Số trơn: 1, 2 -> TB; 16/32/64/128/256/512 -> GB. Giá trị lạ (vd "72929") giữ nguyên.
//   - iPhone: "iPhone <số> <hậu tố>": "iPhone 16 ProMax", "iPhone 16 Pro", "iPhone 15 Plus",
//     "iPhone 13 mini", "iPhone 16e". 16PM / 16 pro max / 16promax / ip16prm -> "iPhone 16 ProMax".
//   - iPad: "iPad Gen 7", "iPad Air 5", "iPad mini 5", "iPad Pro 12.9 2020" (giữ đuôi như "MDM").
//   - Tên không khớp mẫu nào: chỉ bỏ khoảng trắng thừa, KHÔNG đoán.
//   - Tên kèm dung lượng/màu ("iPhone 15 ProMax 256GB - Blue Titanium"): chỉ sửa cách viết bên trong.

/** Cách viết Pro Max. Đổi ở đây là đổi toàn hệ thống. */
export const PRO_MAX = "ProMax"

const gon = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim()

const GB_TRON = new Set([16, 32, 64, 128, 256, 512])
const TB_TRON = new Set([1, 2])

/** "256GB" | "256" | " 256gb " | "1tb" -> "256 GB" / "1 TB". Giá trị lạ giữ nguyên (chỉ gọn khoảng trắng). */
export function chuanDungLuong(v: unknown): string {
  const s = gon(v)
  if (!s) return ""
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(gb|g|tb|t)?$/i)
  if (!m) return s
  const so = Number(m[1].replace(",", "."))
  const dv = (m[2] || "").toLowerCase()
  if (dv.startsWith("t")) return `${m[1]} TB`
  if (dv.startsWith("g")) return `${m[1]} GB`
  if (TB_TRON.has(so)) return `${so} TB`
  if (GB_TRON.has(so)) return `${so} GB`
  return s
}

/** Sửa dung lượng nằm lẫn trong chuỗi: "128GB - Black" -> "128 GB - Black". */
function suaDungLuongTrongChuoi(s: string): string {
  return s.replace(/\b(\d+)\s*(gb|tb)\b/gi, (_, n, u) => `${n} ${String(u).toUpperCase()}`)
}

const MA_MAU: Record<string, string> = {
  sil: "Silver",
  cos: "Cosmic Orange",
  des: "Desert Titanium",
  nat: "Natural Titanium",
  ultra: "Ultramarine",
}

/** Mã màu viết tắt của đầu hàng (đúng mã) -> tên đầy đủ; còn lại chỉ gọn khoảng trắng. */
export function chuanMau(v: unknown): string {
  const s = gon(v)
  return MA_MAU[s.toLowerCase()] ?? s
}

// ---------------------------------------------------------------- iPhone
function hauToIphone(rest: string): { hauTo: string; con: string } | null {
  const r = rest
  const thu = (re: RegExp, ten: string) => {
    const m = r.match(re)
    return m ? { hauTo: ten, con: r.slice(m[0].length) } : null
  }
  return (
    thu(/^(?:pro\s*max|promax|prm|pm)(?![a-z])/i, PRO_MAX) ||
    thu(/^pro(?![a-z])/i, "Pro") ||
    thu(/^(?:plus(?![a-z])|\+)/i, "Plus") ||
    thu(/^mini(?![a-z])/i, "mini") ||
    thu(/^air(?![a-z])/i, "Air") ||
    thu(/^e(?![a-z])/i, "e")
  )
}

function chuanIphone(s: string, soTronLaIphone = false): string | null {
  // "iPhone 16 Pro", "iphone16pro", "IP16PM", "16PM" (số trơn phải có hậu tố mới coi là iPhone)
  const coTien = s.match(/^(?:i\s?phone|ip(?!ad))\s*(\d{1,2})(?!\d)\s*(.*)$/i)
  const tron = coTien ? null : s.match(/^(\d{1,2})(?!\d)\s*(.*)$/)
  const m = coTien || tron
  if (!m) {
    // "iphone Air", "IPhone Xs Max": chỉ sửa chữ "iPhone"
    const m2 = s.match(/^i\s?phone\b\s*(.*)$/i)
    if (m2) return gon(`iPhone ${suaDungLuongTrongChuoi(m2[1])}`)
    return null
  }
  const so = Number(m[1])
  if (so < 6 || so > 30) return null
  const ht = hauToIphone(m[2])
  if (tron && !ht && !soTronLaIphone) return null // "14", "13" trơn: không đoán (trừ file Excel đầu hàng)
  let ten: string
  let con = ht ? ht.con : m[2]
  if (!ht) ten = `iPhone ${so}`
  else if (ht.hauTo === "e") ten = `iPhone ${so}e`
  else if (ht.hauTo === "Air" && so === 17) ten = "iPhone Air"
  else ten = `iPhone ${so} ${ht.hauTo}`
  // "Pro" rồi tới "Max" tách rời phía sau đã được bắt ở pro\s*max; phần còn lại giữ nguyên.
  con = suaDungLuongTrongChuoi(gon(con))
  return gon(`${ten} ${con}`)
}

// ---------------------------------------------------------------- iPad
const NAM_PRO: Record<string, Record<number, number>> = {
  "12.9": { 1: 2015, 2: 2017, 3: 2018, 4: 2020, 5: 2021, 6: 2022 },
  "11": { 1: 2018, 2: 2020, 3: 2021, 4: 2022 },
  "10.5": { 1: 2017 },
  "9.7": { 1: 2016 },
}

function chuanIpadPro(rest: string): string {
  let r = ` ${rest} `
  let size = ""
  const ms = r.match(/\s(12[.,]9|11|10[.,]5|9[.,]7)\s*(?:-?\s*inch|"|”|in)?(?=[\s(])/i)
  if (ms) {
    size = ms[1].replace(",", ".")
    r = r.replace(ms[0], " ")
  }
  let nam = 0
  const my = r.match(/\b(20[12]\d)\b/)
  if (my) {
    nam = Number(my[1])
    r = r.replace(my[0], " ")
  }
  let gen = 0
  const mg = r.match(/\(?\s*(\d)\s*(?:st|nd|rd|th)\s*(?:gen(?:eration)?)?\s*\)?/i) || r.match(/\bgen\s*(\d)\b/i)
  if (mg) {
    gen = Number(mg[1])
    r = r.replace(mg[0], " ")
  }
  if (!nam && size && gen && NAM_PRO[size]?.[gen]) nam = NAM_PRO[size][gen]
  if (!nam && size && !gen && Object.keys(NAM_PRO[size] || {}).length === 1) nam = NAM_PRO[size][1]
  // Chip M1/M2 suy ra được từ năm -> bỏ khi đã có năm
  if (nam) r = r.replace(/\bM\d\b/i, " ")
  r = r.replace(/\binch\b/gi, " ").replace(/[()]/g, " ")
  const con = suaDungLuongTrongChuoi(gon(r))
  return gon(["iPad Pro", size, nam || "", con].filter(Boolean).join(" "))
}

function chuanIpad(s: string): string | null {
  const m = s.match(/^i\s?pad\b\s*(.*)$/i)
  if (!m) return null
  const rest = gon(m[1])
  const the = (re: RegExp) => rest.match(re)
  const thuTu = String.raw`(?:\(\s*(\d{1,2})\s*(?:st|nd|rd|th)\s*gen(?:eration)?\s*\)|(\d{1,2})\s*(?:st|nd|rd|th)(?:\s*gen(?:eration)?)?|gen\s*(\d{1,2})|(\d{1,2}))(?![\d.])(?!\s*-?\s*(?:inch|"))`
  const lay = (mm: RegExpMatchArray) => mm[1] || mm[2] || mm[3] || mm[4]

  // Đời có chip: "iPad Air 13-inch (M4)" -> "iPad Air 13 M4", "iPad Pro 11-inch (M5)" -> "iPad Pro 11 M5"
  const chip = rest.match(/^(air|pro)\s*(13|11|12[.,]9|10[.,]9)\s*(?:-?\s*inch|")?\s*\(?\s*(m\d)\s*\)?\s*(.*)$/i)
  if (chip) {
    const dong = chip[1].toLowerCase() === "air" ? "Air" : "Pro"
    return gon(`iPad ${dong} ${chip[2].replace(",", ".")} ${chip[3].toUpperCase()} ${suaDungLuongTrongChuoi(chip[4])}`)
  }
  if (/^pro\b/i.test(rest)) return chuanIpadPro(rest.replace(/^pro\b/i, ""))
  let mm = the(new RegExp(`^air\\s*${thuTu}\\s*(.*)$`, "i"))
  if (mm) return gon(`iPad Air ${lay(mm)} ${suaDungLuongTrongChuoi(mm[5])}`)
  mm = the(new RegExp(`^mini\\s*${thuTu}\\s*(.*)$`, "i"))
  if (mm) return gon(`iPad mini ${lay(mm)} ${suaDungLuongTrongChuoi(mm[5])}`)
  mm = the(new RegExp(`^${thuTu}\\s*(.*)$`, "i"))
  if (mm) return gon(`iPad Gen ${lay(mm)} ${suaDungLuongTrongChuoi(mm[5])}`)
  if (/^air\b/i.test(rest)) return gon(`iPad Air ${suaDungLuongTrongChuoi(rest.slice(3))}`)
  if (/^mini\b/i.test(rest)) return gon(`iPad mini ${suaDungLuongTrongChuoi(rest.slice(4))}`)
  return gon(`iPad ${suaDungLuongTrongChuoi(rest)}`)
}

/**
 * Chuẩn hoá tên máy. Không khớp mẫu nào thì chỉ gọn khoảng trắng.
 * `soTronLaIphone`: coi số trơn ("16", "15") là iPhone — chỉ bật cho file Excel của đầu hàng,
 * nơi cột Tên chắc chắn là đời iPhone.
 */
export function chuanTenMay(v: unknown, opts?: { soTronLaIphone?: boolean }): string {
  const s = gon(v)
  if (!s) return ""
  return chuanIpad(s) ?? chuanIphone(s, !!opts?.soTronLaIphone) ?? s
}

const gonSach = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, "")

/**
 * Tìm kiếm tên máy không phụ thuộc cách viết: "16 pro max", "16promax", "16pm"
 * đều khớp "iPhone 16 ProMax"; "256gb" khớp "256 GB".
 */
export function khopTenMay(ten: unknown, q: unknown): boolean {
  const t = gonSach(ten)
  const a = gonSach(q)
  if (!a) return true
  if (t.includes(a)) return true
  const b = gonSach(chuanTenMay(q))
  return !!b && b !== a && t.includes(b)
}
