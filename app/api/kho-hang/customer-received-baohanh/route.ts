import { NextResponse } from "next/server";
import { readFromGoogleSheets, updateRowInGoogleSheets, logProductHistory, colIndex } from "@/lib/google-sheets";
import { getDeviceId, last5FromDeviceId, normalizeIdentifier } from "@/lib/device-id";


import { addNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const { imei, serial, employeeId } = await req.json();
    // iPad Wi-Fi không có IMEI -> nhận Serial thay thế.
    const deviceId = getDeviceId({ IMEI: imei, Serial: serial });
    if (!deviceId) {
      return NextResponse.json({ success: false, error: "Thiếu IMEI hoặc Serial" }, { status: 400 });
    }
    // Đọc sheet Bao_Hanh
    const { header, rows } = await readFromGoogleSheets("Bao_Hanh");
    const idxIMEI = colIndex(header, "IMEI");
    const idxSerial = colIndex(header, "Serial");
    const idxTrangThai = colIndex(header, "Trạng Thái");

    if (idxIMEI === -1 || idxTrangThai === -1) {
      return NextResponse.json({ success: false, error: "Sheet Bao_Hanh thiếu cột IMEI hoặc Trạng Thái" }, { status: 500 });
    }
    // So sánh sau khi trim + viết hoa, và BỎ QUA ô rỗng: nếu không, một máy
    // iPad (IMEI trống) sẽ khớp với mọi dòng khác cũng đang trống IMEI.
    const wanted = normalizeIdentifier(deviceId);
    const updatedRows = rows.map(row => {
      const rowImei = normalizeIdentifier(row[idxIMEI]);
      const rowSerial = idxSerial !== -1 ? normalizeIdentifier(row[idxSerial]) : "";
      if ((rowImei && rowImei === wanted) || (rowSerial && rowSerial === wanted)) {
        row[idxTrangThai] = "Khách đã nhận";
      }
      return row;
    });
    await updateRowInGoogleSheets("Bao_Hanh", "IMEI", "", updatedRows);
    // Ghi lịch sử trạng thái
    await logProductHistory([last5FromDeviceId(deviceId)], "Khách đã nhận", employeeId || "", ["Đã trả khách"]);
    try {
      await addNotification({
        tieu_de: "Khách đã nhận (Bảo hành)",
        noi_dung: imei ? `IMEI: ${imei}` : `Serial: ${serial}`,
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
