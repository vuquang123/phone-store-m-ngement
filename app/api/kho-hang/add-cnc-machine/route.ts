import { NextResponse } from "next/server";
import { appendToGoogleSheets, logProductHistory } from "@/lib/google-sheets";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Các trường cần: ten_san_pham, loai_may, dung_luong, tinh_trang, imei, dia_chi_cnc, ngay_gui, khach_hang, employeeId
    const {
      ten_san_pham,
      loai_may,
      dung_luong,
      tinh_trang,
      imei,
      dia_chi_cnc,
      ngay_gui,
      khach_hang,
      so_dien_thoai,
      employeeId
    } = body;
    // Tạo ID Máy là 5 số cuối của IMEI
    const id_may = imei ? imei.slice(-5) : "";
    if (!ten_san_pham || !imei || !dia_chi_cnc || !ngay_gui || !khach_hang || !so_dien_thoai) {
      return NextResponse.json({ success: false, error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }
    // Đọc header sheet CNC để map đúng thứ tự cột
    const { header } = await import("@/lib/google-sheets").then(m => m.readFromGoogleSheets("CNC"));
    const newRow = header.map(col => {
      const c = col.trim().toLowerCase();
      if (c === "id máy" || c === "id may") return id_may;
      if (c === "tên sản phẩm" || c === "ten san pham" || c === "tên máy" || c === "ten may" || c === "sản phẩm" || c === "san pham" || c === "model") return ten_san_pham;
      if (c === "imei") return imei;
      if (c === "nguồn" || c === "nguon") return body.nguon || "Khách ngoài";
      if (c === "tình trạng" || c === "tinh trang") return tinh_trang || "";
      if (c === "loại máy" || c === "loai may") return loai_may || "";
      if (c === "trạng thái" || c === "trang thai") return "Đang CNC";
      if (c === "địa chỉ cnc" || c === "dia chi cnc") return dia_chi_cnc;
      if (c === "ngày gửi" || c === "ngay gui") return ngay_gui;
      if (c === "ngày nhận lại" || c === "ngay nhan lai") return body.ngay_nhan_lai || "";
      if (c === "tên khách hàng" || c === "ten khach hang" || c === "khách hàng" || c === "khach hang") return khach_hang || "";
      if (c === "số điện thoại" || c === "so dien thoai" || c === "sđt" || c === "sdt") return so_dien_thoai || "";
      if (c === "màu sắc" || c === "mau sac" || c === "màu" || c === "mau") return body.mau_sac || "";
      if (c === "dạng sim" || c === "dang sim" || c === "kiểu dạng sim") return body.do_sim || "";
      return "";
    });
    await appendToGoogleSheets("CNC", newRow);
    // Ghi lịch sử trạng thái
  await logProductHistory([id_may], "Đang CNC", employeeId || "", ["Khách ngoài"]);
    return NextResponse.json({ success: true, message: "Đã thêm máy CNC ngoài kho thành công!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi thêm máy CNC" }, { status: 500 });
  }
}
