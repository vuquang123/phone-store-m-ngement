import { NextResponse } from "next/server"
import "../../../lib/google-sheets" // ensure module evaluated

export const dynamic = "force-dynamic"

export async function GET() {
  const raw = process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || ""
  const normalizedPreview = raw.replace(/\\n/g, "\n").split("\n").slice(0,2)
  return NextResponse.json({
    hasEnv: !!raw,
    startsWith: raw.slice(0,30),
    containsLiteralBackslashN: /\\n/.test(raw),
    length: raw.length,
    normalizedFirstLine: normalizedPreview[0] || null,
    normalizedSecondLineLen: (normalizedPreview[1]||"").length,
  })
}