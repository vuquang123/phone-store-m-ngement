import { NextResponse } from "next/server"
import { addNotification, getNotifications } from "@/lib/notifications"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const items = await getNotifications()
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi tải thông báo" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tieu_de, noi_dung, loai = "he_thong", nguoi_gui_id = "system", nguoi_nhan_id = "all" } = body || {}
    if (!tieu_de || !noi_dung) {
      return NextResponse.json({ error: "Thiếu tiêu đề hoặc nội dung" }, { status: 400 })
    }
    const result = await addNotification({ tieu_de, noi_dung, loai, nguoi_gui_id, nguoi_nhan_id })
    return NextResponse.json({ success: true, id: result.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi tạo thông báo" }, { status: 500 })
  }
}
