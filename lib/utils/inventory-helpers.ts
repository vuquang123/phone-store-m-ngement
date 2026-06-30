export function normalizeStatus(s?: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
  switch (status) {
    case "Còn hàng": return "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
    case "Đang CNC": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-red-400"
    case "Bảo hành": return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
    case "Giao đối tác": return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400"
    case "Đã đặt cọc": return "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
    case "Đã bán": return "bg-muted text-muted-foreground"
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

// Ph\u1ea7n "%" pin (s\u1ee9c kho\u1ebb): s\u1ed1 TR\u01af\u1edaC d\u1ea5u "/" n\u1ebfu c\u00f3 (vd "100/165" -> 100)
export function parsePinHealth(pin?: string | number): number {
  const first = String(pin ?? "").trim().split("/")[0]
  const num = Number(first.replace(/[^\d.]/g, ""))
  return Number.isFinite(num) ? num : 0
}

// Hi\u1ec3n th\u1ecb pin: "100/165" -> "100% (165L)" (L = l\u1ea7n s\u1ea1c); "93" -> "93%"; r\u1ed7ng -> "-"
export function formatPinDisplay(pin?: string | number): string { 
  const s = String(pin ?? "").trim()
  if (!s) return "-"
  if (s.includes("/")) {
    const [a, b] = s.split("/")
    const health = (a || "").replace(/[^\d.]/g, "")
    const cycles = (b || "").replace(/[^\d.]/g, "")
    if (health && cycles) return `${health}% (${cycles}L)`
    if (health) return `${health}%`
    return s
  }
  const n = s.replace(/[^\d.]/g, "")
  return n ? `${n}%` : s
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
