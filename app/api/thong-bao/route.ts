import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Demo in-memory notifications (có thể thay bằng đọc DB/Sheets sau)
export async function GET() {
  const now = new Date()
  const iso = now.toISOString()
  const sample = [
    {
      id: "1",
      tieu_de: "Thông báo hệ thống",
      noi_dung: "Chào mừng bạn đến với hệ thống quản lý cửa hàng.",
      loai: "he_thong",
      trang_thai: "chua_doc",
      nguoi_gui_id: "system",
      nguoi_nhan_id: "all",
      created_at: iso,
      updated_at: iso,
    },
    {
      id: "2",
      tieu_de: "Cập nhật tính năng",
      noi_dung: "Một số cải tiến hiệu năng đã được áp dụng.",
      loai: "he_thong",
      trang_thai: "chua_doc",
      nguoi_gui_id: "system",
      nguoi_nhan_id: "all",
      created_at: iso,
      updated_at: iso,
    },
  ]
  return NextResponse.json(sample)
}
