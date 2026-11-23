// /api/tai-chinh/lo-hang — danh sách lô + chỉ số (GET), tạo lô (POST), sửa lô (PATCH). Chủ shop.
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { taiDuLieu, luuTinhTrangSoLo, theoChiNhanh } from "@/lib/tai-chinh/du-lieu"
import { khongTinhNo, daRaKhoi } from "@/lib/tai-chinh/tinh-toan"
import { danhSachLo, mayTon } from "@/lib/tai-chinh/bao-cao"
import { taoLo, suaLo } from "@/lib/tai-chinh/ghi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const sp = req.nextUrl.searchParams
    const d = await taiDuLieu()
    await luuTinhTrangSoLo(d).catch((e) => console.error("[Tài chính] lưu tình trạng sổ lô:", e))
    const ds = danhSachLo(d, c.active, {
      dauHang: sp.get("dauHang") || undefined,
      tu: sp.get("tu") || undefined,
      den: sp.get("den") || undefined,
      nhom: sp.get("nhom") || undefined,
      q: sp.get("q") || undefined,
    })
    const chuaLo = mayTon(d, c.active).filter((m) => !m.coLo)
    const maLoCu = new Set(d.lo.filter((l) => khongTinhNo(l)).map((l) => l.ma))
    const loCu = theoChiNhanh(d.may, c.active)
      .filter((m) => maLoCu.has(m.maLo) && !daRaKhoi(m.trangThai))
      .map((m) => ({ dong: m._dong, maLo: m.maLo, ten: m.ten, imei: m.imei || m.serial, mau: m.mau, dungLuong: m.dungLuong, loaiMay: m.loaiMay, giaNhap: m.giaNhap, ngayNhap: m.ngayNhap }))
    return NextResponse.json({
      lo: ds.map(({ lo, ...x }) => ({ ...x, lo })),
      dauHang: d.dauHang,
      chuaLo: chuaLo.map((m) => ({ dongKho: m.dongKho, ten: m.ten, imei: m.imei || m.serial, giaNhap: m.giaNhap, ngayNhap: m.ngayNhap, chiNhanh: m.chiNhanh })),
      loCu,
      homNay: d.homNay,
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
    if (c.active === "all") return NextResponse.json({ error: "Chọn chi nhánh (DEV PỒ hoặc T1s) trước khi tạo lô" }, { status: 400 })
    const b = await req.json()
    const ma = await taoLo({
      dauHangId: String(b.dauHangId || ""),
      ngayNhap: b.ngayNhap || undefined,
      chiPhiLo: Number(b.chiPhiLo) || 0,
      chiPhiTraDauHang: !!b.chiPhiTraDauHang,
      daTraLucNhap: Number(b.daTraLucNhap) || 0,
      hanTra: b.hanTra || "",
      tongHoaDon: Number(b.tongHoaDon) || 0,
      ghiChu: String(b.ghiChu || ""),
      chiNhanh: c.chiNhanhGhi,
      nguoiTao: c.tenNguoi,
    })
    return NextResponse.json({ ok: true, ma })
  } catch (e) {
    return loiApi(e)
  }
}

export async function PATCH(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    const pick = (k: string) => (b[k] === undefined ? undefined : b[k])
    await suaLo(String(b.ma || ""), {
      dauHangId: pick("dauHangId"),
      ngayNhap: pick("ngayNhap"),
      chiPhiLo: pick("chiPhiLo"),
      chiPhiTraDauHang: pick("chiPhiTraDauHang"),
      daTraLucNhap: pick("daTraLucNhap"),
      hanTra: pick("hanTra"),
      tongHoaDon: pick("tongHoaDon"),
      ghiChu: pick("ghiChu"),
      trangThai: pick("trangThai"),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return loiApi(e)
  }
}
