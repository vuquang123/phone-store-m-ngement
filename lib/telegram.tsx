export async function sendTelegramMessage(message: string, orderType?: "online" | "offline") {
  try {
    const botToken = "8251748021:AAFhiMTSeE0fOLpJfcaYEgEJp-5XFO6JAlg"
    const chatId = -1002895849744 // id nhóm lớn
    let messageThreadId = 9 // mặc định đơn off
    if (typeof orderType !== "undefined" && orderType === "online") messageThreadId = 7
    if (!botToken || !chatId) {
      console.error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID")
      return { success: false, error: "Thiếu cấu hình Telegram" }
    }
    const body: any = {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      message_thread_id: messageThreadId
    }
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body)
    })
    const result = await response.json()
    if (result.ok) {
      return { success: true }
    } else {
      console.error("Lỗi gửi Telegram:", result)
      return { success: false, error: result.description }
    }
  } catch (error) {
    console.error("Lỗi gửi Telegram:", error)
    return { success: false, error }
  }
}

export function formatOrderMessage(order: any, type: "new" | "return") {
  const emoji = type === "new" ? "🛒" : "↩️"
  const action = type === "new" ? "TẠO ĐƠN HÀNG MỚI" : "HOÀN TRẢ ĐƠN HÀNG"

  return `
${emoji} <b>${action}</b>

📋 <b>Mã đơn hàng:</b> ${order.ma_don_hang}
👤 <b>Nhân viên:</b> ${order.nhan_vien_ban || order.employeeName || order.employeeId || "N/A"}
👥 <b>Khách hàng:</b> ${order.khach_hang?.ten || order.khach_hang?.ho_ten || order.customerName || "Khách lẻ"}
📱 <b>SĐT:</b> ${order.khach_hang?.so_dien_thoai || order.khach_hang?.sdt || order.customerPhone || "N/A"}

💰 <b>Tổng tiền:</b> ${order.tong_tien?.toLocaleString("vi-VN")} VNĐ
💳 <b>Thanh toán:</b> ${order.phuong_thuc_thanh_toan || order.paymentMethod || "N/A"}

🕐 <b>Thời gian:</b> ${new Date(order.ngay_tao).toLocaleString("vi-VN")}
  `.trim()
}
