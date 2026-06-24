// Helper tính tổng tiền thuần — tách từ app/dashboard/ban-hang/page.tsx (refactor thuần, GIỮ NGUYÊN hành vi).
import type { CartItem, WarrantyPackageUI } from "@/lib/types/ban-hang"

// Máy có đủ điều kiện gắn gói bảo hành hay không (chỉ phụ thuộc item — thuần).
export function isWarrantyEligible(item: CartItem): boolean {
  if (item.type !== 'product') return false
  const isPartner = String(item.nguon || item.source || '').toLowerCase().includes('kho ngoài')
  const isIpad = String(item.ten_san_pham || '').toLowerCase().includes('ipad') || String(item.loai_may || '').toLowerCase().includes('ipad')
  if (isIpad) {
    const hasId = !!(item.imei || item.serial)
    if (!hasId) return false
    if (isPartner && item.imei && !(item as any).imei_confirmed && !(item as any).imei_initial) return false
    return true
  }
  if (!isPartner) return !!item.imei
  return !!(item.imei && (((item as any).imei_confirmed) || ((item as any).imei_initial)))
}

// Tổng tiền hàng (chưa cộng phí bảo hành, chưa trừ giảm giá).
export function computeCartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.gia_ban * item.so_luong, 0)
}

// Tổng phí bảo hành theo gói đã chọn cho từng máy đủ điều kiện.
export function computeWarrantyTotal(
  cart: CartItem[],
  selectedWarranties: Record<string, string | null>,
  warrantyPackages: WarrantyPackageUI[],
): number {
  return cart.reduce((sum, i) => {
    if (!isWarrantyEligible(i)) return sum
    const key = (i.imei || i.serial || i.id) as string
    if (!key) return sum
    const code = selectedWarranties[key]
    if (!code) return sum
    const pkg = warrantyPackages.find(p => p.code === code)
    return sum + (pkg?.price || 0)
  }, 0)
}
