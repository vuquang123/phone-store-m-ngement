// app/api/check-in/route.ts
// Nhận báo cáo check-in đầu ca -> gửi Telegram vào topic "Lịch làm off" (kèm ảnh nếu có).

import dns from "node:dns"
import { NextRequest, NextResponse } from "next/server"
import { buildCheckinMessage, saveCheckin, getCheckins, type Ca, type TrangThai, type KhoCounts } from "@/lib/check-in"
import { sendTelegramMessage, sendTelegramPhotoBase64, sendTelegramMediaGroup } from "@/lib/telegram"
import { getServerUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Ưu tiên IPv4 khi phân giải DNS — tránh lỗi fetch ETIMEDOUT tới api.telegram.org
// trên máy có IPv6 cấu hình lỗi (Node mặc định thử IPv6 trước).
try { dns.setDefaultResultOrder("ipv4first") } catch {}

const CHECKIN_THREAD = Number(process.env.TELEGRAM_THREAD_CHECKIN) || 1803

// Lấy thông điệp lỗi DẠNG CHUỖI từ kết quả gửi Telegram (tránh "[object Object]").
function errText(err: any): string {
  if (!err) return "Gửi Telegram thất bại"
  if (typeof err === "string") return err
  const code = err?.cause?.code || err?.code
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || /timed?\s*out/i.test(String(err?.message))) {
    return "Không kết nối được Telegram (timeout). Kiểm tra mạng server và token bot."
  }
  return err?.message || err?.description || "Gửi Telegram thất bại"
}

const num = (v: any): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const normCounts = (k: any): KhoCounts => ({
  website: num(k?.website),
  thucTe: num(k?.thucTe),
  s17: num(k?.s17),
  s16: num(k?.s16),
  s15: num(k?.s15),
  ipad: num(k?.ipad),
  khac: num(k?.khac),
})

export async function POST(req: NextRequest) {
  try {
    const user = getServerUser(req)
    const body = await req.json().catch(() => ({}))
    const { ca, khoNgoai, khoTrong, trangThai, lyDo, images } = body || {}

    const caStr = String(ca)
    if (!["1", "2", "3"].includes(caStr)) {
      return NextResponse.json({ success: false, message: 'Ca không hợp lệ (1/2/3)' }, { status: 400 })
    }
    const ttStr = String(trangThai)
    if (!["khop", "khong_khop"].includes(ttStr)) {
      return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ" }, { status: 400 })
    }
    if (ttStr === "khong_khop" && !String(lyDo || "").trim()) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập lý do khi không khớp" }, { status: 400 })
    }

    const nhanVien = user?.name || user?.email || ""
    const checkinData = {
      ca: caStr as Ca,
      khoNgoai: normCounts(khoNgoai),
      khoTrong: normCounts(khoTrong),
      trangThai: ttStr as TrangThai,
      lyDo: lyDo ? String(lyDo) : undefined,
      nhanVien,
    }
    const text = buildCheckinMessage(checkinData)

    const opts = { message_thread_id: CHECKIN_THREAD }
    const imgs: string[] = Array.isArray(images)
      ? images.filter((x: any) => typeof x === "string" && x).slice(0, 10)
      : []

    // Lưu lịch sử vào sheet Check_in (luôn lưu, kể cả khi Telegram lỗi)
    try {
      await saveCheckin(checkinData, imgs.length)
    } catch (e) {
      console.warn("[CHECK-IN] Lưu sheet thất bại:", e)
    }

    let res: any
    if (imgs.length === 0) {
      res = await sendTelegramMessage(text, "offline", opts)
    } else if (imgs.length === 1) {
      res = await sendTelegramPhotoBase64(imgs[0], "checkin.jpg", text, "offline", opts)
    } else {
      const buffers = imgs.map((b64) => Buffer.from(String(b64).replace(/^data:[^;]+;base64,/, ""), "base64"))
      res = await sendTelegramMediaGroup(
        buffers,
        buffers.map((_, i) => `checkin_${i}.jpg`),
        [text],
        "offline",
        opts,
      )
    }

    if (!res?.success) {
      return NextResponse.json({ success: false, message: errText(res?.error) }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: errText(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const force = new URL(req.url).searchParams.get("refresh") === "1"
    const data = await getCheckins(force)
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: errText(e), data: [] }, { status: 500 })
  }
}
