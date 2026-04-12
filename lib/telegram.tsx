type OrderType = "online" | "offline" | "return" | "deposit" | string
interface TelegramOptions { message_thread_id?: number }

type StockEvent =
  | { type: "import"; total: number; devices: { name?: string; imei?: string; serial?: string }[]; employee?: string }
  | { type: "send_cnc"; total: number; address: string; devices: { name?: string; imei?: string; serial?: string }[]; employee?: string }
  | { type: "complete_cnc"; total: number; devices: { name?: string; imei?: string; serial?: string }[]; employee?: string }
  | { type: "send_warranty"; total: number; address: string; devices: { name?: string; imei?: string; serial?: string }[]; employee?: string }
  | { type: "complete_warranty"; total: number; devices: { name?: string; imei?: string; serial?: string }[]; employee?: string }
  | { type: "send_partner"; total: number; partner: string; devices: { name?: string; imei?: string; serial?: string }[]; employee?: string }
  | { type: "transfer"; total: number; to: string; devices: { name?: string; imei?: string; serial?: string }[]; employee?: string }

export function buildStockEventMessage(event: StockEvent): { text: string; threadId: number } {
  const threadId = 22
  const header = (() => {
    switch (event.type) {
      case "import": return "📥 Nhập hàng"
      case "send_cnc": return "🚚 Gửi CNC"
      case "complete_cnc": return "✅ Hoàn thành CNC"
      case "send_warranty": return "🛠️ Gửi bảo hành"
      case "complete_warranty": return "✅ Hoàn thành bảo hành"
      case "send_partner": return "🤝 Giao đối tác"
      case "transfer": return "🔄 Chuyển kho"
      default: return "Thông báo kho"
    }
  })()

  const lines: string[] = [header]
  if (event.employee) lines.push(`Nhân viên: ${event.employee}`)
  if (event.type === "send_cnc" || event.type === "send_warranty") {
    const addr = (event as any).address
    if (addr) lines.push(`Địa chỉ: ${addr}`)
  }
  if (event.type === "send_partner") {
    const partner = (event as any).partner
    if (partner) lines.push(`Đối tác: ${partner}`)
  }
  if (event.type === "transfer") {
    const to = (event as any).to
    if (to) lines.push(`Kho đích: ${to}`)
  }
  lines.push(`Số lượng: ${event.total}`)
  const list = (event.devices || []).map((d, idx) => {
    const name = d.name || "Máy"
    const ids = []
    if (d.imei) ids.push(`IMEI: ${d.imei}`)
    if (d.serial) ids.push(`Serial: ${d.serial}`)
    const idStr = ids.join(" - ")
    return `${idx + 1}. ${name}${idStr ? ` • ${idStr}` : ""}`
  })
  if (list.length) {
    lines.push("Danh sách:")
    lines.push(...list)
  }

  return { text: lines.join("\n"), threadId }
}

// Gửi sự kiện kho (nhập/gửi/hoàn thành) vào group kho.
// Có fallback: nếu gửi kèm topic (thread) thất bại, thử lại không kèm topic để tránh mất thông báo.
export async function sendStockEventNotification(event: StockEvent) {
  const { text, threadId } = buildStockEventMessage(event)
  // Ưu tiên dùng topic 22 (đã thống nhất cho kho)
  const first = await sendTelegramMessage(text, "offline", { message_thread_id: threadId })
  if (first?.success) return first
  console.warn("[TG] stock event send failed with topic, retry without topic", { event, first })
  // Fallback: bỏ topic để vẫn nhận được ở group
  const second = await sendTelegramMessage(text, "offline")
  if (!second?.success) {
    console.error("[TG] stock event send failed both attempts", { event, first, second })
  }
  return second
}

// Map logical order types to Telegram chat IDs (groups).
// Prefer reading chat IDs from environment variables so different deployments can
// route messages to different groups. Set these env vars on the server:
// TELEGRAM_CHAT_OFFLINE, TELEGRAM_CHAT_ONLINE, TELEGRAM_CHAT_RETURN, TELEGRAM_CHAT_DEPOSIT
// Values should be numeric chat IDs (e.g. -1001234567890).
function parseEnvChat(envName: string, fallback: number) {
  try {
    const v = process.env[envName]
    if (!v) return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    console.error("Thiếu TELEGRAM_BOT_TOKEN")
    return ""
  }
  return token
}

