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
    const idLine = (() => {
      const imei = p.imei || p.IMEI
      const serial = p.serial || p.Serial
      if (imei) return ` | IMEI: ${imei}`
      if (serial) return ` | Serial: ${serial}`
      return ""
    })()
    return `• ${head}${idLine}`
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
  // Nếu có sản phẩm thì luôn render tiêu đề và danh sách, không render nếu không có sản phẩm
  const productSection = productLines.length
    ? `\n📦 <b>Sản phẩm:</b>\n${productLines.join("\n")}${enrichedProducts.length > 10 ? "\n…" : ""}`
    : ""

  const reasonLine = reason ? `\n <b>Lý do hoàn:</b> ${reason}` : ""

  // Phụ kiện: ưu tiên mảng accessories; fallback từ "Chi Tiết PK" (JSON) hoặc chuỗi phu_kien
  const accessoriesArr = (() => {
    if (Array.isArray(order.accessories)) return order.accessories
    const rawDetail = order["Chi Tiết PK"] || order["Chi Tiết Phụ Kiện"] || order.chi_tiet_pk
    if (typeof rawDetail === 'string' && rawDetail.trim()) {
      try { const parsed = JSON.parse(rawDetail); if (Array.isArray(parsed)) return parsed } catch {}
    }
    return []
  })()
  const accessoriesStr = (order.phu_kien || order["Phụ Kiện"] || '').toString().trim()
  const accessoryLines = (() => {
    const arr = accessoriesArr as any[]
    if (Array.isArray(arr) && arr.length) {
      return arr.slice(0, 20).map((a: any) => {
        const ten = a.ten_phu_kien || a.ten || a.name || ''
        const loai = a.loai || a.type || ''
        const slRaw = a.sl ?? a.so_luong ?? a.quantity
        const sl = Number.isFinite(slRaw) ? Number(slRaw) : (typeof slRaw === 'string' ? Number(slRaw.replace(/[^\d.-]/g,'')) : 0)
        const qty = sl && sl > 1 ? ` x${sl}` : ''
        const nameWithType = loai ? `${loai} ${ten}` : (ten || 'Phụ kiện')
        return `• ${nameWithType}${qty}`
      })
    }
    if (accessoriesStr) return [accessoriesStr]
    return []
  })()
  // Chỉ render phụ kiện nếu thực sự có phụ kiện, không render dòng thừa
  const accessoriesSection = accessoryLines.length
    ? `\n🧩 <b>Phụ kiện:</b>\n${accessoryLines.join('\n')}${(Array.isArray(accessoriesArr) && accessoriesArr.length > 20) ? "\n…" : ""}`
    : ''

  // Tổng tiền: ưu tiên tổng cuối cùng nếu có, sau đó đến tong_tien/total
  const parseAmount = (v: any): number => {
    if (v === null || v === undefined) return 0
    if (typeof v === 'number' && Number.isFinite(v)) return v
    const n = Number(String(v).replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  const totalCandidates = [order.final_total, order.finalThanhToan, order.tong_tien, order.total, order["Tổng Thu"]]
  const totalVal = totalCandidates.map(parseAmount).find(n => n > 0) || 0
  const totalLine = `\n <b>Tổng tiền:</b> ${totalVal > 0 ? totalVal.toLocaleString('vi-VN') + ' VNĐ' : 'N/A'}`
  // Dòng chi tiết đặt cọc nếu có
  const coc = parseAmount(order.so_tien_coc)
  const conLai = parseAmount(order.so_tien_con_lai)
  const depositLine = (coc > 0 || conLai > 0)
    ? `\n <b>Chi tiết:</b> Đã cọc ${coc > 0 ? ('₫' + coc.toLocaleString('vi-VN')) : '₫0'} | Còn lại ${conLai > 0 ? ('₫' + conLai.toLocaleString('vi-VN')) : '₫0'}`
    : ''

  // Chi tiết thanh toán: nếu có mảng payments thì render đầy đủ; nếu không, dùng chuỗi tóm tắt có sẵn
  const paymentLines = (() => {
    const payments = Array.isArray(order.payments) ? order.payments : []
    if (!payments.length) return [] as string[]
    const label = (m: string) => m === 'cash' ? 'Tiền mặt' : m === 'transfer' ? 'Chuyển khoản' : m === 'card' ? 'Thẻ' : m === 'installment' ? 'Trả góp' : m
    const lines: string[] = []
    for (const p of payments) {
      const method = label(String(p.method || p.loai || p.type || ''))
      if ((p.method === 'installment') || /trả\s*góp|tra\s*gop/i.test(String(p.method))) {
        const provider = p.provider || p.nha_cung_cap || p.providerName || ''
        const subs: string[] = []
        const fmt = (v: any) => {
          const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
          return Number.isFinite(n) && n > 0 ? `₫${n.toLocaleString('vi-VN')}` : ''
        }
        const dp = fmt(p.downPayment ?? p.tra_truoc)
        const loan = fmt(p.loanAmount ?? p.khoan_vay)
        if (dp) subs.push(`Trả trước ${dp}`)
        if (loan) subs.push(`Khoản vay ${loan}`)
        const suffix = subs.length ? `: ${subs.join(', ')}` : ''
        lines.push(`• ${method}${provider ? ` (${provider})` : ''}${suffix}`)
      } else {
        const amt = typeof p.amount === 'number' ? p.amount : Number(String(p.amount || '').replace(/[^\d.-]/g, ''))
        const amtStr = Number.isFinite(amt) && amt > 0 ? ` ₫${amt.toLocaleString('vi-VN')}` : ''
        lines.push(`• ${method}${amtStr}`)
      }
    }
    return lines
  })()

  // Địa chỉ nhận & vận chuyển (chỉ render khi là đơn online)
  const orderType = order.order_type || order.type || order.loai_don || ''
  const isOnline = /onl|online/i.test(String(orderType))
  const address = order.khach_hang?.dia_chi || order.dia_chi_nhan || order["Địa Chỉ Nhận"] || order.address
  const shipMethod = order.hinh_thuc_van_chuyen || order["Hình Thức Vận Chuyển"]
  const shippingSection = isOnline && (address || shipMethod)
    ? `\n <b>Địa chỉ nhận:</b> ${address || '-'}${shipMethod ? `\n <b>Vận chuyển:</b> ${shipMethod}` : ''}`
    : ''

  // Ghi chú đơn hàng (nếu có)
  const rawNote = order.ghi_chu || order["Ghi Chú"] || order.note || order.ghiChu
  const noteText = typeof rawNote === 'string' ? rawNote.trim() : (rawNote ?? '')
  const noteLine = noteText ? `\n <b>Ghi chú:</b> ${noteText}` : ''

  // Gom các section, loại bỏ dòng trống nếu không có phụ kiện hoặc sản phẩm
  let messageSections = [
    `${emoji} <b>${action}</b>`,
    `\n <b>Mã đơn hàng:</b> ${order.ma_don_hang}`,
    ` <b>Nhân viên:</b> ${order.nhan_vien_ban || order.employeeName || order.employeeId || "N/A"}`,
    ` <b>Khách hàng:</b> ${order.khach_hang?.ten || order.khach_hang?.ho_ten || order.customerName || "Khách lẻ"}`,
    ` <b>SĐT:</b> ${order.khach_hang?.so_dien_thoai || order.khach_hang?.sdt || order.customerPhone || "N/A"}`,
    shippingSection,
    productSection,
    accessoriesSection,
    warrantyLine,
    reasonLine,
    noteLine,
    totalLine,
    depositLine,
    // Nếu có paymentLines chi tiết thì chỉ hiển thị các dòng chi tiết, không lặp lại tổng hợp
    !paymentLines.length
      ? ` <b>Thanh toán:</b> ${order.phuong_thuc_thanh_toan || order.paymentMethod || 'N/A'}`
      : '',
    paymentLines.length ? `\n${paymentLines.join('\n')}` : '',
    `\n <b>Thời gian:</b> ${new Date(order.ngay_tao || Date.now()).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })}`
  ]
  // Xóa các section rỗng hoặc chỉ có khoảng trắng
  messageSections = messageSections.filter(s => typeof s === 'string' && s.trim())
  return messageSections.join('\n')
}
