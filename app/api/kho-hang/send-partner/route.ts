import { NextResponse } from "next/server"
import { logProductHistory, colIndex, readFromGoogleSheets, syncToGoogleSheets, batchUpdateRangeValues } from "@/lib/google-sheets"
import { indexToCol } from "@/lib/sheet-store/a1"
import { getServerUser } from "@/lib/auth"
import { addNotification } from "@/lib/notifications"
import { sendStockEventNotification } from "@/lib/telegram"
import { DateTime } from "luxon"
import { isConHangStatus, normalizePhoneVN } from "@/lib/utils/inventory-helpers"

export async function POST(req: Request) {
  try {
    const { productIds, partnerName, partnerPhone, employeeId } = await req.json()
    const user = getServerUser(req as any)
    const employee = user?.name || employeeId || ""

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Vui lòng chọn sản phẩm cần giao đối tác." }, { status: 400 })
    }
    if (!partnerName || !String(partnerName).trim()) {
      return NextResponse.json({ error: "Vui lòng nhập tên đối tác." }, { status: 400 })
    }
    const phone = normalizePhoneVN(partnerPhone)
    if (!phone) {
      return NextResponse.json({ error: "Vui lòng nhập SĐT đối tác hợp lệ (9–11 số)." }, { status: 400 })
    }
    // Ký tự | và ] dùng làm dấu phân cách trong ghi chú -> bỏ khỏi tên
    const name = String(partnerName).replace(/[|\[\]]/g, " ").replace(/\s+/g, " ").trim()

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

    // Chỉ gửi được máy đang còn hàng (tránh gửi nhầm máy đã bán / đang CNC / đã gửi)
    const notAvailable = rows.filter(
      (r) => productIds.includes(r[idxId]) && !isConHangStatus(r[idxTrangThai] || "Còn hàng"),
    )
    if (notAvailable.length) {
      const names = notAvailable.map((r) => (idxTen !== -1 ? r[idxTen] : r[idxId])).slice(0, 3).join(", ")
      return NextResponse.json(
        { error: `Có ${notAvailable.length} máy không còn ở trạng thái Còn hàng (${names}). Tải lại trang rồi thử lại.` },
        { status: 409 },
      )
    }

    const nowVN = DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("dd/MM/yyyy")
    const partnerInfo = `[GiaoĐốiTác: ${name} | ${phone} | ${nowVN}]`

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
        tieu_de: "Gửi máy cho đối tác",
        noi_dung: `Đối tác: ${name} (${phone}) • Số lượng: ${productIds.length}`,
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

      const tg: any = await sendStockEventNotification({
        type: "send_partner" as any,
        total: productIds.length,
        partner: `${name} - ${phone}`,
        devices,
        employee,
      })
      // Lưu mã tin Telegram vào ghi chú từng máy -> khi hoàn kho / xuất bán sẽ trả lời đúng tin này
      const msgId = Number(tg?.message_id)
      if (idxGhiChu !== -1 && Number.isFinite(msgId) && msgId > 0) {
        const tagged = partnerInfo.replace(/\]$/, ` | tg ${msgId}]`)
        const col = indexToCol(idxGhiChu)
        const items: { range: string; values: any[][] }[] = []
        updatedRows.forEach((row, i) => {
          if (!productIds.includes(row[idxId])) return
          items.push({ range: `'Kho_Hang'!${col}${i + 2}`, values: [[String(row[idxGhiChu] || "").replace(partnerInfo, tagged)]] })
        })
        await batchUpdateRangeValues(items)
      }
    } catch (e) {
      console.warn("[send-partner] Telegram / lưu mã tin thất bại:", e)
    }

    return NextResponse.json({ success: true, message: `Đã gửi ${productIds.length} máy cho đối tác ${name}` })
  } catch (error: any) {
    console.error("send-partner error:", error)
    return NextResponse.json({ error: error.message || "Lỗi xử lý giao đối tác" }, { status: 500 })
  }
}
