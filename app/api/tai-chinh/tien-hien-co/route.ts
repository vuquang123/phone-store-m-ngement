// /api/tai-chinh/tien-hien-co — Tiền hiện có (chủ shop).
//   GET                                     -> nguồn tiền + tổng + lịch sử
//   POST  { ten, loai, chiNhanh, soDu? }    -> thêm nguồn
//   PUT   { soDu: { [id]: number }, ghiChu } -> lưu số dư (đóng dấu thời gian mọi nguồn đang dùng)
//   PATCH { id, ten?, loai?, chiNhanh?, an?, thuTu? } -> sửa / ẩn / hiện nguồn
//   PUT   { tienDon: { tienMat, chuyenKhoan, the, soNgayThe } } -> nguồn nhận tiền đơn theo hình thức
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { BRANCHES } from "@/lib/branches"
import { LOAI_NGUON, docLichSuTien, luuSoDu, suaNguonTien, themNguonTien, tomTatTien } from "@/lib/tai-chinh/tien-hien-co"
import { taiTienHienCo } from "@/lib/tai-chinh/tien-don"
import { KHOA_PHU, ghiCaiDat } from "@/lib/tai-chinh/cai-dat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const [t, lichSu] = await Promise.all([taiTienHienCo(c.active), docLichSuTien(100)])
    return NextResponse.json({
      nguon: t.soDu.map(({ _dong, ...n }) => n),
      tomTat: t.tomTat,
      tomTatTatCa: tomTatTien(t.nguon, "all", t.khoan),
      tienDon: { caiDat: t.caiDat, khoan: t.khoan.filter((k) => k.trangThai !== "Trước lần nhập số dư").slice(0, 200) },
      lichSu,
      loai: LOAI_NGUON,
      chiNhanh: BRANCHES.map((b) => b.name),
      active: c.active,
    })
  } catch (e) {
    return loiApi(e)
  }
}

export async function POST(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    const id = await themNguonTien(c.tenNguoi, { ten: b.ten, loai: b.loai, chiNhanh: b.chiNhanh, soDu: b.soDu, ghiChu: b.ghiChu })
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return loiApi(e)
  }
}

export async function PUT(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    if (b.tienDon) {
      const v = b.tienDon
      const id = (x: unknown) => (x === "" || x === null || x === undefined ? "-" : String(x))
      await ghiCaiDat({
        [KHOA_PHU.tienDonTienMat]: id(v.tienMat),
        [KHOA_PHU.tienDonChuyenKhoan]: id(v.chuyenKhoan),
        [KHOA_PHU.tienDonThe]: id(v.the),
        [KHOA_PHU.tienDonSoNgayThe]: Math.max(0, Math.min(30, Math.round(Number(v.soNgayThe) || 0))),
      })
      return NextResponse.json({ ok: true })
    }
    const soDu: Record<string, number> = {}
    for (const [k, v] of Object.entries(b.soDu || {})) {
      if (v === "" || v === null || v === undefined) continue
      soDu[k] = Math.round(Number(v) || 0)
    }
    const n = await luuSoDu(c.tenNguoi, soDu, String(b.ghiChu || ""))
    return NextResponse.json({ ok: true, soNguon: n })
  } catch (e) {
    return loiApi(e)
  }
}

export async function PATCH(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    if (!b.id) return NextResponse.json({ error: "Thiếu id nguồn" }, { status: 400 })
    await suaNguonTien(c.tenNguoi, String(b.id), {
      ten: b.ten,
      loai: b.loai,
      chiNhanh: b.chiNhanh,
      an: typeof b.an === "boolean" ? b.an : undefined,
      thuTu: b.thuTu !== undefined ? Number(b.thuTu) : undefined,
      ghiChu: b.ghiChu,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return loiApi(e)
  }
}
