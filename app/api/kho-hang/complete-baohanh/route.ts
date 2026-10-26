import { NextResponse } from "next/server"
import { updateBaoHanhStatus, readFromGoogleSheets, colIndex } from "@/lib/google-sheets"


import { addNotification } from "@/lib/notifications"
import { sendStockEventNotification } from "@/lib/telegram"

export async function POST(req: Request) {
  try {
    const { ids, employeeId } = await req.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu danh sách sản phẩm!" }, { status: 400 })
    }
    let devices: { name?: string; imei?: string; serial?: string }[] = []
    try {
      const { header, rows } = await readFromGoogleSheets("Bao_Hanh")
      const idxId = colIndex(header, "ID Máy")
      const idxTen = colIndex(header, "Tên Sản Phẩm")
      const idxIMEI = colIndex(header, "IMEI")
      const idxSerial = colIndex(header, "Serial")

      // Lọc bỏ ô rỗng trước khi so: dòng iPad có IMEI trống, để "" lọt vào
      // phép so là mọi dòng trống IMEI đều bị gom nhầm vào tin báo Telegram.
      const wanted = new Set((ids as any[]).map(v => String(v || "").trim().toUpperCase()).filter(Boolean))
      const hit = (v: any) => {
        const s = String(v || "").trim().toUpperCase()
        return !!s && (wanted.has(s) || wanted.has(s.slice(-5)))
      }
      devices = rows
        .filter(r => {
          const idVal = idxId !== -1 ? r[idxId] : ""
          const imeiVal = idxIMEI !== -1 ? r[idxIMEI] : ""
          const serialVal = idxSerial !== -1 ? r[idxSerial] : ""
          return hit(idVal) || hit(imeiVal) || hit(serialVal)
        })
        .map(r => ({
          name: idxTen !== -1 ? r[idxTen] : undefined,
          imei: idxIMEI !== -1 ? r[idxIMEI] : undefined,
          serial: idxSerial !== -1 ? r[idxSerial] : undefined,
        }))
    } catch (e) {
      console.warn("[TG] complete-baohanh fetch devices fail:", e)
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
        try {
          await sendStockEventNotification({
            type: "complete_warranty",
            total: ids.length,
            devices,
            employee: employeeId,
          })
        } catch (e) { console.warn('[TG] complete-baohanh message fail:', e) }
      return NextResponse.json({ success: true, message: `Đã hoàn thành bảo hành cho ${ids.length} sản phẩm!` })
    } else {
      return NextResponse.json({ success: false, error: result.error || updateKhoResult.error || "Lỗi cập nhật!" }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Lỗi hệ thống!" }, { status: 500 })
  }
}