const DEFAULT_CHAT = -1002895849744
const ORDER_TYPE_CHAT_MAP: Record<string, number> = {
  offline: parseEnvChat('TELEGRAM_CHAT_OFFLINE', DEFAULT_CHAT),
  online: parseEnvChat('TELEGRAM_CHAT_ONLINE', DEFAULT_CHAT),
  return: parseEnvChat('TELEGRAM_CHAT_RETURN', DEFAULT_CHAT),
  deposit: parseEnvChat('TELEGRAM_CHAT_DEPOSIT', DEFAULT_CHAT),
}

export async function sendTelegramMessage(message: string, orderType?: OrderType, options?: TelegramOptions) {
  try {
    const botToken = getBotToken()
    // choose chat id from mapping, fallback to default
    const chatId = (orderType && ORDER_TYPE_CHAT_MAP[orderType]) ? ORDER_TYPE_CHAT_MAP[orderType] : ORDER_TYPE_CHAT_MAP['offline']
    // choose topic/thread id based on orderType defaults, can be overridden by options.message_thread_id
    let messageThreadId = 9 // default thread for offline
    if (orderType === "online") messageThreadId = 7
    if (orderType === "return") messageThreadId = 5334
    if (orderType === "deposit") messageThreadId = 9
    if (options?.message_thread_id) messageThreadId = options.message_thread_id
    if (!botToken || !chatId) {
      console.error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID")
      return { success: false, error: "Thiếu cấu hình Telegram" }
    }
    // Try sending with thread id first; if it fails (topic missing/invalid), retry without thread to avoid losing the alert.
    const sendOnce = async (withThread: boolean) => {
      const payload: any = {
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }
      if (withThread && messageThreadId) payload.message_thread_id = messageThreadId
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      })
      const json = await response.json()
      return { json, status: response.status, statusText: response.statusText, payload }
    }

    const first = await sendOnce(true)
    if (first?.json?.ok) {
      return { success: true }
    }

    if (messageThreadId) {
      console.warn("[TG] sendMessage fail with topic, retrying without thread", first)
      const second = await sendOnce(false)
      if (second?.json?.ok) {
        return { success: true }
      }
      console.error("Lỗi gửi Telegram (retry)", second)
      return { success: false, error: second?.json?.description || "Unknown Telegram error" }
    }

    console.error("Lỗi gửi Telegram", first)
    return { success: false, error: first?.json?.description || "Unknown Telegram error" }
  } catch (error) {
    console.error("Lỗi gửi Telegram:", error)
    return { success: false, error }
  }
}

// Send photo from base64 string. Builds a multipart/form-data body and uploads directly to Telegram.
export async function sendTelegramPhotoBase64(imageBase64: string, filename = 'image.jpg', caption = '', orderType?: OrderType, options?: TelegramOptions) {
  try {
    const botToken = getBotToken()
    const chatId = (orderType && ORDER_TYPE_CHAT_MAP[orderType]) ? ORDER_TYPE_CHAT_MAP[orderType] : ORDER_TYPE_CHAT_MAP['offline']
    // choose thread id defaults
    let messageThreadId = 9
    if (orderType === "online") messageThreadId = 7
    if (orderType === "return") messageThreadId = 5334
    if (orderType === "deposit") messageThreadId = 9
    if (options?.message_thread_id) messageThreadId = options.message_thread_id

    if (!botToken || !chatId) {
      console.error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID")
      return { success: false, error: "Thiếu cấu hình Telegram" }
    }

    // normalize base64
    const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, "")
    const buffer = Buffer.from(cleaned, 'base64')

    const boundary = '----telegramboundary' + Date.now()
    const nl = '\r\n'
    const head = Buffer.from(
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="chat_id"${nl}${nl}` +
      `${String(chatId)}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="caption"${nl}${nl}` +
      `${caption}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="parse_mode"${nl}${nl}` +
      `HTML${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="message_thread_id"${nl}${nl}` +
      `${String(messageThreadId)}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="photo"; filename="${filename}"${nl}` +
      `Content-Type: application/octet-stream${nl}${nl}`
    )
    const tail = Buffer.from(`${nl}--${boundary}--${nl}`)

    const body = Buffer.concat([head, buffer, tail])

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    })
    const result = await res.json()
    if (result.ok) return { success: true, result }
    console.error('Lỗi gửi Telegram (photo):', result)
    return { success: false, error: result.description, result }
  } catch (error) {
    console.error('Lỗi gửi Telegram (photo):', error)
    return { success: false, error }
  }
}

// Send photo from raw Buffer (server-side file). Accepts filename and returns Telegram result.
export async function sendTelegramPhotoBuffer(buffer: Buffer, filename = 'image.jpg', caption = '', orderType?: OrderType, options?: TelegramOptions) {
  try {
    const botToken = getBotToken()
    const chatId = (orderType && ORDER_TYPE_CHAT_MAP[orderType]) ? ORDER_TYPE_CHAT_MAP[orderType] : ORDER_TYPE_CHAT_MAP['offline']
    let messageThreadId = 9
    if (orderType === "online") messageThreadId = 7
    if (orderType === "return") messageThreadId = 5334
    if (orderType === "deposit") messageThreadId = 9
    if (options?.message_thread_id) messageThreadId = options.message_thread_id

    const boundary = '----telegramboundary' + Date.now()
    const nl = '\r\n'
    const head = Buffer.from(
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="chat_id"${nl}${nl}` +
      `${String(chatId)}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="caption"${nl}${nl}` +
      `${caption}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="parse_mode"${nl}${nl}` +
      `HTML${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="message_thread_id"${nl}${nl}` +
      `${String(messageThreadId)}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="photo"; filename="${filename}"${nl}` +
      `Content-Type: application/octet-stream${nl}${nl}`
    )
    const tail = Buffer.from(`${nl}--${boundary}--${nl}`)
    const body = Buffer.concat([head, buffer, tail])
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body
    })
    const result = await res.json()
    if (result.ok) return { success: true, result }
    return { success: false, error: result.description, result }
  } catch (error) {
    console.error('Lỗi gửi Telegram (buffer):', error)
    return { success: false, error }
  }
}

