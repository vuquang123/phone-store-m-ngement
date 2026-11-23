// GET /api/tai-chinh/tong-quan — Dashboard tài chính (chủ shop).
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { taiDuLieu, luuTinhTrangSoLo } from "@/lib/tai-chinh/du-lieu"
import { tongQuan, congNo, danhSachUuTien } from "@/lib/tai-chinh/bao-cao"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const d = await taiDuLieu()
    await luuTinhTrangSoLo(d).catch((e) => console.error("[Tài chính] lưu tình trạng sổ lô:", e))
    const cn = congNo(d, c.active)
    return NextResponse.json({
      ...tongQuan(d, c.active),
      lich: cn.lich,
      canhBao: cn.canhBao,
      top5: danhSachUuTien(d, c.active).slice(0, 5),
      caiDat: d.caiDat.caiDat,
      active: c.active,
    })
  } catch (e) {
    return loiApi(e)
  }
}
