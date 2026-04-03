import { NextResponse } from "next/server"
import { readFromGoogleSheets, colIndex } from "@/lib/google-sheets"



export const dynamic = "force-dynamic"

const SHEET = "CNC"

export async function GET() {
  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    // Map dữ liệu đúng thứ tự cột sheet CNC
    const idx = {
      id: colIndex(header, "ID Máy"),
      ten_san_pham: colIndex(header, "Tên Sản Phẩm"),
      imei: colIndex(header, "IMEI", "imei", "Imei"),
      mau_sac: colIndex(header, "Màu Sắc"),
      nguon: colIndex(header, "Nguồn"),
      tinh_trang: colIndex(header, "Tình trạng"),
      loai_may: colIndex(header, "Loại Máy"),
      trang_thai: colIndex(header, "Trạng Thái"),
      dia_chi_cnc: colIndex(header, "Địa chỉ CNC"),
      ngay_gui: colIndex(header, "Ngày gửi"),
      ngay_nhan_lai: colIndex(header, "Ngày nhận lại"),
      ten_khach_hang: colIndex(header, "Tên khách hàng", "Khách hàng", "Tên khách"),
      so_dien_thoai: colIndex(header, "Số điện thoại", "SĐT", "sdt", "SDT"),
      do_sim: colIndex(header, "Dạng Sim", "Dạng sim", "Kiểu dạng sim"),
    }

    const data = rows.map(row => ({
      id: row[idx.id],
      ten_san_pham: row[idx.ten_san_pham],
      imei: row[idx.imei],
      mau_sac: idx.mau_sac !== -1 ? row[idx.mau_sac] : "",
      nguon: row[idx.nguon],
      tinh_trang: row[idx.tinh_trang],
      loai_may: row[idx.loai_may],
      trang_thai: row[idx.trang_thai],
      dia_chi_cnc: row[idx.dia_chi_cnc],
      ngay_gui: row[idx.ngay_gui],
      ngay_nhan_lai: row[idx.ngay_nhan_lai],
      ten_khach_hang: row[idx.ten_khach_hang],
      so_dien_thoai: row[idx.so_dien_thoai],
      do_sim: idx.do_sim !== -1 ? row[idx.do_sim] : "",
    }))
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: "Lỗi lấy dữ liệu CNC" }, { status: 500 })
  }
}
