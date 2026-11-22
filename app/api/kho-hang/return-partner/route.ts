import { NextResponse } from "next/server"
import { logProductHistory, colIndex, readFromGoogleSheets, syncToGoogleSheets } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"
import { getServerUser } from "@/lib/auth"
import { notifyPartnerReturn, type PartnerDevice } from "@/lib/partner-telegram"

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
    const idxTen = colIndex(header, "Tên Sản Phẩm")
    const idxIMEI = colIndex(header, "IMEI")
    const idxSerial = colIndex(header, "Serial")
    const idxTrangThaiHT = idxTrangThai

    if (idxId === -1 || idxTrangThai === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột ID Máy hoặc Trạng Thái" }, { status: 400 })
    }

    const trangThaiCuArr: string[] = []
    // Ghi lại thông tin máy + ghi chú gửi đối tác TRƯỚC khi xoá ghi chú (để báo Telegram)
    const returned: PartnerDevice[] = []
    const updatedRows = rows.map(row => {
      if (productIds.includes(row[idxId])) {
        if (String(row[idxTrangThaiHT] || "") === "Giao đối tác") {
          returned.push({
            name: idxTen !== -1 ? row[idxTen] : undefined,
            imei: idxIMEI !== -1 ? row[idxIMEI] : undefined,
            serial: idxSerial !== -1 ? row[idxSerial] : undefined,
            note: idxGhiChu !== -1 ? String(row[idxGhiChu] || "") : "",
          })
        }
        trangThaiCuArr.push(row[idxTrangThai] || "Giao đối tác")
        row[idxTrangThai] = "Còn hàng"
        
        // Loại bỏ ghi chú giao đối tác nếu có
        if (idxGhiChu !== -1) {
          const currentNotes = row[idxGhiChu] || ""
          row[idxGhiChu] = currentNotes.replace(/\|\s*\[GiaoĐốiTác:.*?\]/, "").replace(/\[GiaoĐốiTác:.*?\]/, "").trim()
          // (ghi chú cũ dạng "… | [GiaoĐốiTác…]" hoặc chỉ "[GiaoĐốiTác…]" đều được xoá)
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

    // Telegram: topic Kho "Hoàn đơn gửi đối tác" + trả lời tin gốc ở topic Gửi đối tác "Đã hoàn"
    try {
      const user = getServerUser(req as any)
      await notifyPartnerReturn(returned, user?.name || employeeId || "")
    } catch (e) {
      console.warn("[return-partner] Telegram thất bại:", e)
    }

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
