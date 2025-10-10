// app/api/kho-hang/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, updateRangeValues } from "@/lib/google-sheets"

const SHEETS = {
  KHO_HANG: "Kho_Hang",
  USERS: "USERS",
} as const

/* ================= Helpers ================= */
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .toLowerCase()

function colIndex(header: string[], ...names: string[]) {
  // match chính xác
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  // fallback normalize
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

function toColumnLetter(n: number) {
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - m) / 26)
  }
  return s
}

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "")

function idxKhoHang(header: string[]) {
  return {
    idMay: colIndex(header, "ID Máy"),
    ngayNhap: colIndex(header, "Ngày Nhập"),
    tenSP: colIndex(header, "Tên Sản Phẩm"),
    loaiMay: colIndex(header, "Loại Máy"),
    dungLuong: colIndex(header, "Dung Lượng"),
    pin: colIndex(header, "Pin (%)"),
    mauSac: colIndex(header, "Màu Sắc"),
    imei: colIndex(header, "IMEI"),
    tinhTrang: colIndex(header, "Tình Trạng Máy"),
    giaNhap: colIndex(header, "Giá Nhập"),
    giaBan: colIndex(header, "Giá Bán"),
    ghiChu: colIndex(header, "Ghi Chú"),
    trangThai: colIndex(header, "Trạng Thái"),
  }
}

