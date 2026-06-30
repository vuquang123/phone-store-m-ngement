// Quick-add phụ kiện cho từng máy trong giỏ (trang Bán hàng).
// Map loại phụ kiện (free-text trong sheet Phu_Kien) về 4 nhóm cố định và
// cung cấp helper thêm/bớt 1 đơn vị phụ kiện trên mảng giỏ hàng (pure).
import type { CartItem } from "@/lib/types/ban-hang"

export type QuickAccCategory = "cuong_luc" | "cu_sac" | "day_lightning" | "day_type_c" | "op_lung"

export interface QuickAccDef {
  key: QuickAccCategory
  label: string
  keywords: string[] // đã chuẩn hoá không dấu
}

// Thứ tự ưu tiên match: nhóm có từ khoá đặc trưng đứng trước.
export const QUICK_ACC_CATEGORIES: QuickAccDef[] = [
  { key: "cuong_luc", label: "Cường lực", keywords: ["cuong luc", "kinh cuong", "cuonglu", "dan man"] },
  { key: "cu_sac", label: "Củ sạc", keywords: ["cu sac", "coc sac", "adapter", "cu cap", "cusac"] },
  { key: "day_lightning", label: "Dây Lightning", keywords: ["lightning", "day lightning", "cap lightning"] },
  { key: "day_type_c", label: "Dây Type-C", keywords: ["type-c", "type c", "typec", "day type", "cap type"] },
  { key: "op_lung", label: "Ốp lưng", keywords: ["op lung", "oplung", "case", "bao da", "op "] },
]

export function normalizeVi(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
}

// Hậu tố model (max/pro/plus...) dùng để phân biệt 16 Pro vs 16 Pro Max.
const MODEL_QUALIFIERS = ["max", "plus", "pro", "mini", "ultra", "se", "promax"]
// Từ thương hiệu + từ chỉ phụ kiện cần loại khỏi tên để lấy phần "model lõi".
const NON_MODEL_WORDS = [
  "iphone", "ipad", "apple", "samsung", "galaxy",
  "op", "lung", "oplung", "cuong", "luc", "kinh", "dan", "man",
  "cu", "coc", "cap", "sac", "cusac", "capsac", "adapter", "cable", "day",
  "lightning", "type", "typec", "c", "usb", "micro",
  "case", "bao", "da", "phu", "kien", "chinh", "hang", "zin", "loai",
  "den", "trang", "do", "xanh", "tim", "vang", "hong", "bac", "xam", "titan", "titanium",
]

/** Lấy phần "model lõi" từ tên (vd "Ốp lưng iPhone 16 Pro Max" -> "16 pro max"). */
export function modelCore(name: string): string {
  let s = normalizeVi(name)
  s = s.replace(/\+/g, " plus ")
  // Tách số dính chữ: "16pro" -> "16 pro", "pro16" -> "pro 16"
  s = s.replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2")
  // Gộp biến thể ProMax/Pro Max -> "pro max"
  s = s.replace(/pro\s*max/g, "pro max")
  const tokens = s.split(/[^a-z0-9]+/).filter(Boolean)
  return tokens.filter((t) => !NON_MODEL_WORDS.includes(t)).join(" ").trim()
}

function findSeq(hay: string[], needle: string[]): number {
  if (needle.length === 0 || needle.length > hay.length) return -1
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) { ok = false; break }
    }
    if (ok) return i
  }
  return -1
}

/** Phụ kiện có hợp với model của máy không (16 Pro != 16 Pro Max). */
export function accessoryMatchesPhone(accName: string, phoneName: string): boolean {
  const phone = modelCore(phoneName)
  if (!phone) return true // không xác định được model máy -> không lọc
  const acc = modelCore(accName)
  if (!acc) return true // phụ kiện không gắn model (dùng chung) -> hợp mọi máy
  if (acc === phone) return true
  const pTokens = phone.split(" ")
  const aTokens = acc.split(" ")
  const at = findSeq(aTokens, pTokens)
  if (at === -1) return false
  // Token ngay sau cụm khớp không được là hậu tố model (tránh 16 Pro khớp 16 Pro Max)
  const nextTok = aTokens[at + pTokens.length]
  if (nextTok && MODEL_QUALIFIERS.includes(nextTok)) return false
  return true
}

/** Lọc danh sách phụ kiện 1 nhóm theo model của máy. */
export function filterAccessoriesForPhone(prods: QuickAccProduct[], phoneName: string): QuickAccProduct[] {
  return (prods || []).filter((p) => accessoryMatchesPhone(p.ten_san_pham, phoneName))
}

/** Phân loại 1 phụ kiện theo cột "Loại" (loai_phu_kien). Trả null nếu không thuộc 4 nhóm. */
export function categorizeAccessory(loaiPhuKien: string): QuickAccCategory | null {
  const n = ` ${normalizeVi(loaiPhuKien)} `
  if (!n.trim()) return null
  for (const cat of QUICK_ACC_CATEGORIES) {
    if (cat.keywords.some((k) => n.includes(k))) return cat.key
  }
  return null
}

