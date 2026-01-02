// API chi tiết đơn hàng: /api/ban-hang/[orderId]
import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

const SHEET_NAME = "Ban_Hang"

export async function GET(_request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId: orderIdRaw } = await ctx.params
    const orderId = orderIdRaw.trim()
    const { header, rows } = await readFromGoogleSheets(SHEET_NAME)

    const colIndex = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n)
        if (i !== -1) return i
      }
      return -1
    }

    const idxIdDon = colIndex("ID Đơn Hàng", "Mã Đơn Hàng", "ID", "Id", "id")
    if (idxIdDon === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột ID Đơn Hàng" }, { status: 400 })
    }

    const orderRows = rows.filter((row) => String(row[idxIdDon] || "").trim() === orderId)
    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    const idx = (name: string) => header.indexOf(name)
    const idxNguon = (() => {
      const i1 = header.indexOf("Nguồn Hàng")
      const i2 = header.indexOf("Nguồn")
      return i1 !== -1 ? i1 : i2
    })()
    const idxPhuKien = colIndex("Phụ Kiện")
    const idxChiTietPK = colIndex("Chi Tiết PK", "Chi Tiết Phụ Kiện", "Chi Tiet PK", "Accessory Detail")

    // Map thông tin chung từ dòng đầu tiên
    const first = orderRows[0]

    const orderDetail = {
      id: orderId,
      ma_don_hang: orderId,
      ngay_ban: first[idx("Ngày Xuất")],
      trang_thai: "hoan_thanh",
      phuong_thuc_thanh_toan: first[idx("Hình Thức Thanh Toán")],
      phu_kien_text: idxPhuKien !== -1 ? (first[idxPhuKien] || "") : "",
      phu_kien_detail: idxChiTietPK !== -1 ? (first[idxChiTietPK] || "") : "",
      nhan_vien: { ho_ten: first[idx("Người Bán")] },
      khach_hang: {
        ho_ten: first[idx("Tên Khách Hàng")] || "Khách lẻ",
        so_dien_thoai: first[idx("Số Điện Thoại")] || "",
      },
      chi_tiet: orderRows
        .map((row, i) => {
          const isMay = !!row[idx("IMEI")]
          if (!isMay) return null
          return {
            id: `${orderId}_${i}`,
            so_luong: 1,
            gia_ban: parseInt((row[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0,
            thanh_tien: parseInt((row[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0,
            nguon_hang: idxNguon !== -1 ? (row[idxNguon] || "") : "",
            san_pham: {
              ten_san_pham: row[idx("Tên Sản Phẩm")],
              loai_may: row[idx("Loại Máy")],
              dung_luong: row[idx("Dung Lượng")],
              mau_sac: row[idx("Màu Sắc")],
              imei: row[idx("IMEI")],
            },
          }
        })
        .filter(Boolean) as any[],
      tong_tien: orderRows.reduce((s, r) => {
        const isMay = !!r[idx("IMEI")]
        const gia = parseInt((r[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0
        return s + (isMay ? gia : 0)
      }, 0),
      thanh_toan: orderRows.reduce((s, r) => {
        const isMay = !!r[idx("IMEI")]
        const gia = parseInt((r[idx("Giá Bán")] || "").replace(/[^\d]/g, "")) || 0
        return s + (isMay ? gia : 0)
      }, 0),
      giam_gia: 0,
      ghi_chu: first[idx("Ghi Chú")],
    }

    return NextResponse.json(orderDetail)
  } catch (error: any) {
    const message = error?.message || "Internal server error"
    const isQuota = message.toLowerCase().includes("quota") || error?.code === 429
    if (isQuota) {
      return NextResponse.json({ error: "Đang vượt hạn mức đọc Google Sheets, vui lòng thử lại sau ít giây." }, { status: 429 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
