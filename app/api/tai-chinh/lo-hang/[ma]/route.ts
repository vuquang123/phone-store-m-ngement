// /api/tai-chinh/lo-hang/[ma] — chi tiết 1 lô (sổ lô đủ máy), sửa thông tin từng máy, gán máy kho vào lô.
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { taiDuLieu } from "@/lib/tai-chinh/du-lieu"
import { chiTietLo } from "@/lib/tai-chinh/bao-cao"
import { suaMayLo, ganMayKhoVaoLo, chuyenMayTuLoCu, ganMayDaBanVaoLo } from "@/lib/tai-chinh/ghi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ ma: string }> }) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const { ma } = await params
    const d = await taiDuLieu()
    const ct = chiTietLo(d, decodeURIComponent(ma))
    if (!ct) return NextResponse.json({ error: "Không tìm thấy lô" }, { status: 404 })
    return NextResponse.json({ ...ct, ctv: d.ctv, dauHang: d.dauHang, homNay: d.homNay })
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
    await suaMayLo(Number(b.dong), {
      giaSan: pick("giaSan"),
      giaNhap: pick("giaNhap"),
      ctvGiu: pick("ctvGiu"),
      ctvBan: pick("ctvBan"),
      hoaHong: pick("hoaHong"),
      phiTraGop: pick("phiTraGop"),
      phiKhac: pick("phiKhac"),
      daThuDu: pick("daThuDu"),
      ghiChu: pick("ghiChu"),
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return loiApi(e)
  }
}

/** POST { dongKho: number[] } — gán máy đang tồn (chưa có lô) vào lô này. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ ma: string }> }) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const { ma } = await params
    const b = await req.json()
    // { dongSo: number[] } — chuyển máy còn tồn từ lô cũ (LO-CU-KHONG-RO) sang lô này
    // { daBan: string[] } — gắn bù máy đã bán (khoá "mãĐơn|IMEI") vào lô này
    if (Array.isArray(b.daBan)) {
      const n = await ganMayDaBanVaoLo(decodeURIComponent(ma), b.daBan.map(String))
      return NextResponse.json({ ok: true, added: n })
    }
    if (Array.isArray(b.dongSo)) {
      const n = await chuyenMayTuLoCu(decodeURIComponent(ma), b.dongSo.map(Number).filter((x: number) => x >= 2))
      return NextResponse.json({ ok: true, added: n })
    }
    const ds = Array.isArray(b.dongKho) ? b.dongKho.map(Number).filter((n: number) => n >= 2) : []
    if (!ds.length) return NextResponse.json({ error: "Chọn máy" }, { status: 400 })
    const n = await ganMayKhoVaoLo(decodeURIComponent(ma), ds)
    return NextResponse.json({ ok: true, added: n })
  } catch (e) {
    return loiApi(e)
  }
}
