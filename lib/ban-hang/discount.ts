// Helper giảm giá thuần — tách từ app/dashboard/ban-hang/page.tsx (refactor thuần, GIỮ NGUYÊN hành vi).
//
// LƯU Ý: tồn tại HAI parser khác nhau trong logic gốc và CHỦ ĐÍCH giữ nguyên khác biệt:
//  - parseDiscount: dùng cho commit/apply nhanh, hỗ trợ đơn vị "k" và "m".
//  - computeDynamicDiscount: dùng cho ô nhập (hiển thị message + tính finalThanhToan), hỗ trợ "k" và "tr".
// Vì vậy "5m" và "5tr" cho kết quả khác nhau — KHÔNG hợp nhất để tránh đổi hành vi.

// Parser dạng "5%" / "500k" / "5m" -> số tiền giảm (clamp theo base).
export function parseDiscount(raw: string, base: number): number {
  const s = raw.trim().toLowerCase()
  if (!s) return 0
  if (/^\d+(\.\d+)?%$/.test(s)) {
    const pct = parseFloat(s.replace('%', ''))
    return Math.min(Math.round(base * pct / 100), base)
  }
  if (/^\d+(\.\d+)?k$/.test(s)) {
    return Math.min(Math.round(parseFloat(s.replace('k', '')) * 1000), base)
  }
  if (/^\d+(\.\d+)?m$/.test(s)) {
    return Math.min(Math.round(parseFloat(s.replace('m', '')) * 1_000_000), base)
  }
  const num = parseInt(s.replace(/[^\d]/g, ''), 10)
  if (!Number.isFinite(num)) return 0
  return Math.min(num, base)
}

// Parser động cho ô nhập: hỗ trợ "%", "k", "tr". Trả về số tiền giảm + message hiển thị.
export function computeDynamicDiscount(
  giamGiaInput: string,
  discountBase: number,
): { amount: number; msg: string } {
  let computedGiamGia = 0
  let computedDiscountMsg = ''
  if (giamGiaInput) {
    const s = giamGiaInput.trim().toLowerCase()
    if (s.endsWith('%')) {
      const pct = parseFloat(s.replace('%', ''))
      if (!isNaN(pct) && pct > 0 && pct <= 100) {
        computedGiamGia = discountBase * (pct / 100)
        computedDiscountMsg = `Giảm ${pct}% (-₫${computedGiamGia.toLocaleString('vi-VN')})`
      } else {
        computedDiscountMsg = 'Phần trăm không hợp lệ'
      }
    } else if (s.endsWith('k') || s.endsWith('tr')) {
      let multiplier = 1000
      if (s.endsWith('tr')) multiplier = 1000000
      const numStr = s.replace(/k|tr/g, '')
      const num = parseFloat(numStr)
      if (!isNaN(num) && num > 0) {
        computedGiamGia = num * multiplier
        computedDiscountMsg = `Giảm ₫${computedGiamGia.toLocaleString('vi-VN')}`
      } else {
        computedDiscountMsg = 'Số tiền giảm không hợp lệ'
      }
    } else {
      const num = parseFloat(s.replace(/[^\d]/g, ''))
      if (!isNaN(num) && num > 0) {
        computedGiamGia = num
        computedDiscountMsg = `Giảm ₫${computedGiamGia.toLocaleString('vi-VN')}`
      }
    }
  }
  return { amount: computedGiamGia, msg: computedDiscountMsg }
}
