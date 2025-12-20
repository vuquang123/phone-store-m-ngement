import { NextResponse } from "next/server"
import { updateProductsStatus, logProductHistory } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"
import { buildStockEventMessage, sendTelegramMessage } from "@/lib/telegram"

export async function POST(req: Request) {
  try {
    const { productIds, employeeId, products } = await req.json()
    console.log("productIds:", productIds)
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu danh sách sản phẩm" }, { status: 400 })
    }
    // Cập nhật trạng thái cho nhiều sản phẩm
    await updateProductsStatus(productIds, "Bảo hành")
    await logProductHistory(productIds, "Bảo hành", employeeId)

    // Thêm mới từng sản phẩm vào sheet Bao_Hanh
    const { header } = await import("@/lib/google-sheets").then(m => m.readFromGoogleSheets("Bao_Hanh"))
    const appendToGoogleSheets = (await import("@/lib/google-sheets")).appendToGoogleSheets
    for (const p of products as any[]) {
      // Map các trường đúng thứ tự header
      const row = header.map((col: string) => {
        switch (col) {
          case "ID Máy": return p.id || ""
          case "Tên Sản Phẩm": return p.ten_san_pham || ""
          case "Loại Máy": return p.loai_may || ""
          case "IMEI": return p.imei || ""
          case "Nguồn": return p.nguon || ""
          case "Tình trạng": return p.tinh_trang || ""
          case "Lỗi": return p.loi || ""
          case "Trạng Thái": return p["Trạng Thái"] || "Bảo hành"
          case "Địa chỉ Bảo hành": return p.dia_chi_bao_hanh || ""
          case "Ngày gửi": return new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN")
          case "Ngày nhận lại": return ""
          case "Tên khách hàng": return p.ten_khach_hang || ""
          case "Số điện thoại": return p.so_dien_thoai || ""
          default: return ""
        }
      })
      await appendToGoogleSheets("Bao_Hanh", row)
    }

    try {
      await addNotification({
        tieu_de: "Chuyển sản phẩm đi bảo hành",
        noi_dung: `Số lượng: ${productIds.length}`,
        loai: "kho_hang",
        nguoi_gui_id: employeeId || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) { console.warn('[NOTIFY] return-baohanh fail:', e) }
    try {
      const address = Array.isArray(products) ? (products.find((p: any) => p?.dia_chi_bao_hanh)?.dia_chi_bao_hanh || "") : ""
      const devices = Array.isArray(products)
        ? products.map((p: any) => ({ name: p.ten_san_pham, imei: p.imei, serial: p.serial }))
        : []
      const { text, threadId } = buildStockEventMessage({
        type: "send_warranty",
        total: productIds.length,
        address,
        devices,
        employee: employeeId,
      })
      await sendTelegramMessage(text, undefined, { message_thread_id: threadId })
    } catch (e) { console.warn('[TG] send_warranty message fail:', e) }
    return NextResponse.json({ success: true, message: `Đã trả bảo hành cho ${productIds.length} sản phẩm!` })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Lỗi không xác định" }, { status: 500 })
  }
}
