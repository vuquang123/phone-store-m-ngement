// /api/tai-chinh/cong-no — công nợ đầu hàng (GET) và ghi nhận trả tiền, tự phân bổ FIFO (POST). Chủ shop.
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { taiDuLieu } from "@/lib/tai-chinh/du-lieu"
import { congNo } from "@/lib/tai-chinh/bao-cao"
import { ghiTraNo } from "@/lib/tai-chinh/ghi"
import { listCashAccountsForFinance } from "@/lib/cash-flow/sheets"
import { logAdminChanges } from "@/lib/audit-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const [d, nguonTien] = await Promise.all([taiDuLieu(), listCashAccountsForFinance()])
    return NextResponse.json({ ...congNo(d, c.active), nguonTien: nguonTien.filter((a) => a.available), homNay: d.homNay, active: c.active })
  } catch (e) {
    return loiApi(e)
  }
}

export async function POST(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    const r = await ghiTraNo({
      dauHangId: String(b.dauHangId || ""),
      soTien: Number(b.soTien) || 0,
      ngay: b.ngay || undefined,
      maLo: String(b.maLo || ""),
      nguonTienId: String(b.nguonTienId || ""),
      ghiChu: String(b.ghiChu || ""),
      nguoiGhi: c.tenNguoi,
    })
    await logAdminChanges(c.user, [
      { table: "Tra_No_Dau_Hang", action: "Trả nợ đầu hàng", key: String(b.dauHangId), column: "Số Tiền", newValue: `${Math.round(Number(b.soTien))} · ${JSON.stringify(r.phanBo)}` },
    ]).catch(() => {})
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return loiApi(e)
  }
}