export function parseNum(v: any): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return parseInt(v.replace(/[^\d]/g, ""), 10) || 0
  return 0
}

/** ID dòng phụ kiện trong giỏ — khớp với logic addToCart hiện có. */
export function accessoryLineId(prod: any): string {
  return prod.id || `${prod.ten_san_pham || prod.ten_phu_kien || ""}_${prod.loai_may || ""}`
}

export interface QuickAccProduct {
  id: string
  ten_san_pham: string
  loai_phu_kien: string
  gia_ban: number
  gia_nhap: number
  so_luong_ton: number
  mau_sac?: string
}

/** Chuẩn hoá danh sách phụ kiện thô (từ /api/phu-kien) thành QuickAccProduct + nhóm. */
export function buildQuickAccProduct(raw: any): QuickAccProduct {
  return {
    id: accessoryLineId(raw),
    ten_san_pham: raw.ten_san_pham || raw.ten_phu_kien || "",
    loai_phu_kien: raw.loai_phu_kien || "",
    gia_ban: parseNum(raw.gia_ban),
    gia_nhap: parseNum(raw.gia_nhap),
    so_luong_ton: parseNum(raw.so_luong_ton),
    mau_sac: raw.mau_sac || raw.mau || "",
  }
}

/** Gom phụ kiện theo nhóm. */
export function groupAccessoriesByCategory(
  rawAccessories: any[],
): Record<QuickAccCategory, QuickAccProduct[]> {
  const out: Record<QuickAccCategory, QuickAccProduct[]> = {
    cuong_luc: [],
    cu_sac: [],
    day_lightning: [],
    day_type_c: [],
    op_lung: [],
  }
  for (const raw of rawAccessories || []) {
    // "Loại" trong sheet có thể gộp (vd "Cáp sạc"), phần phân biệt nằm ở Tên Sản Phẩm
    // (Củ sạc / Dây Lightning / Dây Type-C) -> ghép cả 2 để phân loại.
    const text = `${raw.loai_phu_kien || ""} ${raw.ten_san_pham || raw.ten_phu_kien || ""}`
    const cat = categorizeAccessory(text)
    if (!cat) continue
    out[cat].push(buildQuickAccProduct(raw))
  }
  return out
}

/** Tổng số lượng 1 dòng phụ kiện (theo id) đang có trong giỏ. */
export function accessoryQtyInCart(cart: CartItem[], accId: string): number {
  const line = cart.find((i) => i.type === "accessory" && i.id === accId)
  return line?.so_luong || 0
}

/** Số đơn vị đã dùng trong giỏ cho cả 1 nhóm phụ kiện. */
export function categoryUnitsInCart(cart: CartItem[], category: QuickAccCategory): number {
  return cart.reduce((sum, i) => {
    if (i.type !== "accessory") return sum
    if (categorizeAccessory(i.loai_phu_kien || "") !== category) return sum
    return sum + (i.so_luong || 0)
  }, 0)
}

/** Thêm 1 đơn vị phụ kiện vào giỏ (tạo dòng nếu chưa có), tôn trọng tồn kho. Pure. */
export function addAccessoryUnit(cart: CartItem[], prod: QuickAccProduct): CartItem[] {
  const existing = cart.find((i) => i.type === "accessory" && i.id === prod.id)
  if (existing) {
    const max = existing.max_quantity || prod.so_luong_ton || 1
    if ((existing.so_luong || 0) >= max) return cart // hết tồn
    return cart.map((i) =>
      i.type === "accessory" && i.id === prod.id ? { ...i, so_luong: (i.so_luong || 0) + 1 } : i,
    )
  }
  if (prod.so_luong_ton <= 0) return cart
  const line: CartItem = {
    id: prod.id,
    type: "accessory",
    ten_san_pham: prod.ten_san_pham,
    gia_niemyet: prod.gia_ban,
    gia_ban: prod.gia_ban,
    gia_nhap: prod.gia_nhap,
    so_luong: 1,
    max_quantity: prod.so_luong_ton || 1,
    imei: "",
    trang_thai: "",
    loai_phu_kien: prod.loai_phu_kien,
    mau_sac: prod.mau_sac || "",
  }
  return [...cart, line]
}

/** Bớt 1 đơn vị phụ kiện (xoá dòng nếu về 0). Pure. */
export function removeAccessoryUnit(cart: CartItem[], accId: string): CartItem[] {
  const existing = cart.find((i) => i.type === "accessory" && i.id === accId)
  if (!existing) return cart
  if ((existing.so_luong || 0) <= 1) {
    return cart.filter((i) => !(i.type === "accessory" && i.id === accId))
  }
  return cart.map((i) =>
    i.type === "accessory" && i.id === accId ? { ...i, so_luong: (i.so_luong || 0) - 1 } : i,
  )
}
