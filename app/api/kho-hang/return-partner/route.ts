import { NextResponse } from "next/server"
import { logProductHistory, colIndex, readFromGoogleSheets, syncToGoogleSheets } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"

export async function POST(req: Request) {
  try {
    const { productIds, employeeId } = await req.json()
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Vui lòng chọn sản phẩm cần hoàn kho." }, { status: 400 })
    }

    // Đọc dữ liệu kho hàng
    const { header, rows } = await readFromGoogleSheets("Kho_Hang")
    const idxId = colIndex(header, "ID Máy")
    const idxTrangThai = colIndex(header, "Trạng Thái")
    const idxGhiChu = colIndex(header, "Ghi Chú")

    if (idxId === -1 || idxTrangThai === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột ID Máy hoặc Trạng Thái" }, { status: 400 })
    }

    const trangThaiCuArr: string[] = []
    const updatedRows = rows.map(row => {
      if (productIds.includes(row[idxId])) {
        trangThaiCuArr.push(row[idxTrangThai] || "Giao đối tác")
        row[idxTrangThai] = "Còn hàng"
        
        // Loại bỏ ghi chú giao đối tác nếu có
        if (idxGhiChu !== -1) {
          const currentNotes = row[idxGhiChu] || ""
          row[idxGhiChu] = currentNotes.replace(/\|\s*\[GiaoĐốiTác:.*?\]/, "").replace(/\[GiaoĐốiTác:.*?\]/, "").trim()
        }
      }
      return row
    })

    const syncResult = await syncToGoogleSheets("Kho_Hang", updatedRows)
    if (!syncResult.success) {
      return NextResponse.json({ error: "Lỗi đồng bộ kho hàng: " + syncResult.error }, { status: 500 })
    }

    // Ghi lịch sử
    await logProductHistory(productIds, "Còn hàng (Hoàn từ đối tác)", employeeId || "", trangThaiCuArr)

    // Thông báo
    try {
      await addNotification({
        tieu_de: "Hoàn sản phẩm từ đối tác",
        noi_dung: `Số lượng: ${productIds.length} máy đã hoàn về kho`,
        loai: "kho_hang",
        nguoi_gui_id: employeeId || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) {}

    return NextResponse.json({ success: true, message: `Đã hoàn ${productIds.length} máy về kho thành công` })
  } catch (error: any) {
    console.error("return-partner error:", error)
    return NextResponse.json({ error: error.message || "Lỗi xử lý hoàn kho" }, { status: 500 })
  }
}
