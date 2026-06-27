// app/api/tien-mat/route.ts
// API quỹ tiền mặt: GET (số dư + tổng hợp + lịch sử), POST (ghi thu/chi).

import { NextRequest, NextResponse } from "next/server"
import { getCashEntries, getCashBalance, recordCashTransaction } from "@/lib/cash"
import { getServerUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const entries = await getCashEntries()
    const totalThu = entries.reduce((s, e) => s + (e.loai === "thu" ? e.so_tien : 0), 0)
    const totalChi = entries.reduce((s, e) => s + (e.loai === "chi" ? e.so_tien : 0), 0)
    const balance = totalThu - totalChi

    return NextResponse.json({
      success: true,
      balance,
      summary: { totalThu, totalChi, count: entries.length },
      entries,
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Lỗi tải quỹ tiền mặt" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getServerUser(req)
    const body = await req.json().catch(() => ({}))

    const loai = String(body?.loai || "").trim().toLowerCase()
    if (loai !== "thu" && loai !== "chi") {
      return NextResponse.json({ success: false, error: 'loai phải là "thu" hoặc "chi"' }, { status: 400 })
    }

    const so_tien = Number(String(body?.so_tien ?? "").replace(/[^\d]/g, ""))
    if (!Number.isFinite(so_tien) || so_tien <= 0) {
      return NextResponse.json({ success: false, error: "Số tiền phải lớn hơn 0" }, { status: 400 })
    }

    if (loai === "chi") {
      const balance = await getCashBalance()
      if (so_tien > balance) {
        return NextResponse.json(
          { success: false, error: `Số dư không đủ (hiện có ${balance.toLocaleString("vi-VN")}₫)` },
          { status: 400 },
        )
      }
    }

    const nhan_vien = user?.name || user?.email || body?.nhan_vien || ""
    const image_base64 = typeof body?.image_base64 === "string" ? body.image_base64 : ""
    const ghi_chu = (body?.ghi_chu || "") + (image_base64 ? " 📎" : "")

    const { id, balanceAfter } = await recordCashTransaction({
      loai: loai as "thu" | "chi",
      so_tien,
      nguon: "thu_cong",
      ma_tham_chieu: "",
      ly_do: body?.ly_do || "",
      nhan_vien,
      ghi_chu,
      image_base64,
    })

    return NextResponse.json({ success: true, id, balance: balanceAfter })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Lỗi ghi quỹ tiền mặt" },
      { status: 500 },
    )
  }
}
