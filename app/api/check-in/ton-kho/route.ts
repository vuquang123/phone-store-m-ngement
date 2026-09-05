// app/api/check-in/ton-kho/route.ts
// Số máy đang tồn trên website (sheet Kho_Hang), tách theo Kho Trong / Kho Ngoài
// và theo từng dòng máy — dùng để tự điền cột "Website" ở trang check-in.

import { NextRequest, NextResponse } from "next/server"
import { getWebStockCounts } from "@/lib/check-in"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const force = new URL(req.url).searchParams.get("refresh") === "1"
    const data = await getWebStockCounts(force)
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Không đọc được tồn kho website" },
      { status: 500 },
    )
  }
}
