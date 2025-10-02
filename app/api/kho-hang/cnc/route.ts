import { NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEET = "CNC"

export async function GET() {
  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    // Map dữ liệu đúng thứ tự cột sheet CNC
    const idx = {
      id: header.indexOf("ID Máy"),
      ten_san_pham: header.indexOf("Tên Sản Phẩm"),
      imei: header.indexOf("Imei") !== -1 ? header.indexOf("Imei") : header.indexOf("IMEI"),
      nguon: header.indexOf("Nguồn"),
      tinh_trang: header.indexOf("Tình trạng"),
      loai_may: header.indexOf("Loại Máy"),
      trang_thai: header.indexOf("Trạng Thái"),
      dia_chi_cnc: header.indexOf("Địa chỉ CNC"),
      ngay_gui: header.indexOf("Ngày gửi"),
      ngay_nhan_lai: header.indexOf("Ngày nhận lại"),
      ten_khach_hang: header.indexOf("Tên khách hàng"),
      so_dien_thoai: header.indexOf("Số điện thoại"),
    }
    const data = rows.map(row => ({
      id: row[idx.id],
      ten_san_pham: row[idx.ten_san_pham],
      imei: row[idx.imei],
      nguon: row[idx.nguon],
      tinh_trang: row[idx.tinh_trang],
      loai_may: row[idx.loai_may],
      trang_thai: row[idx.trang_thai],
      dia_chi_cnc: row[idx.dia_chi_cnc],
      ngay_gui: row[idx.ngay_gui],
      ngay_nhan_lai: row[idx.ngay_nhan_lai],
      ten_khach_hang: row[idx.ten_khach_hang],
      so_dien_thoai: row[idx.so_dien_thoai],
    }))
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: "Lỗi lấy dữ liệu CNC" }, { status: 500 })
  }
}
