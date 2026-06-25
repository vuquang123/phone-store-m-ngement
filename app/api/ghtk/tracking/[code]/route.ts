// app/api/ghtk/tracking/[code]/route.ts
// Proxy server tra cứu trạng thái đơn GHTK (đã được middleware bảo vệ bằng phiên đăng nhập).
// Trình duyệt gọi route này -> server gọi GHTK với token từ env. KHÔNG lộ token ra client.

import { NextResponse } from "next/server"
import { getGhtkTracking } from "@/lib/ghtk"
import { mapGhtkStatus } from "@/lib/ghtk-status"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const toNum = (v: any): number => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  // Next.js 15: params là Promise -> phải await
  const { code } = await params
  if (!code) {
    return NextResponse.json({ success: false, message: "Thiếu mã đơn cần tra cứu" }, { status: 400 })
  }

  const result = await getGhtkTracking(decodeURIComponent(code))

  if (!result.success) {
    const status = result.http_status >= 400 ? result.http_status : 502
    return NextResponse.json(
      { success: false, message: result.message, error_code: result.error_code, log_id: result.log_id },
      { status },
    )
  }

  const o = result.order
  const status = mapGhtkStatus(o.status ?? "")

  return NextResponse.json({
    success: true,
    order: {
      labelId: o.label_id ?? "",
      partnerId: o.partner_id ?? "",
      statusCode: status.code,
      statusLabel: o.status_text || status.label,
      statusGroup: status.group,
      created: o.created ?? "",
      modified: o.modified ?? "",
      message: o.message ?? result.message ?? "",
      pickDate: o.pick_date ?? "",
      deliverDate: o.deliver_date ?? "",
      customerName: o.customer_fullname ?? "",
      customerTel: o.customer_tel ?? "",
      address: o.address ?? "",
      codMoney: toNum(o.pick_money),
      shipMoney: toNum(o.ship_money),
      weight: toNum(o.weight),
    },
  })
}
