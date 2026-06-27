// lib/telegram-cash.ts
// Gửi thông báo biến động quỹ tiền mặt vào topic "Tiền mặt" của group Telegram.

import { sendTelegramMessage, sendTelegramPhotoBase64 } from "./telegram"

// Topic (message thread) "Tiền mặt". Có thể override bằng env TELEGRAM_THREAD_CASH.
const CASH_THREAD = Number(process.env.TELEGRAM_THREAD_CASH) || 37306

/** Escape ký tự đặc biệt cho parse_mode HTML của Telegram. */
function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function formatTien(n: number): string {
  return Number(n || 0).toLocaleString("vi-VN") + "₫"
}

export async function sendCashTelegram(input: {
  loai: "thu" | "chi"
  so_tien: number
  so_du_sau: number
  ly_do?: string
  nhan_vien?: string
  ma_tham_chieu?: string
  nguon?: string
}) {
  const isThu = input.loai === "thu"
  const dongChinh = isThu
    ? `➕ <b>NHẬP QUỸ</b>: +${esc(formatTien(input.so_tien))}`
    : `➖ <b>XUẤT QUỸ</b>: -${esc(formatTien(input.so_tien))}`

  const lines: string[] = ["💰 <b>Quỹ tiền mặt</b>", dongChinh]
  if (input.ly_do) lines.push(`📝 Lý do: ${esc(input.ly_do)}`)
  if (input.ma_tham_chieu) lines.push(`🔗 Tham chiếu: ${esc(input.ma_tham_chieu)}`)
  if (input.nhan_vien) lines.push(`👤 Nhân viên: ${esc(input.nhan_vien)}`)
  lines.push(`💵 Số dư hiện tại: <b>${esc(formatTien(input.so_du_sau))}</b>`)

  const text = lines.join("\n")
  return sendTelegramMessage(text, "offline", { message_thread_id: CASH_THREAD })
}

/** Gửi ẢNH đính kèm của giao dịch vào đúng topic Tiền mặt (kèm caption ngắn). */
export async function sendCashPhoto(imageBase64: string, caption?: string) {
  return sendTelegramPhotoBase64(imageBase64, "cash.jpg", caption || "💰 Ảnh giao dịch quỹ tiền mặt", "offline", {
    message_thread_id: CASH_THREAD,
  })
}
