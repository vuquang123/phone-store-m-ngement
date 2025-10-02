import { NextRequest, NextResponse } from "next/server"
import { updateRowInGoogleSheets } from "@/lib/google-sheets"

const SHEET = "Kho_Hang"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // body: { id_may, ngay_nhap, ten_san_pham, loai_may, dung_luong, mau_sac, imei, pin, tinh_trang_may, gia_nhap, gia_ban, ghi_chu, trang_thai }
    // Tạo mảng dữ liệu mới đúng thứ tự cột trong sheet Kho_Hang
    const newRow = [
      body.id_may || "",
      body.ngay_nhap || "",
      body.ten_san_pham || "",
      body.loai_may || "",
      body.dung_luong || "",
      body.mau_sac || "",
      body.imei || "",
      body.pin || "",
      body.tinh_trang_may || "",
      body.gia_nhap || "",
      body.gia_ban || "",
      body.ghi_chu || "",
      body.trang_thai || ""
    ]
    // Cập nhật dòng có imei trùng
    const result = await updateRowInGoogleSheets(SHEET, "IMEI", body.imei, newRow)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Lỗi cập nhật sản phẩm" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, updated: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
