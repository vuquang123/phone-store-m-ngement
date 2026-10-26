import { NextResponse } from "next/server"
import { updateProductsStatus, logProductHistory } from "@/lib/google-sheets"
import { addNotification } from "@/lib/notifications"
import { sendStockEventNotification } from "@/lib/telegram"

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
    const sheetsLib = await import("@/lib/google-sheets")
    // Máy iPad Wi-Fi chỉ có Serial — bổ sung cột Serial cho Bao_Hanh khi cần,
    // nếu không thì định danh của nó mất hẳn khi chuyển sang bảo hành.
    if ((products as any[])?.some((p: any) => String(p?.serial || "").trim())) {
      await sheetsLib.ensureColumn("Bao_Hanh", "Serial")
    }
    const { header } = await sheetsLib.readFromGoogleSheets("Bao_Hanh", undefined, { force: true })
    const appendToGoogleSheets = sheetsLib.appendToGoogleSheets
    for (const p of products as any[]) {
      // Map các trường đúng thứ tự header
      const row = header.map((rawCol: string) => {
        const col = String(rawCol || "").trim()
        switch (col) {
          case "ID Máy": return p.id || ""
          case "Tên Sản Phẩm": return p.ten_san_pham || ""
          case "Loại Máy": return p.loai_may || ""
          case "IMEI": return p.imei || ""
          case "Serial": return String(p.serial || "").trim().toUpperCase()
          case "Màu Sắc": return p.mau_sac || p["Màu Sắc"] || ""
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
      await sendStockEventNotification({
        type: "send_warranty",
        total: productIds.length,
        address,
        devices,
        employee: employeeId,
      })
    } catch (e) { console.warn('[TG] send_warranty message fail:', e) }
    return NextResponse.json({ success: true, message: `Đã trả bảo hành cho ${productIds.length} sản phẩm!` })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Lỗi không xác định" }, { status: 500 })
  }
}
