import { NextResponse } from "next/server"
import { markNotificationAsRead } from "@/lib/notifications"

export const dynamic = "force-dynamic"

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id
  try {
    const body = await req.json().catch(() => ({}))
    const { trang_thai } = body || {}
    if (trang_thai === "da_doc") {
      const result = await markNotificationAsRead(id)
      if (!result.success) return NextResponse.json(result, { status: 400 })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi cập nhật thông báo" }, { status: 500 })
  }
}
