// app/api/check-in/route.ts
// Nhận báo cáo check-in đầu ca -> lưu -> gửi Telegram vào topic "Báo cáo tổng hợp" (kèm ảnh nếu có).
// Số máy đếm phải khớp báo cáo cuối ca trước của chi nhánh; lệch thì cần yêu cầu đã được duyệt.

import dns from "node:dns"
import { NextRequest, NextResponse } from "next/server"
import { buildCheckinMessage, saveCheckin, getCheckins, type Ca, type TrangThai, type KhoCounts, type SeriesCounts } from "@/lib/check-in"
import { sendTelegramMessage, sendTelegramPhotoBase64, sendTelegramMediaGroup } from "@/lib/telegram"
import { getServerUser } from "@/lib/auth"
import { currentBranchContext } from "@/lib/branch-context"
import { branchName } from "@/lib/branches"
import { getLastCheckoutForBranch } from "@/lib/check-out"
import { findApproved, setYeuCauStatus } from "@/lib/lech-ca"
import { BAO_CAO_TONG_HOP } from "@/lib/telegram-topics"
import { diffWithPrev, normalizeActual } from "@/lib/check-in-shared"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Ưu tiên IPv4 khi phân giải DNS — tránh lỗi fetch ETIMEDOUT tới api.telegram.org
// trên máy có IPv6 cấu hình lỗi (Node mặc định thử IPv6 trước).
try { dns.setDefaultResultOrder("ipv4first") } catch {}


// Lấy thông điệp lỗi DẠNG CHUỖI từ kết quả gửi Telegram (tránh "[object Object]").
function errText(err: any): string {
  if (!err) return "Gửi Telegram thất bại"
  if (typeof err === "string") return err
  const code = err?.cause?.code || err?.code
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || /timed?\s*out/i.test(String(err?.message))) {
    return "Không kết nối được Telegram (timeout). Kiểm tra mạng server và token bot."
  }
  return err?.message || err?.description || "Gửi Telegram thất bại"
}

const num = (v: any): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const normSeries = (s: any): SeriesCounts => ({
  s17: num(s?.s17),
  s16: num(s?.s16),
  s15: num(s?.s15),
  ipad: num(s?.ipad),
  khac: num(s?.khac),
})

const normCounts = (k: any): KhoCounts => ({
  ...normSeries(k), // s17..khac = số đếm thực tế theo dòng máy
  website: num(k?.website),
  thucTe: num(k?.thucTe),
  web: normSeries(k?.web), // số trên website theo dòng máy
})

export async function POST(req: NextRequest) {
  try {
    const user = getServerUser(req)
    const body = await req.json().catch(() => ({}))
    const { ca, khoNgoai, khoTrong, trangThai, lyDo, tienMat, images } = body || {}

    const caStr = String(ca)
    if (!["1", "2", "3"].includes(caStr)) {
      return NextResponse.json({ success: false, message: 'Ca không hợp lệ (1/2/3)' }, { status: 400 })
    }
    const ttStr = String(trangThai)
    if (!["khop", "khong_khop"].includes(ttStr)) {
      return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ" }, { status: 400 })
    }
    if (ttStr === "khong_khop" && !String(lyDo || "").trim()) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập lý do khi không khớp" }, { status: 400 })
    }

    const ctx = await currentBranchContext()
    if (!user || !ctx) return NextResponse.json({ success: false, message: "Chưa đăng nhập" }, { status: 401 })
    if (ctx.active === "all") {
      return NextResponse.json({ success: false, message: "Chọn 1 chi nhánh (DEV PỒ hoặc T1s) trước khi check-in" }, { status: 400 })
    }

    // Đối chiếu với báo cáo cuối ca trước của chi nhánh. Lệch -> phải có yêu cầu đã duyệt.
    const prev = await getLastCheckoutForBranch(ctx.writeBranch)
    const soDem = normalizeActual({ khoNgoai, khoTrong })
    const diffs = diffWithPrev(prev, soDem)
    let approval: Awaited<ReturnType<typeof findApproved>> = null
    if (prev && diffs.length) {
      approval = await findApproved(ctx.writeBranch, user.email, soDem, prev.id)
      if (!approval) {
        return NextResponse.json(
          {
            success: false,
            code: "LECH_CA_TRUOC",
            message: "Số máy lệch với báo cáo cuối ca trước. Ghi chú và gửi yêu cầu cho chủ shop / quản lý duyệt trước khi check-in.",
            diffs,
            prev,
          },
          { status: 409 },
        )
      }
    }

    const nhanVien = user?.name || user?.email || ""
    const checkinData = {
      ca: caStr as Ca,
      khoNgoai: normCounts(khoNgoai),
      khoTrong: normCounts(khoTrong),
      trangThai: ttStr as TrangThai,
      lyDo: lyDo ? String(lyDo) : undefined,
      tienMat: num(tienMat),
      nhanVien,
      chiNhanh: branchName(ctx.writeBranch) || undefined,
    }
    let text = buildCheckinMessage(checkinData)
    if (approval) {
      text += `\nLệch ca trước: ${approval.chiTiet.replace(/&/g, "&amp;").replace(/</g, "&lt;")} - đã được ${approval.nguoiDuyet.replace(/</g, "&lt;")} duyệt`
    }

    const opts = BAO_CAO_TONG_HOP
    const imgs: string[] = Array.isArray(images)
      ? images.filter((x: any) => typeof x === "string" && x).slice(0, 10)
      : []

    // 1) LƯU TRƯỚC (nguồn sự thật). Lưu lỗi thì báo lỗi, không gửi Telegram.
    let saved: { id: string }
    try {
      saved = await saveCheckin(checkinData, imgs.length)
      if (approval) await setYeuCauStatus(approval.id, ["da_duyet"], { trangThai: "da_dung", checkinId: saved.id })
    } catch (e: any) {
      console.error("[CHECK-IN] Lưu thất bại:", e)
      return NextResponse.json({ success: false, message: "Lưu check-in thất bại: " + errText(e) }, { status: 500 })
    }

    // 2) Telegram best-effort: lỗi Telegram KHÔNG làm check-in thất bại (tránh nhân viên
    //    bấm gửi lại -> trùng dòng). Trả telegram=false để trang báo cho nhân viên biết.
    let res: any
    try {
      if (imgs.length === 0) {
        res = await sendTelegramMessage(text, "offline", opts)
      } else if (imgs.length === 1) {
        res = await sendTelegramPhotoBase64(imgs[0], "checkin.jpg", text, "offline", opts)
      } else {
        const buffers = imgs.map((b64) => Buffer.from(String(b64).replace(/^data:[^;]+;base64,/, ""), "base64"))
        res = await sendTelegramMediaGroup(
          buffers,
          buffers.map((_, i) => `checkin_${i}.jpg`),
          [text],
          "offline",
          opts,
        )
      }
    } catch (e) {
      res = { success: false, error: e }
    }
    const telegram = !!res?.success
    if (!telegram) console.warn("[CHECK-IN] Gửi Telegram thất bại (đã lưu):", errText(res?.error))

    return NextResponse.json({
      success: true,
      id: saved.id,
      telegram,
      ...(telegram ? {} : { message: errText(res?.error) }),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: errText(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const force = new URL(req.url).searchParams.get("refresh") === "1"
    const data = await getCheckins(force)
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: errText(e), data: [] }, { status: 500 })
  }
}
