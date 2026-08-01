// Sinh tin nhắn báo khách từ 1 dòng sản phẩm trong kho.
// Format mẫu: "15ProMax 256GB Blue 98.5 Pin 99%, 2 esim, giá chỉ 15.500K"

import { formatPinDisplay } from "@/lib/utils/inventory-helpers"

// "iPhone 15 Pro Max" -> "15ProMax"; tên không phải iPhone giữ nguyên.
function compactProductName(name: string): string {
  const trimmed = String(name || "").trim()
  if (/^iphone/i.test(trimmed)) {
    return trimmed.replace(/^iphone\s*/i, "").replace(/\s+/g, "")
  }
  return trimmed
}

// "Blue Titanium" -> "Blue" (bỏ hậu tố Titanium cho gọn), màu khác giữ nguyên.
function compactColor(color: string): string {
  return String(color || "").replace(/\s*titanium\s*$/i, "").trim()
}

// "98.5,màn xước" -> "98.5" (lấy phần đánh giá ngoại hình đứng đầu).
function conditionGrade(tinhTrang: string): string {
  return String(tinhTrang || "").split(",")[0].trim()
}

// 15500000 -> "15.500K"
function formatPriceK(price: number): string {
  if (!price || price <= 0) return ""
  return `${Math.round(price / 1000).toLocaleString("vi-VN")}K`
}

export function buildCustomerQuote(p: {
  ten_san_pham?: string
  dung_luong?: string
  mau_sac?: string
  tinh_trang?: string
  pin?: string | number
  do_sim?: string
  gia_ban?: number
  giam_gia?: number
}): string {
  const head = [
    compactProductName(p.ten_san_pham || ""),
    String(p.dung_luong || "").trim(),
    compactColor(p.mau_sac || ""),
    conditionGrade(p.tinh_trang || ""),
  ].filter(Boolean).join(" ")

  const pinDisplay = formatPinDisplay(p.pin)
  const parts = [
    pinDisplay !== "-" ? `${head} Pin ${pinDisplay}` : head,
    String(p.do_sim || "").trim() || null,
  ].filter(Boolean) as string[]

  const price = formatPriceK((p.gia_ban || 0) - (p.giam_gia || 0))
  if (price) parts.push(`giá ${price}`)

  return parts.join(", ")
}

// Từ 2 máy trở lên: chừa 1 dòng trống giữa các máy cho dễ đọc khi gửi khách.
export function buildCustomerQuoteList(products: Array<Parameters<typeof buildCustomerQuote>[0]>): string {
  return products.map(buildCustomerQuote).filter(Boolean).join("\n\n")
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // rơi xuống fallback bên dưới (Safari cũ / không có quyền clipboard)
  }
  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
