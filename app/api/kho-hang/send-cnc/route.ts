import { NextResponse } from "next/server"
import { moveProductsToCNC, logProductHistory } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"
import { sendStockEventNotification } from "@/lib/telegram"

export async function POST(req: Request) {
  try {
  const { productIds, cncAddress, employeeId } = await req.json()
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Vui lòng chọn sản phẩm cần gửi CNC." }, { status: 400 })
    }
    if (!cncAddress || !cncAddress.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập địa chỉ CNC." }, { status: 400 })
    }
    // Lấy trạng thái cũ từ sheet Kho_Hang
    const { header, rows } = await import("@/lib/google-sheets").then(m => m.readFromGoogleSheets("Kho_Hang"))
    const idxId = header.indexOf("ID Máy")
    const idxTen = header.indexOf("Tên Sản Phẩm")
    const idxSerial = header.indexOf("Serial")
    const idxTrangThai = header.indexOf("Trạng Thái")
    // Chuẩn hóa danh sách ID Máy cần chuyển: nhận cả IMEI, 5 số cuối IMEI hoặc ID Máy
    const idxIMEI = header.indexOf("IMEI")
    const idsToMove = rows
      .filter(r => {
        const idMay = r[idxId] || ""
        const imei = r[idxIMEI] || ""
        const imeiLast5 = imei.slice(-5)
        return productIds.includes(idMay) || productIds.includes(imei) || productIds.includes(imeiLast5)
      })
      .map(r => r[idxId])
    if (idsToMove.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm cần chuyển" }, { status: 400 })
    }
    const trangThaiCuArr = idsToMove.map(id => {
      const row = rows.find(r => r[idxId] === id)
      return row ? row[idxTrangThai] : ""
    })
    // Di chuyển sản phẩm sang sheet CNC, cập nhật trạng thái, ghi lịch sử
    const moveResult = await moveProductsToCNC(idsToMove, cncAddress)
    if (!moveResult.success) {
      return NextResponse.json({ error: moveResult.error || "Lỗi khi chuyển sản phẩm sang CNC." }, { status: 500 })
    }
  const logResult = await logProductHistory(idsToMove, "Đang CNC", employeeId || "", trangThaiCuArr);
    if (!logResult.success) {
      return NextResponse.json({ error: "Chuyển sản phẩm thành công nhưng ghi lịch sử thất bại." }, { status: 500 })
    }
    try {
      await addNotification({
        tieu_de: "Chuyển sản phẩm sang CNC",
        noi_dung: `Số lượng: ${idsToMove.length} • Địa chỉ: ${cncAddress}`,
        loai: "kho_hang",
        nguoi_gui_id: employeeId || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) { console.warn('[NOTIFY] send-cnc fail:', e) }
    try {
      const devices = rows
        .filter(r => idsToMove.includes(r[idxId]))
        .map(r => ({
          name: idxTen !== -1 ? r[idxTen] : undefined,
          imei: idxIMEI !== -1 ? r[idxIMEI] : undefined,
          serial: idxSerial !== -1 ? r[idxSerial] : undefined,
        }))
      await sendStockEventNotification({
        type: "send_cnc",
        total: idsToMove.length,
        address: cncAddress,
        devices,
        employee: employeeId,
      })
    } catch (e) { console.warn('[TG] send-cnc message fail:', e) }
    return NextResponse.json({ success: true, message: `Đã gửi CNC thành công cho ${productIds.length} sản phẩm!` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ? `Lỗi hệ thống: ${e.message}` : "Lỗi gửi CNC, vui lòng thử lại." }, { status: 500 })
  }
}
