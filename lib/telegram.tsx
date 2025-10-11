type OrderType = "online" | "offline" | "return"
interface TelegramOptions { message_thread_id?: number }

export async function sendTelegramMessage(message: string, orderType?: OrderType, options?: TelegramOptions) {
  try {
    const botToken = "8251748021:AAFhiMTSeE0fOLpJfcaYEgEJp-5XFO6JAlg"
    const chatId = -1002895849744 // id nhóm lớn
  // Chọn topic theo loại đơn hàng, có thể override bằng options.message_thread_id
  let messageThreadId = 9 // mặc định đơn off
  if (orderType === "online") messageThreadId = 7
  if (orderType === "return") messageThreadId = 5334
  if (options?.message_thread_id) messageThreadId = options.message_thread_id
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

  // Chuẩn hóa danh sách sản phẩm (nếu có)
  const products = Array.isArray(order.products)
    ? order.products
    : Array.isArray(order.san_pham)
      ? order.san_pham
      : order.product
        ? [order.product]
        : []

  // Hoặc fallback từ các trường đơn lẻ (tên + imei)
  const singleName = order.ten_san_pham || order.tenSP || order.name || order.san_pham
  const singleIMEI = order.imei || order.IMEI
  const enrichedProducts = products.length
    ? products
    : (singleName || singleIMEI)
      ? [{ ten_san_pham: singleName, imei: singleIMEI, loai_may: order.loai_may, dung_luong: order.dung_luong, mau_sac: order.mau_sac }]
      : []

  const productLines = enrichedProducts.slice(0, 10).map((p: any, idx: number) => {
    const parts = [
      p.ten_san_pham || p.ten || p.name || "Sản phẩm",
      [p.loai_may || p.loai, p.dung_luong || p.dungLuong, p.mau_sac || p.mauSac].filter(Boolean).join("/")
    ].filter(Boolean)
    const head = parts.join(" ")
    const imei = p.imei ? ` | IMEI: ${p.imei}` : ""
    return `• ${head}${imei}`
  })

  // Gói bảo hành: ưu tiên mảng codes, hoặc chuỗi có sẵn
  const warrantyCodes = order.warrantyPackages || order.warranty_packages || order.goi_bao_hanh || order["Gói BH"]
  let warrantyLine = ""
  if (Array.isArray(warrantyCodes) && warrantyCodes.length) {
    warrantyLine = `\n <b>Gói bảo hành:</b> ${warrantyCodes.join(", ")}`
  } else if (typeof warrantyCodes === "string" && warrantyCodes.trim()) {
    warrantyLine = `\n <b>Gói bảo hành:</b> ${warrantyCodes}`
  }

  // Lý do hoàn (nếu có)
  const reason = order.reason || order.ly_do || order.lyDo || order["Lý Do"]

  // Lưu ý: giới hạn hiển thị 10 dòng sản phẩm để tránh message quá dài
  const productSection = productLines.length
    ? `\n📦 <b>Sản phẩm:</b>\n${productLines.join("\n")}${enrichedProducts.length > 10 ? "\n…" : ""}`
    : ""

  const reasonLine = reason ? `\n <b>Lý do hoàn:</b> ${reason}` : ""

  const totalLine = (() => {
    if (typeof order.tong_tien === 'number') return `\n\n <b>Tổng tiền:</b> ${order.tong_tien.toLocaleString("vi-VN")} VNĐ`
    return `\n\n <b>Tổng tiền:</b> N/A`
  })()

  return `
${emoji} <b>${action}</b>

 <b>Mã đơn hàng:</b> ${order.ma_don_hang}
 <b>Nhân viên:</b> ${order.nhan_vien_ban || order.employeeName || order.employeeId || "N/A"}
 <b>Khách hàng:</b> ${order.khach_hang?.ten || order.khach_hang?.ho_ten || order.customerName || "Khách lẻ"}
 <b>SĐT:</b> ${order.khach_hang?.so_dien_thoai || order.khach_hang?.sdt || order.customerPhone || "N/A"}
${productSection}
${warrantyLine}
${reasonLine}
${totalLine}
 <b>Thanh toán:</b> ${order.phuong_thuc_thanh_toan || order.paymentMethod || "N/A"}

 <b>Thời gian:</b> ${new Date(order.ngay_tao).toLocaleString("vi-VN")}
  `.trim()
}
