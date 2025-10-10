// API chi tiết đơn hàng: /api/ban-hang/[orderId]
import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

const SHEET_NAME = "Ban_Hang"

export async function GET(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await ctx.params
    const { header, rows } = await readFromGoogleSheets(SHEET_NAME)
    // Tìm tất cả các dòng có cùng mã đơn hàng
    const idxIdDon = header.indexOf("ID Đơn Hàng")
    const orderRows = rows.filter((row) => row[idxIdDon] === orderId)
    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }
    // Map thông tin chung từ dòng đầu tiên
    const first = orderRows[0]
    const idx = (name: string) => header.indexOf(name)
    const idxNguon = (() => {
      const i1 = header.indexOf('Nguồn Hàng')
      const i2 = header.indexOf('Nguồn')
      return i1 !== -1 ? i1 : i2
    })()

    const orderDetail = {
      id: orderId,
      ma_don_hang: orderId,
      ngay_ban: first[idx("Ngày Xuất")],
      trang_thai: "hoan_thanh",
      phuong_thuc_thanh_toan: first[idx("Hình Thức Thanh Toán")],
      nhan_vien: { ho_ten: first[idx("Người Bán")] },
      khach_hang: {
        ho_ten: first[idx("Tên Khách Hàng")] || "Khách lẻ",
        so_dien_thoai: first[idx("Số Điện Thoại")] || ""
      },
      chi_tiet: orderRows.map((row, i) => {
          const isMay = !!row[idx("IMEI")];
          return {
            id: `${orderId}_${i}`,
            so_luong: 1,
            gia_ban: isMay ? parseInt((row[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0 : 0,
            thanh_tien: isMay ? parseInt((row[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0 : 0,
            nguon_hang: idxNguon !== -1 ? (row[idxNguon] || '') : '',
            san_pham: isMay ? {
              ten_san_pham: row[idx("Tên Sản Phẩm")],
              loai_may: row[idx("Loại Máy")],
              dung_luong: row[idx("Dung Lượng")],
              mau_sac: row[idx("Màu Sắc")],
              imei: row[idx("IMEI")],
            } : undefined,
            phu_kien: !isMay && row[idx("Phụ Kiện")] ? { ten_phu_kien: row[idx("Phụ Kiện")], loai_phu_kien: "" } : undefined
          }
      }),
      tong_tien: orderRows.reduce((s, r) => {
        const isMay = !!r[idx("IMEI")];
        return s + (isMay ? (parseInt((r[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0) : 0);
      }, 0),
      thanh_toan: orderRows.reduce((s, r) => {
        const isMay = !!r[idx("IMEI")];
        return s + (isMay ? (parseInt((r[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0) : 0);
      }, 0),
      giam_gia: 0,
      ghi_chu: first[idx("Ghi Chú")],
    }
    return NextResponse.json(orderDetail)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
