import { NextRequest, NextResponse } from "next/server"
import { getCashFlowDashboardDataFromSheets, maybeCreateDailyCashFlowReport } from "@/lib/cash-flow/sheets"
import { isInternalRequestAuthorized } from "@/lib/internal-route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isInternalRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Không được phép truy cập endpoint này." }, { status: 401 })
  }

  try {
    const data = await getCashFlowDashboardDataFromSheets()
    const report = await maybeCreateDailyCashFlowReport(data)
    return NextResponse.json({
      success: true,
      created: Boolean(report),
      slug: report?.slug || null,
      reportDate: report?.reportDate || null,
      aiModel: report?.aiModel || null,
      aiError: report?.aiError || null,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Không thể tạo báo cáo dòng tiền",
    }, { status: 500 })
  }
}
