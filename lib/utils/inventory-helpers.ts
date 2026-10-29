export function normalizeStatus(s?: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // "đ"/"Đ" KHÔNG phải dấu tổ hợp nên NFD không tách ra được -> phải map tay.
    // Thiếu dòng này thì mọi trạng thái bắt đầu bằng "Đ" ("Đang CNC", "Đã bán",
    // "Đã đặt cọc", "Giao đối tác") đều cho ra "đ..." và không khớp target nào.
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim()
}

export function isConHangStatus(s?: string) {
  return normalizeStatus(s) === "conhang"
}

export function isConHangProduct(p: any) {
  return isConHangStatus(p.trang_thai)
}

// Máy đang nằm ở xưởng CNC (độ sim) — vẫn bán được nhưng KHÔNG có sẵn tại kho,
// khách phải chờ. Dùng để gắn cảnh báo trong tin báo khách.
export function isDangCncStatus(s?: string) {
  return normalizeStatus(s) === "dangcnc"
}

export function isDangCncProduct(p: any) {
  return isDangCncStatus(p?.trang_thai)
}

// Máy được phép bán: "Còn hàng" hoặc "Đang CNC".
// So sánh sau khi bỏ dấu + viết thường vì Trạng Thái trong sheet hay bị gõ tay
// lệch hoa/thường ("Còn Hàng", "CÒN HÀNG"...) khiến so sánh chuỗi cứng trượt hết.
export function isSellableStatus(s?: string) {
  const n = normalizeStatus(s)
  return n === "conhang" || n === "dangcnc"
}

