// app/api/check-out/route.ts
// Báo cáo cuối ca: LƯU SHEET trước (nguồn sự thật), gửi Telegram topic offline best-effort sau.

import { NextRequest, NextResponse } from "next/server"
import { buildCheckoutMessage, addCheckout, getCheckouts, type Ca, type TrangThai, type KhoCounts } from "@/lib/check-out"
import { sendTelegramMessage, sendTelegramPhotoBase64, sendTelegramMediaGroup } from "@/lib/telegram"
import { getServerUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CHECKOUT_THREAD = Number(process.env.TELEGRAM_THREAD_CHECKOUT) || 4901
// Nếu topic 4901 nằm ở group KHÁC group "offline" mặc định, đặt TELEGRAM_CHAT_CHECKOUT = id group (-100...).
const CHECKOUT_CHAT = Number(process.env.TELEGRAM_CHAT_CHECKOUT) || 0
const TG_OPTS = CHECKOUT_CHAT
  ? { message_thread_id: CHECKOUT_THREAD, chat_id: CHECKOUT_CHAT }
  : { message_thread_id: CHECKOUT_THREAD }

const num = (v: any): number => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}
const normCounts = (k: any): KhoCounts => ({
  website: num(k?.website), thucTe: num(k?.thucTe),
  s17: num(k?.s17), s16: num(k?.s16), s15: num(k?.s15), ipad: num(k?.ipad), khac: num(k?.khac),
})

function errText(err: any): string {
  if (!err) return "Có lỗi xảy ra"
  if (typeof err === "string") return err
  const code = err?.cause?.code || err?.code
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED") return "Không kết nối được dịch vụ (timeout)."
  return err?.message || err?.description || "Có lỗi xảy ra"
}

export async function GET() {
  try {
    const items = await getCheckouts(100)
    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: errText(e), items: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getServerUser(req)
    const body = await req.json().catch(() => ({}))
    const { ca, khoNgoai, khoTrong, trangThai, lyDo, taiChinh } = body || {}

    const caStr = String(ca)
    if (!["1", "2", "3"].includes(caStr)) {
      return NextResponse.json({ success: false, message: "Ca không hợp lệ (1/2/3)" }, { status: 400 })
    }
    const ttStr = String(trangThai)
    if (!["khop", "khong_khop"].includes(ttStr)) {
      return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ" }, { status: 400 })
    }
    if (ttStr === "khong_khop" && !String(lyDo || "").trim()) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập lý do khi không khớp" }, { status: 400 })
    }

    const tc = taiChinh || {}
    const nhanVien = user?.name || user?.email || ""
    const images: string[] = Array.isArray(body?.images)
      ? body.images.filter((x: any) => typeof x === "string" && x).slice(0, 10)
      : []

    const data = {
      ca: caStr as Ca,
      khoNgoai: normCounts(khoNgoai),
      khoTrong: normCounts(khoTrong),
      trangThai: ttStr as TrangThai,
      lyDo: lyDo ? String(lyDo) : undefined,
      taiChinh: {
        banRa: num(tc.banRa),
        banRaOff: tc.banRaOff ? String(tc.banRaOff) : "",
        banRaOnl: tc.banRaOnl ? String(tc.banRaOnl) : "",
        thuVao: tc.thuVao ? String(tc.thuVao) : "",
        tienMatBanGiao: num(tc.tienMatBanGiao),
        ghiChuCaSau: tc.ghiChuCaSau ? String(tc.ghiChuCaSau) : "",
      },
      nhanVien,
    }

    // 1) LƯU SHEET TRƯỚC (nguồn sự thật) — lỗi thì 500, không gửi Telegram.
    let record
    try {
      record = await addCheckout(data, images.length)
    } catch (e: any) {
      return NextResponse.json({ success: false, message: "Lưu báo cáo thất bại: " + errText(e) }, { status: 500 })
    }

    // 2) Telegram (best-effort) — không throw, không ảnh hưởng kết quả lưu sheet.
    try {
      const text = buildCheckoutMessage(data)
      const opts = TG_OPTS
      if (images.length === 0) {
        await sendTelegramMessage(text, "offline", opts)
      } else if (images.length === 1) {
        await sendTelegramPhotoBase64(images[0], "checkout.jpg", text, "offline", opts)
      } else {
        const buffers = images.map((b64) => Buffer.from(String(b64).replace(/^data:[^;]+;base64,/, ""), "base64"))
        await sendTelegramMediaGroup(buffers, buffers.map((_, i) => `checkout_${i}.jpg`), [text], "offline", opts)
      }
    } catch (e) {
      console.warn("[CHECK-OUT] Gửi Telegram thất bại (đã lưu sheet):", e)
    }

    return NextResponse.json({ success: true, id: record.id })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: errText(e) }, { status: 500 })
  }
}
