import { NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEETS = {
  BAN_HANG: "Ban_Hang",
  KHO_HANG: "Kho_Hang",
  PHU_KIEN: "Phu_Kien",
} as const

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "_").toLowerCase()

function colIndex(header: string[], ...names: string[]) {
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

function parseToEpoch(s: any): number {
  if (!s) return 0
  const str = String(s)
  const t = Date.parse(str)
  if (!Number.isNaN(t)) return t
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const [_, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m
    return new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss).getTime()
  }
  return 0
}

export async function GET() {
  try {
    // Đọc dữ liệu từ Google Sheets
    const [bh, kh, pk] = await Promise.all([
      readFromGoogleSheets(SHEETS.BAN_HANG),
      readFromGoogleSheets(SHEETS.KHO_HANG),
      readFromGoogleSheets(SHEETS.PHU_KIEN),
    ])

    // Đơn hàng mới
    const BH = {
      idDon: colIndex(bh.header, "Mã Đơn Hàng", "ID Đơn Hàng", "id"),
      thanhToan: colIndex(bh.header, "Thanh Toán", "thanh_toan"),
      ngayBan: colIndex(bh.header, "Ngày Bán", "Ngày Xuất", "ngay_ban"),
      tenKH: colIndex(bh.header, "Tên Khách Hàng", "Khách Hàng", "ten_khach_hang"),
      nhanVien: colIndex(bh.header, "Người Bán", "Nhân Viên", "nhan_vien_ban"),
    }

    const recentOrders = bh.rows
      .map((r) => ({
        ma_don_hang: BH.idDon !== -1 ? r[BH.idDon] : "",
        thanh_toan: BH.thanhToan !== -1 ? r[BH.thanhToan] : "",
        ngay_ban: BH.ngayBan !== -1 ? r[BH.ngayBan] : "",
        khach_hang: { ho_ten: BH.tenKH !== -1 ? r[BH.tenKH] : "Khách lẻ" },
        nhan_vien: { ho_ten: BH.nhanVien !== -1 ? r[BH.nhanVien] : "" },
      }))
      .filter((x) => x.ngay_ban)
      .sort((a, b) => parseToEpoch(b.ngay_ban) - parseToEpoch(a.ngay_ban))
      .slice(0, 5)

    // Nhập kho mới
    const KH = {
      id: colIndex(kh.header, "ID"),
      tenSP: colIndex(kh.header, "Tên Sản Phẩm", "ten_san_pham"),
      loaiMay: colIndex(kh.header, "Loại Máy", "loai_may"),
      loaiPhuKien: colIndex(kh.header, "Loại Phụ Kiện", "loai_phu_kien"),
      dungLuong: colIndex(kh.header, "Dung Lượng", "dung_luong"),
      mauSac: colIndex(kh.header, "Màu Sắc", "mau_sac"),
      tinhTrang: colIndex(kh.header, "Tình Trạng Máy", "tinh_trang"),
      ngayNhap: colIndex(kh.header, "Ngày Nhập", "ngay_nhap"),
      nguoiNhap: colIndex(kh.header, "Người Nhập", "nguoi_nhap"),
    }

    const recentStock = kh.rows
      .map((item) => {
        // Nếu có Loại Máy thì là sản phẩm máy, nếu có Loại Phụ Kiện thì là phụ kiện
        const loai_may = KH.loaiMay !== -1 ? item[KH.loaiMay] : ""
        const loai_phu_kien = KH.loaiPhuKien !== -1 ? item[KH.loaiPhuKien] : ""
        return {
          ten_san_pham: KH.tenSP !== -1 ? item[KH.tenSP] : "",
          loai_may,
          loai_phu_kien,
          dung_luong: KH.dungLuong !== -1 ? item[KH.dungLuong] : "",
          mau_sac: KH.mauSac !== -1 ? item[KH.mauSac] : "",
          tinh_trang: KH.tinhTrang !== -1 ? item[KH.tinhTrang] : "",
          ngay_nhap: KH.ngayNhap !== -1 ? item[KH.ngayNhap] : "",
          nguoi_nhap: { ho_ten: KH.nguoiNhap !== -1 ? item[KH.nguoiNhap] : "" },
        }
      })
      .filter((x) => x.ngay_nhap)
      .sort((a, b) => parseToEpoch(b.ngay_nhap) - parseToEpoch(a.ngay_nhap))
      .slice(0, 5)

    // Sản phẩm sắp hết
    const PK = {
      id: colIndex(pk.header, "ID"),
      tenSP: colIndex(pk.header, "Tên Sản Phẩm", "ten_san_pham"),
      loai: colIndex(pk.header, "Loại", "loai"),
      soLuong: colIndex(pk.header, "Số Lượng", "so_luong"),
    }

    const lowStockAlert = pk.rows
      .map((r) => ({
        id: PK.id !== -1 ? r[PK.id] : undefined,
        ten_san_pham: PK.tenSP !== -1 ? r[PK.tenSP] : undefined,
        loai: PK.loai !== -1 ? r[PK.loai] : undefined,
        so_luong: Number(PK.soLuong !== -1 ? r[PK.soLuong] : 0),
      }))
      .filter((x) => Number.isFinite(x.so_luong) && x.so_luong <= 5)
      .sort((a, b) => a.so_luong - b.so_luong)

    // Gộp activities
    const activities: any[] = []

    recentOrders.forEach((order) => {
      activities.push({
        type: "order",
        title: `Đơn hàng mới ${order.ma_don_hang}`,
        description: `${order.khach_hang?.ho_ten || "Khách lẻ"} - ₫${Number(order.thanh_toan).toLocaleString()}`,
        time: order.ngay_ban,
        icon: "shopping-cart",
      })
    })

    recentStock.forEach((item) => {
      activities.push({
        type: "stock",
        title: "Nhập kho mới",
        description:
          item.loai_may
            ? `${item.ten_san_pham} ${item.loai_may} ${item.dung_luong} - ${item.tinh_trang}`
            : `${item.ten_san_pham} ${item.loai_phu_kien} ${item.dung_luong} - ${item.tinh_trang}`,
        time: item.ngay_nhap,
        icon: "package",
      })
    })

    activities.sort((a, b) => parseToEpoch(b.time) - parseToEpoch(a.time))

    const res = NextResponse.json({
      activities: activities.slice(0, 10),
      lowStockAlert: lowStockAlert || [],
    })
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30")
    return res
  } catch (error) {
    console.error("Recent activities error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
