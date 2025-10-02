import { NextResponse } from "next/server";
import { appendToGoogleSheets, logProductHistory } from "@/lib/google-sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Các trường cần: ten_san_pham, loai_may, dung_luong, tinh_trang, imei, dia_chi_bao_hanh, ngay_gui, khach_hang, employeeId
    const {
      ten_san_pham,
      loai_may,
      dung_luong,
      tinh_trang,
      imei,
      dia_chi_bao_hanh,
      ngay_gui,
      khach_hang,
      so_dien_thoai,
      employeeId,
      loi
    } = body;
    // Tạo ID Máy là 5 số cuối của IMEI
    const id_may = imei ? imei.slice(-5) : "";
    if (!ten_san_pham || !imei || !dia_chi_bao_hanh || !ngay_gui || !khach_hang || !so_dien_thoai) {
      return NextResponse.json({ success: false, error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }
    // Đọc header sheet Bao_Hanh để map đúng thứ tự cột
    const { header } = await import("@/lib/google-sheets").then(m => m.readFromGoogleSheets("Bao_Hanh"));
    const newRow = header.map(col => {
      switch (col) {
        case "ID Máy": return id_may;
        case "Tên Sản Phẩm": return ten_san_pham;
        case "IMEI": return imei;
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
