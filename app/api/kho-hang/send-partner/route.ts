import { NextResponse } from "next/server"
import { updateProductsStatus, logProductHistory, colIndex, readFromGoogleSheets, syncToGoogleSheets } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"
import { sendStockEventNotification } from "@/lib/telegram"
import { DateTime } from "luxon"

export async function POST(req: Request) {
  try {
    const { productIds, partnerName, employeeId } = await req.json()
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Vui lòng chọn sản phẩm cần giao đối tác." }, { status: 400 })
    }
    if (!partnerName || !partnerName.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên đối tác." }, { status: 400 })
    }

    // Đọc dữ liệu kho hàng để cập nhật trạng thái và ghi chú
    const { header, rows } = await readFromGoogleSheets("Kho_Hang")
    const idxId = colIndex(header, "ID Máy")
    const idxTrangThai = colIndex(header, "Trạng Thái")
    const idxGhiChu = colIndex(header, "Ghi Chú")
    const idxTen = colIndex(header, "Tên Sản Phẩm")
    const idxIMEI = colIndex(header, "IMEI")
    const idxSerial = colIndex(header, "Serial")

    if (idxId === -1 || idxTrangThai === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột ID Máy hoặc Trạng Thái" }, { status: 400 })
    }

    const nowVN = DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("dd/MM/yyyy")
    const partnerInfo = `[GiaoĐốiTác: ${partnerName} - ${nowVN}]`

    const trangThaiCuArr: string[] = []
    const updatedRows = rows.map(row => {
      if (productIds.includes(row[idxId])) {
        trangThaiCuArr.push(row[idxTrangThai] || "Còn hàng")
        row[idxTrangThai] = "Giao đối tác"
        
        // Cập nhật ghi chú
        if (idxGhiChu !== -1) {
          const currentNotes = row[idxGhiChu] || ""
          if (!currentNotes.includes("GiaoĐốiTác:")) {
            row[idxGhiChu] = currentNotes ? `${currentNotes} | ${partnerInfo}` : partnerInfo
          } else {
            // Cập nhật đè nếu đã có note giao đối tác trước đó (trường hợp sửa đổi)
            row[idxGhiChu] = currentNotes.replace(/\[GiaoĐốiTác:.*?\]/, partnerInfo)
          }
        }
      }
      return row
    })

    const syncResult = await syncToGoogleSheets("Kho_Hang", updatedRows)
    if (!syncResult.success) {
      return NextResponse.json({ error: "Lỗi đồng bộ kho hàng: " + syncResult.error }, { status: 500 })
    }

    // Ghi lịch sử
    await logProductHistory(productIds, "Giao đối tác", employeeId || "", trangThaiCuArr)

    // Thông báo
    try {
      await addNotification({
        tieu_de: "Giao sản phẩm cho đối tác",
        noi_dung: `Đối tác: ${partnerName} • Số lượng: ${productIds.length}`,
        loai: "kho_hang",
        nguoi_gui_id: employeeId || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) {}

    try {
      const devices = rows
        .filter(r => productIds.includes(r[idxId]))
        .map(r => ({
          name: idxTen !== -1 ? r[idxTen] : undefined,
          imei: idxIMEI !== -1 ? r[idxIMEI] : undefined,
          serial: idxSerial !== -1 ? r[idxSerial] : undefined,
        }))

      await sendStockEventNotification({
        type: "send_partner" as any,
        total: productIds.length,
        partner: partnerName,
        devices,
        employee: employeeId,
      })
    } catch (e) {}

    return NextResponse.json({ success: true, message: `Đã giao ${productIds.length} máy cho đối tác ${partnerName}` })
  } catch (error: any) {
    console.error("send-partner error:", error)
    return NextResponse.json({ error: error.message || "Lỗi xử lý giao đối tác" }, { status: 500 })
  }
}
