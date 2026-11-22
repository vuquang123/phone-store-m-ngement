// ---------------------------------------------------------------------------
// Báo cáo tổng hợp cuối ngày -> Telegram. Chạy tự động 22h hằng ngày
// (vercel.json: "0 15 * * *" = 15h UTC = 22h giờ VN).
//
// Mỗi chi nhánh 1 báo cáo riêng, gửi vào nhóm Telegram của chi nhánh đó:
//   DEV PỒ -> nhóm DEV PỒ, T1s -> nhóm T1s (lib/telegram định tuyến theo `branch`).
//
// Dùng chung lib/reports/tong-ket với trang /nhanvien/dashboard nên số liệu
// trong tin nhắn luôn khớp với số trên web.
//
// Gọi tay để thử: GET /api/cron/bao-cao-ngay?dry=1  (chỉ trả JSON, KHÔNG gửi)
//                 &branch=1|2 để chỉ chạy 1 chi nhánh
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server"
import { DateTime } from "luxon"
import { isInternalRequestAuthorized } from "@/lib/internal-route"
import { TIMEZONE, getShift } from "@/lib/shift"
import { buildSummary } from "@/lib/reports/tong-ket"
import { formatBaoCaoNgay } from "@/lib/reports/telegram-bao-cao"
import { sendTelegramMessage } from "@/lib/telegram"
import { BRANCHES, type BranchId } from "@/lib/branches"

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
    const only = sp.get("branch")
    const day = dateParam
      ? DateTime.fromISO(dateParam, { zone: TIMEZONE }).startOf("day")
      : DateTime.now().setZone(TIMEZONE).startOf("day")
    if (!day.isValid) {
      return NextResponse.json({ success: false, error: "Tham số date không hợp lệ" }, { status: 400 })
    }

    const branches: BranchId[] = BRANCHES.map((b) => b.id).filter((id) => !only || id === only)
    const results: any[] = []
    for (const branch of branches) {
      // Báo cáo cả ngày -> dùng ca "all" (9h–21h) + các đơn ngoài khung giờ.
      const summary = await buildSummary(day, getShift("all"), branch)
      const text = formatBaoCaoNgay(summary)
      if (dryRun) {
        results.push({ branch, chi_nhanh: summary.chi_nhanh_label, text, so_don: summary.ban_hang.so_don })
        continue
      }
      // DEV PỒ: như cũ — topic Ghi chú bàn giao ca, hoặc TELEGRAM_THREAD_BAO_CAO nếu có đặt.
      // T1s: topic Báo cáo tổng hợp (T1S_TELEGRAM_THREAD_BAO_CAO); chưa đặt thì vào topic Ghi chú.
      const res = await sendTelegramMessage(
        text,
        "note",
        branch === "2"
          ? { branch, topic: process.env.T1S_TELEGRAM_THREAD_BAO_CAO ? "baoCao" : "note" }
          : { branch, message_thread_id: Number(process.env.TELEGRAM_THREAD_BAO_CAO) || undefined },
      )
      results.push({ branch, chi_nhanh: summary.chi_nhanh_label, so_don: summary.ban_hang.so_don, sent: !!res?.success, error: res?.success ? undefined : res?.error })
    }

    if (dryRun) return NextResponse.json({ success: true, dryRun: true, ngay: day.toISODate(), results })
    const failed = results.filter((r) => !r.sent)
    return NextResponse.json(
      { success: failed.length === 0, ngay: day.toISODate(), results },
      { status: failed.length === results.length ? 500 : 200 },
    )
  } catch (err: any) {
    console.error("[bao-cao-ngay] error:", err)
    return NextResponse.json(
      { success: false, error: err?.message || "Không thể tạo báo cáo tổng hợp" },
      { status: 500 },
    )
  }
}
