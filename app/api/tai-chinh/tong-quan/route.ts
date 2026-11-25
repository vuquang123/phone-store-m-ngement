// GET /api/tai-chinh/tong-quan — Dashboard tài chính (chủ shop).
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { taiDuLieu, luuTinhTrangSoLo } from "@/lib/tai-chinh/du-lieu"
import { tongQuan, congNo, danhSachUuTien } from "@/lib/tai-chinh/bao-cao"
import { docNguonTien, tomTatTien } from "@/lib/tai-chinh/tien-hien-co"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const [d, nguon] = await Promise.all([taiDuLieu(), docNguonTien().catch(() => [])])
    await luuTinhTrangSoLo(d).catch((e) => console.error("[Tài chính] lưu tình trạng sổ lô:", e))
    const cn = congNo(d, c.active)
    const tq = tongQuan(d, c.active)
    const tien = tomTatTien(nguon, c.active)
    // Tài sản ròng = tiền hiện có + vốn tồn kho (giá nhập) + khách còn nợ − nợ đầu hàng còn lại.
    // Chỉ tính khi đã nhập Tiền hiện có, nếu không con số sẽ thiếu hẳn phần tiền.
    const taiSanRong = tien.coDuLieu ? tien.tong + tq.vonTon + tq.khachConNo - tq.tongNo : null
    return NextResponse.json({
      ...tq,
      tienHienCo: tien,
      taiSanRong,
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
