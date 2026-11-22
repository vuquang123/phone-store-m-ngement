// Vai trò người dùng (cột "Vai Trò" trong USERS).
// - chu_shop: chủ shop, có mọi quyền của quản lý + xem Tổng quan (doanh thu, công nợ).
// - quan_ly: quản lý.
// - nhan_vien: nhân viên.
export type Role = "chu_shop" | "quan_ly" | "nhan_vien"

const norm = (r: unknown) => String(r ?? "").trim().toLowerCase()

/** Chủ shop hoặc quản lý: dùng cho mọi chỗ trước đây kiểm tra role === "quan_ly". */
export function isManagerRole(role: unknown) {
  const r = norm(role)
  return r === "quan_ly" || r === "chu_shop"
}

export function isOwnerRole(role: unknown) {
  return norm(role) === "chu_shop"
}

export function roleLabel(role: unknown) {
  const r = norm(role)
  if (r === "chu_shop") return "Chủ shop"
  if (r === "quan_ly") return "Quản lý"
  if (r === "nhan_vien") return "Nhân viên"
  return r || "Nhân viên"
}
