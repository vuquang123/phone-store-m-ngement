// GET /api/tai-chinh/uu-tien — mọi máy tồn kèm điểm ưu tiên + giá đề xuất. Chủ shop.
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { taiDuLieu } from "@/lib/tai-chinh/du-lieu"
import { danhSachUuTien } from "@/lib/tai-chinh/bao-cao"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const d = await taiDuLieu()
    return NextResponse.json({ may: danhSachUuTien(d, c.active, false), caiDat: d.caiDat.caiDat, homNay: d.homNay })
  } catch (e) {
    return loiApi(e)
  }
}