/* ================= GET ================= */
export async function GET(_request: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
    const params = 'params' in ctx && typeof (ctx as any).params?.then === 'function'
      ? await (ctx as any).params
      : (ctx as any).params
    const { header, rows } = await readFromGoogleSheets(SHEETS.KHO_HANG)
    const K = idxKhoHang(header)
    if (K.idMay === -1) return NextResponse.json({ error: "Kho_Hang thiếu cột 'ID Máy'" }, { status: 500 })

    const rowIdx = rows.findIndex((r) => String(r[K.idMay]) === String(params.id))
    if (rowIdx === -1) return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 })

    const r = rows[rowIdx]
    // Map về dạng snake_case cho FE đang dùng
    const data = {
      id: r[K.idMay],
      ngay_nhap: K.ngayNhap !== -1 ? r[K.ngayNhap] : null,
      ten_san_pham: K.tenSP !== -1 ? r[K.tenSP] : null,
      loai_may: K.loaiMay !== -1 ? r[K.loaiMay] : null,          // 'loai_phu_kien' = Loại Máy
      dung_luong: K.dungLuong !== -1 ? r[K.dungLuong] : null,
      pin: K.pin !== -1 ? r[K.pin] : null,
      mau_sac: K.mauSac !== -1 ? r[K.mauSac] : null,
      imei: K.imei !== -1 ? r[K.imei] : null,
      tinh_trang: K.tinhTrang !== -1 ? r[K.tinhTrang] : null,
      gia_nhap: K.giaNhap !== -1 ? Number(r[K.giaNhap] || 0) : null,
      gia_ban: K.giaBan !== -1 ? Number(r[K.giaBan] || 0) : null, // map 'Giá Bán'
      ghi_chu: K.ghiChu !== -1 ? r[K.ghiChu] : null,
      trang_thai: K.trangThai !== -1 ? r[K.trangThai] : null,
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("Kho_Hang GET by id error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ================= PUT ================= */
export async function PUT(request: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
    const params = 'params' in ctx && typeof (ctx as any).params?.then === 'function'
      ? await (ctx as any).params
      : (ctx as any).params
    const body = await request.json()
    const {
      ten_san_pham,
      loai_may,          // Loại Máy
      dung_luong,
      mau_sac,
      imei,
      tinh_trang,
      gia_nhap,
      gia_ban,        // map sang Giá Bán
      ghi_chu,
      pin,
      trang_thai,
    } = body

    const { header, rows } = await readFromGoogleSheets(SHEETS.KHO_HANG)
    const K = idxKhoHang(header)
    if (K.idMay === -1) return NextResponse.json({ error: "Kho_Hang thiếu cột 'ID Máy'" }, { status: 500 })

    const rowIdx = rows.findIndex((r) => String(r[K.idMay]) === String(params.id))
    if (rowIdx === -1) return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 })

    // Check IMEI trùng (nếu có gửi)
    if (imei && K.imei !== -1) {
      const target = onlyDigits(String(imei))
      const dup = rows.findIndex((r, i) => i !== rowIdx && onlyDigits(String(r[K.imei] || "")) === target)
      if (dup !== -1) {
        return NextResponse.json({ error: "IMEI đã tồn tại trong hệ thống" }, { status: 400 })
      }
    }

    // Cập nhật hàng hiện tại
    const current = rows[rowIdx].slice()
    if (K.tenSP !== -1 && typeof ten_san_pham !== "undefined") current[K.tenSP] = ten_san_pham
    if (K.loaiMay !== -1 && typeof loai_may !== "undefined") current[K.loaiMay] = loai_may
    if (K.dungLuong !== -1 && typeof dung_luong !== "undefined") current[K.dungLuong] = dung_luong
    if (K.mauSac !== -1 && typeof mau_sac !== "undefined") current[K.mauSac] = mau_sac
    if (K.pin !== -1 && typeof pin !== "undefined") current[K.pin] = pin
    if (K.imei !== -1 && typeof imei !== "undefined") current[K.imei] = imei
    if (K.tinhTrang !== -1 && typeof tinh_trang !== "undefined") current[K.tinhTrang] = tinh_trang
  if (K.giaNhap !== -1 && typeof gia_nhap !== "undefined") current[K.giaNhap] = String(Number(gia_nhap))
  if (K.giaBan !== -1 && typeof gia_ban !== "undefined") current[K.giaBan] = String(Number(gia_ban))
    if (K.ghiChu !== -1 && typeof ghi_chu !== "undefined") current[K.ghiChu] = ghi_chu
    if (K.trangThai !== -1 && typeof trang_thai !== "undefined") current[K.trangThai] = trang_thai

    const rowNumber = rowIdx + 2
    const lastCol = toColumnLetter(header.length)
    await updateRangeValues(`${SHEETS.KHO_HANG}!A${rowNumber}:${lastCol}${rowNumber}`, [current])

    // Trả về theo định dạng snake_case giống GET
    const data = {
      id: current[K.idMay],
      ngay_nhap: K.ngayNhap !== -1 ? current[K.ngayNhap] : null,
      ten_san_pham: K.tenSP !== -1 ? current[K.tenSP] : null,
      loai_may: K.loaiMay !== -1 ? current[K.loaiMay] : null,
      dung_luong: K.dungLuong !== -1 ? current[K.dungLuong] : null,
      pin: K.pin !== -1 ? current[K.pin] : null,
      mau_sac: K.mauSac !== -1 ? current[K.mauSac] : null,
      imei: K.imei !== -1 ? current[K.imei] : null,
      tinh_trang: K.tinhTrang !== -1 ? current[K.tinhTrang] : null,
      gia_nhap: K.giaNhap !== -1 ? Number(current[K.giaNhap] || 0) : null,
      gia_ban: K.giaBan !== -1 ? Number(current[K.giaBan] || 0) : null,
      ghi_chu: K.ghiChu !== -1 ? current[K.ghiChu] : null,
      trang_thai: K.trangThai !== -1 ? current[K.trangThai] : null,
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("Kho_Hang PUT error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ================= DELETE (soft-delete) ================= */
export async function DELETE(request: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
    const params = 'params' in ctx && typeof (ctx as any).params?.then === 'function'
      ? await (ctx as any).params
      : (ctx as any).params
    // Lấy email từ header để kiểm tra quyền (bắt buộc)
    const email = request.headers.get("x-user-email") || ""
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check vai trò trong USERS
    const { header: uh, rows: ur } = await readFromGoogleSheets(SHEETS.USERS)
    const emailIdx = uh.indexOf("Email")
    const roleIdx = uh.indexOf("Vai Trò")
    if (emailIdx === -1 || roleIdx === -1) {
      return NextResponse.json({ error: "USERS thiếu cột Email/Vai Trò" }, { status: 500 })
    }
    const rowUser = ur.find((r) => String(r[emailIdx]).trim().toLowerCase() === email.trim().toLowerCase())
    const role = rowUser ? String(rowUser[roleIdx] || "").trim().toLowerCase() : ""
    const roleNorm = norm(role)
    const isManager = ["quan_ly", "manager", "admin"].some((k) => roleNorm.includes(k))
    if (!isManager) {
      return NextResponse.json({ error: "Chỉ quản lý mới có thể xóa sản phẩm" }, { status: 403 })
    }

    // Soft-delete: đặt Trạng Thái = "Đã xóa"
    const { header, rows } = await readFromGoogleSheets(SHEETS.KHO_HANG)
    const K = idxKhoHang(header)
    if (K.idMay === -1 || K.trangThai === -1) {
      return NextResponse.json({ error: "Kho_Hang thiếu cột ID Máy/Trạng Thái" }, { status: 500 })
    }

    const rowIdx = rows.findIndex((r) => String(r[K.idMay]) === String(params.id))
    if (rowIdx === -1) return NextResponse.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 })

    const rowNumber = rowIdx + 2
    const col = toColumnLetter(K.trangThai + 1)
    await updateRangeValues(`${SHEETS.KHO_HANG}!${col}${rowNumber}`, [["Đã xóa"]])

    // Nếu bạn có util deleteRows trong google-sheets lib, có thể xoá cứng:
    // await deleteRows(SHEETS.KHO_HANG, rowNumber, 1)

    return NextResponse.json({ message: "Đã xóa sản phẩm (đánh dấu)", id: params.id })
  } catch (err) {
    console.error("Kho_Hang DELETE error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
