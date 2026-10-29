// ---------------------------------------------------------------------------
// Báo cáo tổng hợp cuối ngày -> Telegram. Chạy tự động 22h hằng ngày
// (vercel.json: "0 15 * * *" = 15h UTC = 22h giờ VN).
//
// Dùng chung lib/reports/tong-ket với trang /nhanvien/dashboard nên số liệu
// trong tin nhắn luôn khớp với số trên web.
//
// Gọi tay để thử: GET /api/cron/bao-cao-ngay?dry=1  (chỉ trả JSON, KHÔNG gửi)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server"
import { DateTime } from "luxon"
import { isInternalRequestAuthorized } from "@/lib/internal-route"
import { TIMEZONE, getShift } from "@/lib/shift"
import { buildSummary } from "@/lib/reports/tong-ket"
import { formatBaoCaoNgay } from "@/lib/reports/telegram-bao-cao"
import { sendTelegramMessage } from "@/lib/telegram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isInternalRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Không được phép truy cập endpoint này." }, { status: 401 })
  }

  try {
    const sp = request.nextUrl.searchParams
    // dry=1: xem trước nội dung mà không bắn tin (dùng khi kiểm thử).
    const dryRun = sp.get("dry") === "1"
    const dateParam = sp.get("date")
    const day = dateParam
      ? DateTime.fromISO(dateParam, { zone: TIMEZONE }).startOf("day")
      : DateTime.now().setZone(TIMEZONE).startOf("day")
    if (!day.isValid) {
      return NextResponse.json({ success: false, error: "Tham số date không hợp lệ" }, { status: 400 })
    }

    // Báo cáo cả ngày -> dùng ca "all" (9h–21h) + các đơn ngoài khung giờ.
    const summary = await buildSummary(day, getShift("all"))
    const text = formatBaoCaoNgay(summary)

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, text, summary })
    }

    const res = await sendTelegramMessage(text, "note", {
      // Mặc định vào topic Ghi chú bàn giao ca — đúng chỗ nhân viên đọc đầu ca.
      // Muốn tách topic riêng thì đặt TELEGRAM_THREAD_BAO_CAO.
      message_thread_id: Number(process.env.TELEGRAM_THREAD_BAO_CAO) || undefined,
    })

    if (!res?.success) {
      return NextResponse.json(
        { success: false, error: res?.error || "Gửi Telegram thất bại" },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true, ngay: summary.ngay, so_don: summary.ban_hang.so_don })
  } catch (err: any) {
    console.error("[bao-cao-ngay] error:", err)
    return NextResponse.json(
      { success: false, error: err?.message || "Không thể tạo báo cáo tổng hợp" },
      { status: 500 },
    )
  }
}
