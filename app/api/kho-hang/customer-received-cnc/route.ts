import { NextResponse } from "next/server";
import { readFromGoogleSheets, updateRowInGoogleSheets, logProductHistory } from "@/lib/google-sheets";
import { addNotification } from "@/lib/notifications";

// Alias endpoint cho việc xác nhận khách đã nhận máy sau CNC.
// (Chức năng tương tự /api/kho-hang/customer-received để tránh 405 do front-end gọi khác đường dẫn.)
export async function POST(req: Request) {
  try {
    const { imei, employeeId } = await req.json();
    if (!imei) {
      return NextResponse.json({ success: false, error: "Thiếu IMEI" }, { status: 400 });
    }
    // Đọc sheet CNC
    const { header, rows } = await readFromGoogleSheets("CNC");
    const idxIMEI = header.indexOf("IMEI");
    const idxTrangThai = header.indexOf("Trạng Thái");
    if (idxIMEI === -1 || idxTrangThai === -1) {
      return NextResponse.json({ success: false, error: "Sheet CNC thiếu cột IMEI hoặc Trạng Thái" }, { status: 500 });
    }
    // Cập nhật trạng thái
    const updatedRows = rows.map(row => {
      if (row[idxIMEI] === imei) {
        row[idxTrangThai] = "Khách đã nhận";
      }
      return row;
    });
    await updateRowInGoogleSheets("CNC", "IMEI", "", updatedRows);
    // Ghi lịch sử trạng thái (log theo 5 số cuối IMEI)
    await logProductHistory([imei.slice(-5)], "Khách đã nhận", employeeId || "", ["Hoàn thành CNC"]);
    try {
      await addNotification({
        tieu_de: "Khách đã nhận (CNC)",
        noi_dung: `IMEI: ${imei}`,
        loai: "kho_hang",
        nguoi_gui_id: employeeId || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) { console.warn('[NOTIFY] customer-received-cnc fail:', e) }
    return NextResponse.json({ success: true, message: "Đã cập nhật trạng thái Khách đã nhận!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi cập nhật trạng thái" }, { status: 500 });
  }
}
