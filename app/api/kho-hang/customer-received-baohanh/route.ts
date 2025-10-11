import { NextResponse } from "next/server";
import { readFromGoogleSheets, updateRowInGoogleSheets, logProductHistory } from "@/lib/google-sheets";
import { addNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const { imei, employeeId } = await req.json();
    if (!imei) {
      return NextResponse.json({ success: false, error: "Thiếu IMEI" }, { status: 400 });
    }
    // Đọc sheet Bao_Hanh
    const { header, rows } = await readFromGoogleSheets("Bao_Hanh");
    const idxIMEI = header.indexOf("IMEI");
    const idxTrangThai = header.indexOf("Trạng Thái");
    if (idxIMEI === -1 || idxTrangThai === -1) {
      return NextResponse.json({ success: false, error: "Sheet Bao_Hanh thiếu cột IMEI hoặc Trạng Thái" }, { status: 500 });
    }
    // Tìm và cập nhật trạng thái
    const updatedRows = rows.map(row => {
      if (row[idxIMEI] === imei) {
        row[idxTrangThai] = "Khách đã nhận";
      }
      return row;
    });
    await updateRowInGoogleSheets("Bao_Hanh", "IMEI", "", updatedRows);
    // Ghi lịch sử trạng thái
    await logProductHistory([imei.slice(-5)], "Khách đã nhận", employeeId || "", ["Đã trả khách"]);
    try {
      await addNotification({
        tieu_de: "Khách đã nhận (Bảo hành)",
        noi_dung: `IMEI: ${imei}`,
        loai: "kho_hang",
        nguoi_gui_id: employeeId || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) { console.warn('[NOTIFY] customer-received-baohanh fail:', e) }
    return NextResponse.json({ success: true, message: "Đã cập nhật trạng thái Khách đã nhận!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi cập nhật trạng thái" }, { status: 500 });
  }
}
