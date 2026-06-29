// app/api/ghi-chu/route.ts
// API ghi chú bàn giao ca: GET (list), POST (tạo), PATCH (hoàn thành).
// Ưu tiên LƯU SHEET trước; Telegram + thông báo là best-effort (không chặn việc đã lưu).

import { NextResponse } from "next/server"
import { getNotes, addNote, completeNote, buildNoteMessage } from "@/lib/ghi-chu"
import { sendTelegramMessage } from "@/lib/telegram"
import { getServerUser } from "@/lib/auth"
import { addNotification } from "@/lib/notifications"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NOTE_THREAD = Number(process.env.TELEGRAM_THREAD_NOTE) || 37551

export async function GET() {
  try {
    const items = await getNotes(300)
    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Lỗi đọc ghi chú" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = getServerUser(req as { headers: Headers })
    const body = await req.json().catch(() => ({}))
    const noiDung = String(body?.noiDung || "").trim()
    if (!noiDung) {
      return NextResponse.json({ success: false, error: "Nội dung không được để trống" }, { status: 400 })
    }
    const nguoiTao = user?.name || user?.email || "N/A"

    // LƯU SHEET trước
    const note = await addNote({ noiDung, nguoiTao })

    // best-effort: Telegram + thông báo nội bộ
    try {
      const tg = await sendTelegramMessage(buildNoteMessage(note, "created"), "note", { message_thread_id: NOTE_THREAD })
      if (!tg?.success) console.error("[ghi-chu] Telegram created fail:", tg)
    } catch (e) { console.error("[ghi-chu] Telegram created error:", e) }
    try {
      await addNotification({
        loai: "ghi_chu",
        tieu_de: "Ghi chú mới",
        noi_dung: `${noiDung} • NV: ${nguoiTao}`,
        nguoi_nhan_id: "all",
      })
    } catch {}

    return NextResponse.json({ success: true, id: note.id })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Lỗi tạo ghi chú" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = getServerUser(req as { headers: Headers })
    const body = await req.json().catch(() => ({}))
    const id = String(body?.id || "").trim()
    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 })
    }
    const nguoiHoanThanh = user?.name || user?.email || "N/A"

    // LƯU SHEET trước
    const note = await completeNote(id, nguoiHoanThanh)
    if (!note) {
      return NextResponse.json({ success: false, error: "Không tìm thấy ghi chú" }, { status: 404 })
    }

    // best-effort: Telegram + thông báo nội bộ
    try {
      const tg = await sendTelegramMessage(buildNoteMessage(note, "completed"), "note", { message_thread_id: NOTE_THREAD })
      if (!tg?.success) console.error("[ghi-chu] Telegram completed fail:", tg)
    } catch (e) { console.error("[ghi-chu] Telegram completed error:", e) }
    try {
      await addNotification({
        loai: "ghi_chu",
        tieu_de: "Ghi chú hoàn thành",
        noi_dung: `${note.noiDung} • Hoàn thành: ${nguoiHoanThanh}`,
        nguoi_nhan_id: "all",
      })
    } catch {}

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Lỗi cập nhật ghi chú" }, { status: 500 })
  }
}
