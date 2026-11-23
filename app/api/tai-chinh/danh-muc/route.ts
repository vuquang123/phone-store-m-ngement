// /api/tai-chinh/danh-muc — đầu hàng và CTV. Chủ shop.
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { docBang, BANG } from "@/lib/tai-chinh/bang"
import { docDauHang } from "@/lib/tai-chinh/du-lieu"
import { themDauHang, suaDauHang, themCtv, suaCtv } from "@/lib/tai-chinh/ghi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const [dh, ctv] = await Promise.all([docBang(BANG.DAU_HANG), docBang(BANG.CTV)])
    return NextResponse.json({
      dauHang: dh.dong.filter((d) => d["ID"]).map(docDauHang),
      ctv: ctv.dong.filter((d) => d["ID"]).map((d) => ({ id: d["ID"], ten: d["Tên"], sdt: d["SĐT"], hoaHong: Number(String(d["Hoa Hồng Mặc Định"] || "0").replace(/\D/g, "")) || 0, ghiChu: d["Ghi Chú"], trangThai: d["Trạng Thái"] || "Đang làm" })),
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
    if (b.loai === "ctv") await themCtv(b)
    else await themDauHang(b)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return loiApi(e)
  }
}

export async function PATCH(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    const { loai, id, ...rest } = b
    if (loai === "ctv") await suaCtv(String(id), rest)
    else await suaDauHang(String(id), rest)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return loiApi(e)
  }
}
