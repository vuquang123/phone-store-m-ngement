// app/api/public/telegram/webhook/route.ts
// Webhook nhận callback nút bấm Telegram (đặt dưới /api/public/* nên middleware cho qua).
// Khi nhân viên bấm "📦 Đã gửi hàng" -> cập nhật cột "Hình Thức Vận Chuyển" trong Ban_Hang
// và sửa lại tin nhắn (gỡ nút). LUÔN trả HTTP 200 để Telegram không retry.

import { NextResponse } from "next/server"
import { DateTime } from "luxon"
import { readFromGoogleSheets, updateRangeValues, colIndex } from "@/lib/google-sheets"
import { answerCallbackQuery, editMessageText } from "@/lib/telegram"
import { addNotification } from "@/lib/notifications"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SHEET = "Ban_Hang"

// 1 -> A, 27 -> AA
function numberToColumnName(num: number): string {
  let name = ""
  while (num > 0) {
    const mod = (num - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    num = Math.floor((num - mod) / 26)
  }
  return name || "A"
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function nowVN(): string {
  return DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("dd/MM/yyyy HH:mm")
}

export async function POST(req: Request) {
  try {
    // BẢO MẬT: chỉ chấp nhận request kèm đúng secret token (Telegram gắn vào header khi setWebhook).
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    const got = req.headers.get("x-telegram-bot-api-secret-token")
    if (secret && got !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }

    const update = await req.json().catch(() => null)
    const cb = update?.callback_query
    if (!cb) {
      // Không phải callback (vd message thường) -> bỏ qua, vẫn 200.
      return NextResponse.json({ ok: true })
    }

    const cbId: string = cb.id
    const data: string = String(cb.data || "")
    const msg = cb.message || {}
    const chatId: number = msg?.chat?.id
    const messageId: number = msg?.message_id
    const baseText: string = String(msg?.text || "")
    const from = cb.from || {}
    const fromName: string = from.first_name || from.username || ""

    if (!data.startsWith("ship:")) {
      await answerCallbackQuery(cbId)
      return NextResponse.json({ ok: true })
    }

    const maGHTK = data.slice(5).trim()
    if (!maGHTK) {
      await answerCallbackQuery(cbId, "Thiếu mã đơn")
      return NextResponse.json({ ok: true })
    }

    // Tìm các dòng có cột "Hình Thức Vận Chuyển" khớp GHTK + mã này (đọc mới nhất, không cache).
    const { header, rows } = await readFromGoogleSheets(SHEET, undefined, { force: true })
    const idxVC = colIndex(header, "Hình Thức Vận Chuyển", "Hình thức vận chuyển", "hinh_thuc_van_chuyen")
    if (idxVC === -1) {
      await answerCallbackQuery(cbId, "Không tìm thấy cột vận chuyển")
      return NextResponse.json({ ok: true })
    }

    const matched: number[] = [] // chỉ số trong rows (0-based)
    let alreadySent = false
    rows.forEach((r, i) => {
      const cell = String(r[idxVC] || "")
      const m = cell.match(/GHTK\s*[-–]?\s*(\d+)/i)
      if (m && m[1] === maGHTK) {
        matched.push(i)
        if (/đã gửi/i.test(cell)) alreadySent = true
      }
    })

    if (matched.length === 0) {
      await answerCallbackQuery(cbId, "Không tìm thấy đơn")
      return NextResponse.json({ ok: true })
    }

    // IDEMPOTENT: đã đánh dấu gửi rồi -> không ghi đè.
    if (alreadySent) {
      await answerCallbackQuery(cbId, "Đơn đã được đánh dấu gửi rồi")
      // vẫn gỡ nút để khỏi bấm lại
      try { await editMessageText(chatId, messageId, escapeHtml(baseText) + `\n\n✅ <b>Đã gửi hàng</b>`, []) } catch {}
      return NextResponse.json({ ok: true })
    }

    const stamp = nowVN()
    const newValue = `GHTK - ${maGHTK} - Đã gửi - ${stamp}`
    const colLetter = numberToColumnName(idxVC + 1)
    // Cập nhật từng dòng khớp (đơn nhiều món lặp cùng giá trị vận chuyển). Dòng dữ liệu đầu = sheet row 2.
    for (const i of matched) {
      const sheetRow = i + 2
      try {
        await updateRangeValues(`'${SHEET}'!${colLetter}${sheetRow}:${colLetter}${sheetRow}`, [[newValue]])
      } catch (e) {
        console.error("[tg-webhook] update cell fail row", sheetRow, e)
      }
    }

    await answerCallbackQuery(cbId, "✅ Đã cập nhật: Đã gửi hàng")

    // Sửa tin nhắn + GỠ nút (buttons rỗng) để không bấm lại.
    const suffix = `\n\n✅ <b>Đã gửi hàng</b> lúc ${stamp}` + (fromName ? ` bởi ${escapeHtml(fromName)}` : "")
    try {
      await editMessageText(chatId, messageId, escapeHtml(baseText) + suffix, [])
    } catch (e) {
      console.error("[tg-webhook] editMessageText fail", e)
    }

    // Best-effort: ghi 1 thông báo nội bộ.
    try {
      await addNotification({
        loai: "ban_hang",
        tieu_de: "Đơn online đã gửi hàng",
        noi_dung: `GHTK ${maGHTK} đã gửi${fromName ? ` bởi ${fromName}` : ""} • ${stamp}`,
        nguoi_nhan_id: "all",
      })
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e) {
    // Luôn trả 200 để Telegram không retry; chỉ log lỗi.
    console.error("[tg-webhook] error:", e)
    return NextResponse.json({ ok: true })
  }
}
