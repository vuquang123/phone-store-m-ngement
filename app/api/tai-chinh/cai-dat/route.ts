// /api/tai-chinh/cai-dat — đọc/sửa Cài đặt tài chính, liên kết Telegram riêng chủ shop. Chủ shop.
import { NextResponse, type NextRequest } from "next/server"
import { randomBytes } from "node:crypto"
import { chiChuShop, loiApi } from "@/lib/tai-chinh/api"
import { docCaiDat, ghiCaiDat, KHOA_PHU, MO_TA } from "@/lib/tai-chinh/cai-dat"
import { CAI_DAT_MAC_DINH } from "@/lib/tai-chinh/tinh-toan"
import { guiTelegramChuShop, tenBot } from "@/lib/tai-chinh/bao-cao-21h"
import { homNayVN } from "@/lib/tai-chinh/du-lieu"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const { caiDat, phu } = await docCaiDat()
    return NextResponse.json({
      caiDat,
      macDinh: CAI_DAT_MAC_DINH,
      moTa: MO_TA,
      telegramDaKetNoi: !!phu[KHOA_PHU.telegramChatId],
      soDuTay: phu[KHOA_PHU.soDuTay],
      soDuTayNgay: phu[KHOA_PHU.soDuTayNgay],
      chanBaiDang: phu[KHOA_PHU.chanBaiDang],
      chiPhiCncLock: phu[KHOA_PHU.chiPhiCncLock],
      homNay: homNayVN(),
    })
  } catch (e) {
    return loiApi(e)
  }
}

export async function PUT(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    const ghi: Record<string, string | number> = {}
    for (const k of Object.keys(CAI_DAT_MAC_DINH)) {
      if (b.caiDat && b.caiDat[k] !== undefined && b.caiDat[k] !== "") ghi[k] = b.caiDat[k]
    }
    if (b.chanBaiDang !== undefined) ghi[KHOA_PHU.chanBaiDang] = String(b.chanBaiDang)
    if (b.chiPhiCncLock !== undefined) ghi[KHOA_PHU.chiPhiCncLock] = b.chiPhiCncLock === "" || b.chiPhiCncLock === null ? "" : Math.max(0, Math.round(Number(b.chiPhiCncLock) || 0))
    if (b.soDuTay !== undefined) {
      ghi[KHOA_PHU.soDuTay] = b.soDuTay === "" || b.soDuTay === null ? "" : Math.round(Number(b.soDuTay) || 0)
      ghi[KHOA_PHU.soDuTayNgay] = b.soDuTay === "" || b.soDuTay === null ? "" : homNayVN()
    }
    await ghiCaiDat(ghi)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return loiApi(e)
  }
}

/**
 * POST { action: "lien-ket" } -> link t.me/<bot>?start=<mã>: chủ shop mở link, bấm Start, webhook lưu chat id.
 * POST { action: "thu" }      -> gửi tin thử tới chat đã liên kết.
 * POST { action: "huy" }      -> bỏ liên kết.
 */
export async function POST(req: NextRequest) {
  const c = chiChuShop(req)
  if (c instanceof NextResponse) return c
  try {
    const b = await req.json()
    if (b.action === "lien-ket") {
      const bot = await tenBot()
      if (!bot) return NextResponse.json({ error: "Không lấy được tên bot Telegram (kiểm tra TELEGRAM_BOT_TOKEN)" }, { status: 400 })
      const ma = `cs_${randomBytes(9).toString("base64url")}`
      await ghiCaiDat({ [KHOA_PHU.telegramMa]: ma, [KHOA_PHU.telegramMaHan]: String(Date.now() + 30 * 60_000) })
      return NextResponse.json({ ok: true, link: `https://t.me/${bot}?start=${ma}`, bot })
    }
    if (b.action === "thu") {
      const { phu } = await docCaiDat()
      const r = await guiTelegramChuShop(phu[KHOA_PHU.telegramChatId], "✅ Tin thử từ phần Tài chính: báo cáo 21h sẽ gửi vào đây.")
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 })
    }
    if (b.action === "huy") {
      await ghiCaiDat({ [KHOA_PHU.telegramChatId]: "" })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 })
  } catch (e) {
    return loiApi(e)
  }
}
