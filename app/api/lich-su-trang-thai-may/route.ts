import { NextRequest, NextResponse } from "next/server"
import { appendToGoogleSheets } from "@/lib/google-sheets"

const SHEET = "Lich_Su_Trang_Thai_May"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // body: { id_may, imei, ten_san_pham, trang_thai_cu, trang_thai_moi, thoi_gian, nguoi_thay_doi }
    // Ưu tiên lấy ID nhân viên từ body.nguoi_thay_doi, nếu không có thì để trống
    const newRow = [
      body.id_may || "",
      body.imei || "",
      body.ten_san_pham || "",
      body.trang_thai_cu || "",
      body.trang_thai_moi || "",
      body.thoi_gian || new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      body.nguoi_thay_doi || ""
    ]
    const result = await appendToGoogleSheets(SHEET, newRow)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Lỗi ghi lịch sử" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, created: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
