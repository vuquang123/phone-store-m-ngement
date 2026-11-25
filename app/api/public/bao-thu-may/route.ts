// POST /api/public/bao-thu-may — nhận form "Báo thu máy" (devpo.vn/thu-may) do server
// web devpo.vn chuyển tiếp. Nằm dưới /api/public nên middleware cho qua.
// Chống spam: ô bẫy (honeypot), giới hạn theo IP khách + giới hạn tổng, cắt độ dài.
// Gửi bằng bot + nhóm Telegram DEV PỒ vào topic "CHECK MÁY KHÁCH".

import { NextResponse } from "next/server"
import { buildTelegramMessage, cleanPayload, validatePayload, KHOA_CHECK_MAY } from "@/lib/bao-thu-may"
import { sendTelegramMessage } from "@/lib/telegram"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CUA_SO_MS = 10 * 60 * 1000
const TOI_DA_MOI_IP = 6 // tối đa 6 lần / 10 phút / IP
const TOI_DA_TOAN_BO = 60 // tối đa 60 lần / 10 phút cho mỗi máy chủ

const lichSuIp = new Map<string, number[]>()
let lichSuChung: number[] = []

function quaGioiHan(ip: string): boolean {
  const now = Date.now()
  lichSuChung = lichSuChung.filter((t) => now - t < CUA_SO_MS)
  const ds = (lichSuIp.get(ip) || []).filter((t) => now - t < CUA_SO_MS)
  if (ds.length >= TOI_DA_MOI_IP || lichSuChung.length >= TOI_DA_TOAN_BO) {
    lichSuIp.set(ip, ds)
    return true
  }
  ds.push(now)
  lichSuChung.push(now)
  lichSuIp.set(ip, ds)
  if (lichSuIp.size > 5000) lichSuIp.clear()
  return false
}

async function dichDen(): Promise<{ chatId: number; threadId: number } | null> {
  let chat = 0
  let thread = 0
  try {
    const { docCaiDat } = await import("@/lib/tai-chinh/cai-dat")
    const { phu } = await docCaiDat()
    chat = Number(phu[KHOA_CHECK_MAY.chatId]) || 0
    thread = Number(phu[KHOA_CHECK_MAY.threadId]) || 0
  } catch (e) {
    console.warn("[bao-thu-may] không đọc được cài đặt topic:", e)
  }
  if (!thread) {
    thread = Number(process.env.TELEGRAM_THREAD_CHECK_MAY) || 0
    chat = Number(process.env.TELEGRAM_CHAT_CHECK_MAY) || Number(process.env.TELEGRAM_CHAT_ID) || chat
  }
  if (!thread) return null
  return { chatId: chat, threadId: thread }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Dữ liệu không hợp lệ" }, { status: 400 })

  const payload = cleanPayload(body)
  // Bot điền ô bẫy: giả vờ thành công, không gửi gì.
  if (payload.website) return NextResponse.json({ ok: true })

  // devpo.vn chuyển tiếp kèm IP thật của khách; gọi thẳng thì lấy IP của request.
  const ip =
    req.headers.get("x-thu-may-client-ip")?.trim() ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "?"
  if (quaGioiHan(ip)) {
    return NextResponse.json({ ok: false, error: "Bạn gửi hơi nhiều, vui lòng thử lại sau ít phút." }, { status: 429 })
  }

  const invalid = validatePayload(payload)
  if (invalid) return NextResponse.json({ ok: false, error: invalid }, { status: 400 })

  const dich = await dichDen()
  if (!dich) {
    console.error("[bao-thu-may] chưa cấu hình topic CHECK MÁY KHÁCH (gõ /checkmay trong topic)")
    return NextResponse.json(
      { ok: false, error: "Hệ thống chưa sẵn sàng nhận báo máy. Vui lòng gọi 0909 097 177." },
      { status: 503 },
    )
  }

  const text = buildTelegramMessage(payload)
  const r = await sendTelegramMessage(text, undefined, {
    branch: "1",
    ...(dich.chatId ? { chat_id: dich.chatId } : {}),
    message_thread_id: dich.threadId,
  })
  if (!r.success) {
    console.error("[bao-thu-may] gửi Telegram lỗi:", r.error)
    return NextResponse.json({ ok: false, error: "Chưa gửi được, vui lòng thử lại hoặc gọi 0909 097 177." }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
