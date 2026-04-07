import { type NextRequest, NextResponse } from "next/server"

import { readFromGoogleSheets } from "@/lib/google-sheets"
import { withCors, isValidApiKey, resolveAllowedOrigin } from "@/lib/public-api"
import { buildPublicAccessories } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"

const SHEET = "Phu_Kien"

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")
  return withCors(new NextResponse(null, { status: 204 }), origin)
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")
  const allowedOrigin = resolveAllowedOrigin(origin)

  if (origin && !allowedOrigin) {
    return withCors(NextResponse.json({ error: "Origin is not allowed" }, { status: 403 }), origin)
  }

  const apiKey = request.headers.get("x-api-key")
  if (!isValidApiKey(apiKey)) {
    return withCors(NextResponse.json({ error: "Invalid API key" }, { status: 401 }), origin)
  }

  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    const data = buildPublicAccessories(header, rows)

    return withCors(NextResponse.json({ data, total: data.length }, { status: 200 }), origin)
  } catch (error) {
    console.error("[public/accessories] GET error:", error)
    return withCors(NextResponse.json({ error: "Internal server error" }, { status: 500 }), origin)
  }
}
