// ---------------------------------------------------------------------------
// Tổng kết ca làm — phục vụ trang /nhanvien/dashboard (bàn giao giữa các ca).
//
// GET /api/nhan-vien/tong-ket-ca?date=YYYY-MM-DD&shift=ca1|ca2|ca3|all
//
// Toàn bộ phần tính nằm ở lib/reports/tong-ket.ts để dùng chung với báo cáo
// Telegram 22h — hai nơi phải ra cùng một con số.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server"
import { DateTime } from "luxon"
import { TIMEZONE, getShift } from "@/lib/shift"
import { buildSummary } from "@/lib/reports/tong-ket"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const shift = getShift(sp.get("shift"))
    const dateParam = sp.get("date")
    const day = dateParam
      ? DateTime.fromISO(dateParam, { zone: TIMEZONE }).startOf("day")
      : DateTime.now().setZone(TIMEZONE).startOf("day")
    if (!day.isValid) {
      return NextResponse.json({ error: "Tham số date không hợp lệ" }, { status: 400 })
    }

    return NextResponse.json(await buildSummary(day, shift))
  } catch (err: any) {
    console.error("[tong-ket-ca] error:", err)
    return NextResponse.json(
      { error: err?.message || "Không thể tổng hợp ca làm" },
      { status: 500 },
    )
  }
}