// Send multiple photos as an album (media group). Accepts arrays of buffers and filenames.
export async function sendTelegramMediaGroup(buffers: Buffer[], filenames: string[], captions?: string[], orderType?: OrderType, options?: TelegramOptions) {
  try {
    const botToken = getBotToken()
    const chatId = (orderType && ORDER_TYPE_CHAT_MAP[orderType]) ? ORDER_TYPE_CHAT_MAP[orderType] : ORDER_TYPE_CHAT_MAP['offline']
    let messageThreadId = 9
    if (orderType === "online") messageThreadId = 7
    if (orderType === "return") messageThreadId = 5334
    if (orderType === "deposit") messageThreadId = 9
    if (options?.message_thread_id) messageThreadId = options.message_thread_id

    if (!botToken || !chatId) {
      console.error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID")
      return { success: false, error: "Thiếu cấu hình Telegram" }
    }

    if (!Array.isArray(buffers) || buffers.length === 0) return { success: false, error: 'No buffers' }

    const boundary = '----telegramboundary' + Date.now()
    const nl = '\r\n'
    // Build media array referencing attached files as attach://file0 ...
    const mediaArray: any[] = buffers.map((_, idx) => {
      const item: any = { type: 'photo', media: `attach://file${idx}` }
      // add caption for first item if provided
      const cap = (captions && captions[idx]) || (captions && captions.length ? captions[0] : '')
      if (cap && idx === 0) item.caption = cap
      return item
    })

    const fieldsHead = Buffer.from(
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="chat_id"${nl}${nl}` +
      `${String(chatId)}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="message_thread_id"${nl}${nl}` +
      `${String(messageThreadId)}${nl}` +
      `--${boundary}${nl}` +
      `Content-Disposition: form-data; name="media"${nl}${nl}` +
      `${JSON.stringify(mediaArray)}${nl}`
    )

    // For each buffer, append file part
    const parts: Buffer[] = [fieldsHead]
    for (let i = 0; i < buffers.length; i++) {
      const fn = filenames[i] || `image_${i}.jpg`
      const head = Buffer.from(
        `--${boundary}${nl}` +
        `Content-Disposition: form-data; name="file${i}"; filename="${fn}"${nl}` +
        `Content-Type: application/octet-stream${nl}${nl}`
      )
      const tail = Buffer.from(nl)
      parts.push(head)
      parts.push(buffers[i])
      parts.push(tail)
    }
    const closing = Buffer.from(`--${boundary}--${nl}`)
    parts.push(closing)

    const body = Buffer.concat(parts)

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body
    })
    const result = await res.json()
    if (result.ok) return { success: true, result }
    console.error('Lỗi gửi Telegram (media group):', result)
    return { success: false, error: result.description, result }
  } catch (error) {
    console.error('Lỗi gửi Telegram (media group):', error)
    return { success: false, error }
  }
}

export function formatOrderMessage(order: any, type: "new" | "return") {
  const emoji = type === "new" ? "🛒" : "↩️"
  // Detect deposit (cọc) presence
  const rawCoc = order.so_tien_coc ?? order.sotiencoc ?? order.deposit ?? 0
  const cocNum = (() => {
    const v = rawCoc == null ? 0 : rawCoc;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  })();
  const isDeposit = type === "new" && cocNum > 0
  const isSettlement = !!order.is_settlement
  const action = isSettlement ? "TẤT TOÁN ĐƠN ĐẶT CỌC" : (isDeposit ? "ĐƠN ĐẶT CỌC MỚI" : (type === "new" ? "TẠO ĐƠN HÀNG MỚI" : "HOÀN TRẢ ĐƠN HÀNG"))

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
    // Thêm trường màu sắc vào thông tin sản phẩm
    const tenSanPham = p.ten_san_pham || p.ten || p.name || "Sản phẩm"
    const loaiMay = p.loai_may || p.loai
    const dungLuong = p.dung_luong || p.dungLuong
    const mauSac = p.mau_sac || p.mauSac
    const thongSo = [loaiMay, dungLuong, mauSac].filter(Boolean).join("/")
    const nguonStr = p.nguon ? ` [${p.nguon}]` : ""
    const head = thongSo ? `${tenSanPham} (${thongSo})${nguonStr}` : `${tenSanPham}${nguonStr}`
    const idLine = (() => {
      const imei = p.imei || p.IMEI
      const serial = p.serial || p.Serial
      const parts = []
      if (imei) parts.push(`IMEI: ${imei}`)
      if (serial) parts.push(`Serial: ${serial}`)
      return parts.length ? ` | ${parts.join(" - ")}` : ""
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
  // Nếu không có Chi Tiết PK (JSON), lấy từ cột Phụ Kiện (chuỗi, phân tách bằng dấu phẩy)
  const accessoriesArr = (() => {
    if (Array.isArray(order.accessories)) return order.accessories
    const rawDetail = order["Chi Tiết PK"] || order["Chi Tiết Phụ Kiện"] || order.chi_tiet_pk
    if (typeof rawDetail === 'string' && rawDetail.trim()) {
      try { const parsed = JSON.parse(rawDetail); if (Array.isArray(parsed)) return parsed } catch {}
    }
    // Nếu không có JSON, lấy từ cột Phụ Kiện dạng chuỗi, phân tách từng phụ kiện
    const accessoriesStr = (order.phu_kien || order["Phụ Kiện"] || '').toString().trim()
    if (accessoriesStr) {
      // Tách từng phụ kiện, loại bỏ khoảng trắng thừa
      return accessoriesStr.split(',').map((s: string) => {
        const ten = s.trim()
        // Cố gắng tách loại nếu có (lấy từ đầu chuỗi đến khoảng trắng đầu tiên)
        const m = ten.match(/^([A-ZÀ-Ỹa-zà-ỹ0-9\s\-]+)\s+(.*)$/)
        let loai = ''
        let name = ten
        if (m && m[1] && m[2]) {
          loai = m[1].trim()
          name = m[2].trim()
        }
        return { ten_phu_kien: name, loai: loai }
      })
    }
    return []
  })()
  const accessoryLines = (() => {
    const arr = accessoriesArr as any[]
    if (Array.isArray(arr) && arr.length) {
      return arr.slice(0, 20).map((a: any) => {
        const ten = (a.ten_phu_kien || a.ten || a.name || '').toString().trim()
        const loaiRaw = (a.loai || a.type || '').toString().trim()
        // If loai is missing, try to infer from the name by taking the leading phrase
        const inferredLoai = (() => {
          if (loaiRaw) return loaiRaw
          if (!ten) return ''
          const m = ten.match(/^([^\d\/\-–:]+)\s+(.*)$/)
          if (m && m[1]) return m[1].toString().trim()
          return ''
        })()
        const loai = inferredLoai ? inferredLoai.toUpperCase() : ''
        // If we inferred a loai, strip it from the displayed name to avoid duplication
        const displayName = (() => {
          if (loai && ten) {
            const regex = new RegExp('^' + loai.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*', 'i')
            return ten.replace(regex, '').trim() || ten
          }
          return ten
        })()
        const slRaw = a.sl ?? a.so_luong ?? a.quantity
        const sl = Number.isFinite(slRaw) ? Number(slRaw) : (typeof slRaw === 'string' ? Number(slRaw.replace(/[^\d.-]/g,'')) : 0)
        const qty = sl && sl > 1 ? ` x${sl}` : ''
        const display = loai ? `${loai} ${displayName || ''}`.trim() : (displayName || 'Phụ kiện')
        return `• ${display}${qty}`
      })
    }
  // Đã xử lý accessoriesStr ở trên, không cần kiểm tra lại ở đây
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
    // Đảm bảo lấy tất cả phương thức thanh toán và số tiền từng phương thức
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
        // Sửa: luôn hiện số tiền từng phương thức, nếu có
        const amt = typeof p.amount === 'number' ? p.amount : Number(String(p.amount || '').replace(/[^\d.-]/g, ''))
        const amtStr = Number.isFinite(amt) ? ` ₫${amt.toLocaleString('vi-VN')}` : ''
        lines.push(`• ${method}${amtStr}`)
      }
    }
    return lines
  })()

  // Địa chỉ nhận & vận chuyển: luôn hiển thị nếu có
  const address = order.khach_hang?.dia_chi
    || order.khach_hang?.dia_chi_nhan
    || order.dia_chi_nhan
    || order["Địa Chỉ Nhận"]
    || order.address
    || order.shippingAddress
    || order.ship_address
    || order.receiver_address
    || order.to_address
    || ''
  const shipMethod = order.hinh_thuc_van_chuyen
    || order["Hình Thức Vận Chuyển"]
    || order.shipping_method
    || order.ship_method
    || order.transport
    || order.van_chuyen
    || order.vc
    || ''
  const shippingSection = (address || shipMethod)
    ? `\n <b>Địa chỉ nhận:</b> ${address || '-'}${shipMethod ? `\n <b>Vận chuyển:</b> ${shipMethod}` : ''}`
    : ''

  // Ghi chú đơn hàng (nếu có)
  const rawNote = order.ghi_chu || order["Ghi Chú"] || order.note || order.ghiChu
  const noteText = typeof rawNote === 'string' ? rawNote.trim() : (rawNote ?? '')
  const noteLine = noteText ? `\n <b>Ghi chú:</b> ${noteText}` : ''

  // Gom các section, loại bỏ dòng trống nếu không có phụ kiện hoặc sản phẩm
  // Always include ma_don_hang (fallback to idDonHang, id, or order.id if missing)
  // Luôn hiển thị mã đơn hàng, nếu không có thì ghi rõ "(chưa có)"
  const maDonHang = (typeof order.ma_don_hang === 'string' && order.ma_don_hang.trim())
    ? order.ma_don_hang.trim()
    : (order.idDonHang || order.id || order.maDonHang || '(chưa có)')
  // Luôn hiển thị địa chỉ nhận & vận chuyển nếu có
  const addressFull = address
  const shipMethodFull = shipMethod
  const shippingSectionFull = (addressFull || shipMethodFull)
    ? `\n <b>Địa chỉ nhận:</b> ${addressFull || '-'}${shipMethodFull ? `\n <b>Vận chuyển:</b> ${shipMethodFull}` : ''}`
    : ''

  let messageSections = [
    `${emoji} <b>${action}</b>`,
  `\n <b>Mã đơn hàng:</b> ${maDonHang}`,
    ` <b>Nhân viên:</b> ${order.nhan_vien_ban || order.employeeName || order.employeeId || "N/A"}`,
    ` <b>Khách hàng:</b> ${order.khach_hang?.ten || order.khach_hang?.ho_ten || order.customerName || "Khách lẻ"}`,
    ` <b>SĐT:</b> ${order.khach_hang?.so_dien_thoai || order.khach_hang?.sdt || order.customerPhone || "N/A"}`,
    ...(order.loai_don || order.order_type || order.type || order.loai_don_ban ? [` <b>Loại đơn:</b> ${order.loai_don || order.order_type || order.type || order.loai_don_ban}`] : []),
    ...(order.han_thanh_toan || order.hanThanhToan || order.due_date ? [` <b>Hạn thanh toán:</b> ${order.han_thanh_toan || order.hanThanhToan || order.due_date}`] : []),
    shippingSectionFull,
    productSection,
    accessoriesSection,
    warrantyLine,
    reasonLine,
    noteLine,
    totalLine,
    depositLine,
    !paymentLines.length
      ? ` <b>Thanh toán:</b> ${order.phuong_thuc_thanh_toan || order.paymentMethod || 'N/A'}`
      : '',
    paymentLines.length ? `\n${paymentLines.join('\n')}` : '',
    `\n <b>Thời gian:</b> ${new Date(order.ngay_tao || Date.now()).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })}`
  ]
  messageSections = messageSections.filter(s => typeof s === 'string' && s.trim())
  return messageSections.join('\n')
}
