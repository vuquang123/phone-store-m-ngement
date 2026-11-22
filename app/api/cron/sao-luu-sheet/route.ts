import { NextRequest, NextResponse } from "next/server"
import { isInternalRequestAuthorized } from "@/lib/internal-route"
import { USE_POSTGRES } from "@/lib/google-sheets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Sao lưu hằng đêm: chép toàn bộ dữ liệu Supabase về Google Sheet cũ.
// Google Sheet trở thành bản sao lưu (xem được, tải Excel được) và là đường lùi nếu cần.
export async function GET(request: NextRequest) {
  if (!isInternalRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Không được phép truy cập endpoint này." }, { status: 401 })
  }
  if (!USE_POSTGRES) {
    return NextResponse.json({ success: true, skipped: "DATA_BACKEND chưa phải postgres, không cần sao lưu" })
  }
  try {
    const { exportPostgresToSheets } = await import("@/lib/sheet-store/export-to-sheets")
    const t0 = Date.now()
    const tabs = await exportPostgresToSheets()
    return NextResponse.json({ success: true, ms: Date.now() - t0, tabs })
  } catch (error) {
    console.error("[sao-luu-sheet]", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Sao lưu thất bại" },
      { status: 500 },
    )
  }
}
