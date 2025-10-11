import { NextResponse } from "next/server"
import { updateBaoHanhStatus } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"

export async function POST(req: Request) {
  try {
    const { ids, employeeId } = await req.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu danh sách sản phẩm!" }, { status: 400 })
    }
    // Gọi hàm cập nhật trạng thái bảo hành trong Google Sheets
    const result = await updateBaoHanhStatus(ids, employeeId)
    // Sau khi hoàn thành bảo hành, chuyển trạng thái sản phẩm trong sheet Kho_Hang về "Còn hàng"
    const updateKhoResult = await import("@/lib/google-sheets").then(mod => mod.updateProductsStatus(ids, "Còn hàng"))
    if (result.success && updateKhoResult.success) {
      try {
        await addNotification({
          tieu_de: "Hoàn thành bảo hành",
          noi_dung: `Số lượng: ${ids.length}`,
          loai: "kho_hang",
          nguoi_gui_id: employeeId || "system",
          nguoi_nhan_id: "all",
        })
      } catch (e) { console.warn('[NOTIFY] complete-baohanh fail:', e) }
      return NextResponse.json({ success: true, message: `Đã hoàn thành bảo hành cho ${ids.length} sản phẩm!` })
    } else {
      return NextResponse.json({ success: false, error: result.error || updateKhoResult.error || "Lỗi cập nhật!" }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Lỗi hệ thống!" }, { status: 500 })
  }
}
