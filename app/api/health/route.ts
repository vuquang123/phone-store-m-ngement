import { NextResponse } from "next/server"

export const dynamic = "force-static"
export const revalidate = 30 // cache 30s đủ để ping

export async function GET() {
  return NextResponse.json({ ok: true, time: Date.now() })
}
