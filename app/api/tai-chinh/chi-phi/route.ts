import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { BANG, docBang } from "@/lib/tai-chinh/bang"
import { LOAI_CHI_PHI, docChiPhi, homNayVN, theoChiNhanh } from "@/lib/tai-chinh/du-lieu"
import { huyChiPhi, themChiPhi } from "@/lib/tai-chinh/ghi"
import { listCashAccountsForFinance } from "@/lib/cash-flow/sheets"

export const dynamic = "force-dynamic"

// GET ?thang=yyyy-MM  -> danh sách chi phí ngoài của tháng (mặc định tháng này) + tổng theo loại
export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const thang = req.nextUrl.searchParams.get("thang") || homNayVN().slice(0, 7)
    const { dong } = await docBang(BANG.CHI_PHI)
    const tatCa = dong.filter((d) => d["ID"]).map((d) => ({ ...docChiPhi(d), daHuy: /huỷ|hủy/i.test(d["Trạng Thái"] || ""), trangThai: d["Trạng Thái"] || "" }))
    const ds = theoChiNhanh(tatCa, c.active)
      .filter((x) => x.ngay.startsWith(thang))
      .sort((a, b) => (b.ngay + b.id).localeCompare(a.ngay + a.id))
    const theoLoai: Record<string, number> = {}
    for (const x of ds) if (!x.daHuy) theoLoai[x.loai] = (theoLoai[x.loai] || 0) + x.soTien
    const tong = Object.values(theoLoai).reduce((s, v) => s + v, 0)
    let nguonTien: { id: string; name: string; balance: number }[] = []
    try {
      nguonTien = (await listCashAccountsForFinance()).map((a: any) => ({ id: a.id, name: a.name, balance: a.balance }))
    } catch {}
    return NextResponse.json({ thang, ds, theoLoai, tong, loai: LOAI_CHI_PHI, nguonTien })
  } catch (e) {
    return loiApi(e)
  }
}

export async function POST(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    const id = await themChiPhi({
      ngay: b.ngay,
      loai: String(b.loai || "Khác"),
      soTien: Number(b.soTien),
      maDon: b.maDon ? String(b.maDon).trim() : "",
      maLo: b.maLo ? String(b.maLo).trim() : "",
      nguonTienId: b.nguonTienId || "",
      ghiChu: b.ghiChu ? String(b.ghiChu) : "",
      nguoiGhi: c.tenNguoi,
      chiNhanh: c.chiNhanhGhi,
    })
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return loiApi(e)
  }
}

// DELETE ?id=CP_xxx -> huỷ (giữ lịch sử)
export async function DELETE(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const id = req.nextUrl.searchParams.get("id") || ""
    await huyChiPhi(id, c.tenNguoi)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return loiApi(e)
  }
}
