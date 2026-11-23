// ---------------------------------------------------------------------------
// Báo cáo tài chính 21h -> Telegram riêng chủ shop. Chạy tự động 21h hằng ngày
// (vercel.json: "0 14 * * *" = 14h UTC = 21h giờ VN). Lưu lịch sử vào bảng Bao_Cao_21h.
// Gọi tay để thử: GET /api/cron/bao-cao-21h?dry=1 (chỉ trả JSON, không lưu, không gửi)
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server"
import { isInternalRequestAuthorized } from "@/lib/internal-route"
import { taiDuLieu, luuTinhTrangSoLo } from "@/lib/tai-chinh/du-lieu"
import { taoBaoCao21h, luuBaoCao, tinTelegram, guiTelegramChuShop } from "@/lib/tai-chinh/bao-cao-21h"
import { KHOA_PHU } from "@/lib/tai-chinh/cai-dat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isInternalRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Không được phép truy cập endpoint này." }, { status: 401 })
  }
  try {
    const dry = request.nextUrl.searchParams.get("dry") === "1"
    const d = await taiDuLieu()
    // Bảng tài chính chưa tạo (chưa chạy db:tai-chinh) -> bỏ qua êm
    if (!d.soHeader.length && !d.lo.length) return NextResponse.json({ success: true, skipped: "Chưa tạo bảng tài chính" })
    if (!dry) await luuTinhTrangSoLo(d).catch(() => 0)
    const bc = await taoBaoCao21h(d, "all")
    if (dry) return NextResponse.json({ success: true, dry: true, baoCao: bc, tin: tinTelegram(bc, "") })
    const base = process.env.PUBLIC_URL || process.env.APP_URL || `https://${request.headers.get("host")}`
    const chat = d.caiDat.phu[KHOA_PHU.telegramChatId]
    const r = chat ? await guiTelegramChuShop(chat, tinTelegram(bc, `${base.replace(/\/$/, "")}/dashboard/tai-chinh/bao-cao-21h`)) : { ok: false, error: "Chưa kết nối Telegram chủ shop" }
    await luuBaoCao(bc, r.ok ? "Đã gửi" : `Không gửi: ${r.error}`)
    return NextResponse.json({ success: true, sent: r.ok, error: r.ok ? undefined : r.error })
  } catch (e: any) {
    console.error("[cron bao-cao-21h]", e)
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 })
  }
}