export function classifyCondition(p: any) {
  const text = `${p.tinh_trang || ""} ${p.ghi_chu || ""} ${p.loai_may || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  if (text.includes("cnc")) return "cnc"
  if (text.includes("nguyen") && text.includes("ban")) return "nguyen_ban"
  return "unknown"
}

export function getTrangThaiColor(status: string) {
  // Chuẩn hoá trước khi so (sheet gõ tay hay lệch hoa/thường: "Còn Hàng", "Đang cnc"...)
  switch (normalizeStatus(status)) {
    case "conhang": return "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
    case "dangcnc": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-red-400"
    case "baohanh": return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
    case "giaodoitac": return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400"
    case "dadatcoc": return "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
    case "daban": return "bg-muted text-muted-foreground"
    default: return "bg-muted text-muted-foreground"
  }
}

export function getTrangThaiKhoColor(status?: string) {
  const val = (status || "").toLowerCase()
  if (val.includes("không sẵn")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
}

function normLoai(loai?: string) {
  return (loai || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function isQuocTe(loai?: string) {
  const n = normLoai(loai)
  return n.includes("qte") || n.includes("qt") || n.includes("quoc te") || n.includes("quocte") || n.includes("quoc-te")
}

export function getLoaiMayLabel(loai?: string) {
  const raw = (loai || "").trim()
  if (!raw) return "-"
  const norm = normLoai(raw)
  if (norm.includes("lock")) return "Lock"
  if (isQuocTe(raw)) return "Qu\u1ed1c t\u1ebf"
  return raw
}

// Badge lo\u1ea1i m\u00e1y: Qu\u1ed1c t\u1ebf -> xanh l\u00e1, Lock -> v\u00e0ng (amber)
export function getLoaiMayBadgeClass(loai?: string) {
  const n = normLoai(loai)
  if (n.includes("lock")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-white border-transparent"
  if (isQuocTe(loai)) return "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400 border-transparent"
  return "bg-muted text-muted-foreground border-transparent"
}

// \u00d4 "Pin (%)" \u0111\u01b0\u1ee3c g\u00f5 tay n\u00ean trong sheet \u0111ang t\u1ed3n t\u1ea1i 5 d\u1ea1ng kh\u00e1c nhau:
//   "83"  "100"            -> ch\u1ec9 c\u00f3 % pin
//   "100/3L"  "96/42L"     -> % pin / s\u1ed1 l\u1ea7n s\u1ea1c
//   "100%/1L" "100%/74L"   -> nh\u01b0 tr\u00ean nh\u01b0ng c\u00f3 th\u00eam d\u1ea5u %
//   "100%162l" "100%58l"   -> C\u00d3 % nh\u01b0ng KH\u00d4NG c\u00f3 d\u1ea5u "/"  <-- d\u1ea1ng t\u1eebng g\u00e2y l\u1ed7i
//
// D\u1ea1ng cu\u1ed1i tr\u01b0\u1edbc \u0111\u00e2y r\u01a1i v\u00e0o nh\u00e1nh "b\u1ecf m\u1ecdi k\u00fd t\u1ef1 kh\u00f4ng ph\u1ea3i s\u1ed1" n\u00ean
// "100%171l" b\u1ecb d\u00ednh th\u00e0nh "100171" r\u1ed3i in ra "Pin 100171%" trong tin b\u00e1o kh\u00e1ch.
const PIN_RE = /^\s*(\d+(?:[.,]\d+)?)\s*%?\s*\/?\s*(\d+)?\s*[lL]?\s*$/

/** T\u00e1ch \u00f4 pin th\u00e0nh % s\u1ee9c kho\u1ebb v\u00e0 s\u1ed1 l\u1ea7n s\u1ea1c (`cycles` = null n\u1ebfu kh\u00f4ng ghi). */
export function parsePin(pin?: string | number): { health: number; cycles: number | null } {
  const s = String(pin ?? "").trim()
  if (!s) return { health: 0, cycles: null }
  const m = s.match(PIN_RE)
  if (!m) {
    // Kh\u00f4ng kh\u1edbp m\u1eabu n\u00e0o -> l\u1ea5y s\u1ed1 \u0111\u1ea7u ti\u00ean l\u00e0m % pin, kh\u00f4ng \u0111o\u00e1n s\u1ed1 l\u1ea7n s\u1ea1c.
    const first = s.match(/\d+(?:[.,]\d+)?/)
    return { health: first ? Number(first[0].replace(",", ".")) || 0 : 0, cycles: null }
  }
  return {
    health: Number(m[1].replace(",", ".")) || 0,
    cycles: m[2] ? Number(m[2]) : null,
  }
}

// Ph\u1ea7n "%" pin (s\u1ee9c kho\u1ebb) \u2014 d\u00f9ng cho ng\u01b0\u1ee1ng m\u00e0u.
export function parsePinHealth(pin?: string | number): number {
  return parsePin(pin).health
}

// Hi\u1ec3n th\u1ecb pin: "100%171l" / "100/171L" -> "100% (171L)" (L = l\u1ea7n s\u1ea1c);
// "93" -> "93%"; r\u1ed7ng -> "-".
export function formatPinDisplay(pin?: string | number): string {
  const s = String(pin ?? "").trim()
  if (!s) return "-"
  const { health, cycles } = parsePin(s)
  if (!health) return s
  return cycles !== null ? `${health}% (${cycles}L)` : `${health}%`
}

// M\u00e0u ch\u1eef pin theo % (s\u1ee9c kho\u1ebb): >=90 xanh l\u00e1, 80-89 v\u00e0ng, <80 \u0111\u1ecf
export function getPinColorClass(pin?: string | number) {
  const num = parsePinHealth(pin)
  if (num <= 0) return "text-muted-foreground"
  if (num >= 90) return "text-green-600 dark:text-green-400"
  if (num >= 80) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

// B\u1ea3n \u0111\u1ed3 m\u00e0u iPhone theo Apple (t\u00ean VN/EN -> hex \u0111\u1ea1i di\u1ec7n). Kh\u1edbp theo substring, \u01b0u ti\u00ean m\u1ee5c c\u1ee5 th\u1ec3 tr\u01b0\u1edbc.
const APPLE_COLORS: { keys: string[]; hex: string }[] = [
  { keys: ["product red", "do", "red"], hex: "#c8102e" },
  { keys: ["hong", "pink", "rose"], hex: "#f4b9c2" },
  { keys: ["tim", "purple"], hex: "#8e7cc3" },
  { keys: ["xanh duong", "xanh bien", "sierra", "pacific", "blue"], hex: "#3a6ea5" },
  { keys: ["xanh mong", "teal", "mong ket"], hex: "#2f9e9e" },
  { keys: ["xanh la", "xanh reu", "alpine", "midnight green", "green"], hex: "#3f8f5b" },
  { keys: ["cam", "desert", "orange"], hex: "#c08a5b" },
  { keys: ["vang dong", "natural titanium", "titan tu nhien", "natural"], hex: "#b6b2a9" },
  { keys: ["vang", "gold"], hex: "#e6cfa8" },
  { keys: ["bac", "silver"], hex: "#dcdde0" },
  { keys: ["trang", "white", "starlight", "anh sao"], hex: "#ededf0" },
  { keys: ["graphite", "space gray", "space grey", "xam", "gray", "grey"], hex: "#5b5a5e" },
  { keys: ["midnight", "nua dem", "den", "black"], hex: "#1d1d1f" },
]

export function getAppleColorHex(name?: string): string {
  const norm = (name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  if (!norm) return "#9ca3af"
  for (const c of APPLE_COLORS) {
    if (c.keys.some((k) => norm.includes(k))) return c.hex
  }
  return "#9ca3af"
}

export function extractPartnerInfo(note: string = "") {
  const match = note.match(/\[GiaoĐốiTác: (.*?)\]/)
  return match ? match[1] : "Chưa xác định"
}
