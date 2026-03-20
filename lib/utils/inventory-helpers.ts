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
    case "Còn hàng": return "bg-green-100 text-green-700"
    case "Đang CNC": return "bg-yellow-100 text-yellow-700"
    case "Bảo hành": return "bg-red-100 text-red-700"
    case "Giao đối tác": return "bg-purple-100 text-purple-700"
    default: return "bg-gray-100 text-gray-700"
  }
}

export function getTrangThaiKhoColor(status?: string) {
  const val = (status || "").toLowerCase()
  if (val.includes("không sẵn")) return "bg-amber-100 text-amber-700"
  return "bg-emerald-100 text-emerald-700"
}

export function getLoaiMayLabel(loai?: string) {
  const raw = (loai || "").trim()
  if (!raw) return "-"
  const norm = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  if (norm.includes("lock")) return "Lock"
  if (norm.includes("qte") || norm.includes("qt") || norm.includes("quoc te") || norm.includes("quocte") || norm.includes("quoc-te")) return "QTE"
  return raw
}
