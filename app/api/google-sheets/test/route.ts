import { NextRequest, NextResponse } from "next/server"
import { assertGoogleSheetsEnvConfigured } from "@/lib/env"
import { readFromGoogleSheets } from "@/lib/google-sheets"
import { isInternalRequestAuthorized } from "@/lib/internal-route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function tryReadSmallRange() {
  const candidates = [
    { sheet: "Settings", range: "A1:B5" },
    { sheet: "USERS", range: "A1:B5" },
  ]

  for (const candidate of candidates) {
    try {
      const data = await readFromGoogleSheets(candidate.sheet, candidate.range, { force: true })
      return {
        rowCount: data.rows.length,
        sheet: candidate.sheet,
      }
    } catch {
      continue
    }
  }

  throw new Error("Không đọc được range test nhỏ từ Google Sheets.")
}

export async function GET(request: NextRequest) {
  if (!isInternalRequestAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Không được phép truy cập endpoint này." }, { status: 401 })
  }

  try {
    assertGoogleSheetsEnvConfigured()
    const result = await tryReadSmallRange()
    return NextResponse.json({
      success: true,
      configured: true,
      rowCount: result.rowCount,
      sheet: result.sheet,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể kiểm tra Google Sheets"
    return NextResponse.json({
      success: false,
      configured: false,
      error: message.includes("GOOGLE_") ? message : "Không thể kiểm tra Google Sheets",
    }, { status: 400 })
  }
}
