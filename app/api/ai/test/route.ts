import { NextRequest, NextResponse } from "next/server"
import { isInternalRequestAuthorized } from "@/lib/internal-route"
import { testGeminiConnection } from "@/services/ai/test-gemini-connection"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!isInternalRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Không được phép truy cập endpoint này." }, { status: 401 })
  }

  try {
    const result = await testGeminiConnection()
    if (!result.success) {
      const status = result.message.includes("Thiếu cấu hình") ? 400 : 502
      return NextResponse.json({ success: false, error: result.message }, { status })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể kiểm tra Gemini"
    return NextResponse.json({
      success: false,
      error: message.includes("GEMINI_API_KEY") ? "Thiếu cấu hình GEMINI_API_KEY" : "Không thể kiểm tra Gemini",
    }, { status: 500 })
  }
}
