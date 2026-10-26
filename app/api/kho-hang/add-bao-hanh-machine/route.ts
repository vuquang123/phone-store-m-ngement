import { NextResponse } from "next/server";
import { appendToGoogleSheets, ensureColumn, logProductHistory } from "@/lib/google-sheets";
import { getDeviceId, last5FromDeviceId } from "@/lib/device-id";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Các trường cần: ten_san_pham, loai_may, dung_luong, tinh_trang, imei|serial, dia_chi_bao_hanh, ngay_gui, khach_hang, employeeId
    const {
      ten_san_pham,
      loai_may,
      dung_luong,
      tinh_trang,
      imei,
      serial,
      dia_chi_bao_hanh,
      ngay_gui,
      khach_hang,
      so_dien_thoai,
      employeeId,
      loi
    } = body;

    const imeiStr = String(imei || "").trim();
    const serialStr = String(serial || "").trim().toUpperCase();
    // iPad bản Wi-Fi không có IMEI -> chấp nhận Serial thay thế.
    const deviceId = getDeviceId({ IMEI: imeiStr, Serial: serialStr });
    // ID Máy = 5 ký tự cuối của định danh (IMEI nếu có, không thì Serial).
    const id_may = deviceId ? last5FromDeviceId(deviceId) : "";

    if (!ten_san_pham || !deviceId || !dia_chi_bao_hanh || !ngay_gui || !khach_hang || !so_dien_thoai) {
      return NextResponse.json({ success: false, error: "Thiếu thông tin bắt buộc (cần IMEI hoặc Serial)" }, { status: 400 });
    }

    // Sheet Bao_Hanh vốn chỉ có cột IMEI. Chỉ thêm cột Serial khi thực sự có
    // serial để ghi, và chỉ nối thêm vào cuối nên các cột cũ không bị đụng.
    if (serialStr) {
      await ensureColumn("Bao_Hanh", "Serial");
    }

    // Đọc header sheet Bao_Hanh để map đúng thứ tự cột
    const { header } = await import("@/lib/google-sheets").then(m => m.readFromGoogleSheets("Bao_Hanh", undefined, { force: true }));
    const newRow = header.map(col => {
      switch (col.trim()) {
        case "ID Máy": return id_may;
        case "Tên Sản Phẩm": return ten_san_pham;
        case "IMEI": return imeiStr;
        case "Serial": return serialStr;
        case "Màu Sắc": return body.mau_sac || "";
        case "Nguồn": return body.nguon || "Khách ngoài";
        case "Tình trạng": return tinh_trang || "";
        case "Loại Máy": return loai_may || "";
        case "Lỗi": return loi || "";
        case "Trạng Thái": return "Bảo hành";
        case "Địa chỉ Bảo hành": return dia_chi_bao_hanh;
        case "Ngày gửi": return ngay_gui;
        case "Ngày nhận lại": return body.ngay_nhan_lai || "";
        case "Tên khách hàng": return khach_hang || "";
        case "Số điện thoại": return so_dien_thoai || "";
        default: return "";
      }
    });
    await appendToGoogleSheets("Bao_Hanh", newRow);
    // Ghi lịch sử trạng thái
    await logProductHistory([id_may], "Bảo hành", employeeId || "", ["Khách ngoài"]);
    return NextResponse.json({ success: true, message: "Đã thêm máy vào mục Bảo hành thành công!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi thêm máy Bảo hành" }, { status: 500 });
  }
}
