// /api/tai-chinh/bao-cao-21h — lịch sử báo cáo (GET), chạy/gửi lại ngay, áp dụng giá đề xuất (POST). Chủ shop.
import { NextResponse, type NextRequest } from "next/server"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { taiDuLieu } from "@/lib/tai-chinh/du-lieu"
import { taoBaoCao21h, luuBaoCao, lichSuBaoCao, tinTelegram, guiTelegramChuShop } from "@/lib/tai-chinh/bao-cao-21h"
import { KHOA_PHU } from "@/lib/tai-chinh/cai-dat"
import { apDungGia } from "@/lib/tai-chinh/ghi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const d = await taiDuLieu()
    const hienTai = await taoBaoCao21h(d, c.active) // bản xem trực tiếp theo số liệu lúc này (không lưu)
    return NextResponse.json({ hienTai, lichSu: (await lichSuBaoCao()).slice(0, 60), active: c.active })
  } catch (e) {
    return loiApi(e)
  }
}

export async function POST(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    if (b.action === "chay") {
      const d = await taiDuLieu()
      const bc = await taoBaoCao21h(d, "all")
      let daGui = "Không gửi"
      if (b.gui) {
        const link = `${req.nextUrl.origin}/dashboard/tai-chinh/bao-cao-21h`
        const r = await guiTelegramChuShop(d.caiDat.phu[KHOA_PHU.telegramChatId], tinTelegram(bc, link))
        daGui = r.ok ? `Đã gửi (chạy tay ${bc.taoLuc})` : `Lỗi: ${r.error}`
      }
      await luuBaoCao(bc, daGui)
      return NextResponse.json({ ok: true, baoCao: bc, daGui })
    }
    if (b.action === "ap-dung-gia") {
      const ds = Array.isArray(b.items) ? b.items : []
      if (!ds.length) return NextResponse.json({ error: "Chọn máy cần áp dụng giá" }, { status: 400 })
      const n = await apDungGia(
        ds.map((x: any) => ({ dongKho: Number(x.dongKho), idMay: String(x.idMay || ""), imei: String(x.imei || ""), giaMoi: Number(x.giaMoi), lyDo: String(x.lyDo || "Giá đề xuất") })),
        c.tenNguoi,
      )
      return NextResponse.json({ ok: true, updated: n })
    }
    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 })
  } catch (e) {
    return loiApi(e)
  }
}
