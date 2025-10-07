import { NextResponse } from "next/server"
import "../../../lib/google-sheets" // ensure module evaluated

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const raw = process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || ""
  const dbg: any = (globalThis as any).__GS_KEY_DEBUG || {}
  return NextResponse.json({
    rawHasEnv: !!raw,
    rawStartsWith: raw.slice(0,30),
    rawContainsLiteralBackslashN: /\\n/.test(raw),
    rawLength: raw.length,
    normalized: {
      hasBegin: dbg.hasBegin,
      firstLine: dbg.firstLine,
      lastLine: dbg.lastLine,
      lineCount: dbg.lineCount,
      length: dbg.length,
    }
  })
}