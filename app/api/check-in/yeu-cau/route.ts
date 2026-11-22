// Yêu cầu duyệt lệch ca.
// GET : nhân viên -> yêu cầu của mình (24h); chủ shop/quản lý -> yêu cầu của chi nhánh đang xem (3 ngày).
// POST: nhân viên gửi yêu cầu khi số đếm lệch báo cáo cuối ca trước (bắt buộc ghi chú).
import { NextRequest, NextResponse } from "next/server"
import { getServerUser } from "@/lib/auth"
import { currentBranchContext } from "@/lib/branch-context"
import { branchName } from "@/lib/branches"
import { isManagerRole } from "@/lib/roles"
import { getLastCheckoutForBranch } from "@/lib/check-out"
import { createYeuCau, listYeuCau, publicYeuCau, setYeuCauStatus } from "@/lib/lech-ca"
import { notifyNewRequest } from "@/lib/lech-ca-notify"
import { diffWithPrev, formatDiffLine, normalizeActual } from "@/lib/check-in-shared"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const user = getServerUser(req)
    const ctx = await currentBranchContext()
    if (!user || !ctx) return NextResponse.json({ success: false, message: "Chưa đăng nhập" }, { status: 401 })
    const manager = isManagerRole(user.role)
    const items = manager
      ? await listYeuCau({ branch: ctx.active, sinceHours: 72 })
      : await listYeuCau({ branch: ctx.writeBranch, email: user.email, sinceHours: 24 })
    return NextResponse.json({ success: true, isManager: manager, items: items.map(publicYeuCau) })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Không đọc được yêu cầu", items: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getServerUser(req)
    const ctx = await currentBranchContext()
    if (!user || !ctx) return NextResponse.json({ success: false, message: "Chưa đăng nhập" }, { status: 401 })
    if (ctx.active === "all") {
      return NextResponse.json({ success: false, message: "Chọn 1 chi nhánh (DEV PỒ hoặc T1s) trước khi check-in" }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const ca = String(body?.ca ?? "")
    if (!["1", "2", "3"].includes(ca)) return NextResponse.json({ success: false, message: "Ca không hợp lệ (1/2/3)" }, { status: 400 })
    const ghiChu = String(body?.ghiChu ?? "").trim()
    if (!ghiChu) return NextResponse.json({ success: false, message: "Vui lòng ghi chú lý do lệch" }, { status: 400 })

    const prev = await getLastCheckoutForBranch(ctx.writeBranch)
    const soDem = normalizeActual({ khoNgoai: body?.khoNgoai, khoTrong: body?.khoTrong })
    const diffs = diffWithPrev(prev, soDem)
    if (!prev || !diffs.length) {
      return NextResponse.json({ success: false, message: "Số máy khớp với báo cáo cuối ca trước, không cần duyệt" }, { status: 400 })
    }

    // Yêu cầu cũ còn chờ duyệt của cùng người + chi nhánh -> thay bằng yêu cầu mới
    const pending = (await listYeuCau({ branch: ctx.writeBranch, email: user.email })).filter((y) => y.trangThai === "cho_duyet")
    for (const p of pending) await setYeuCauStatus(p.id, ["cho_duyet"], { trangThai: "huy" })

    const chiNhanh = branchName(ctx.writeBranch)
    const item = await createYeuCau({
      ca,
      nhanVien: user.name || user.email,
      email: user.email,
      ghiChu,
      chiTiet: diffs.map(formatDiffLine).join("; "),
      soDem,
      mocId: prev.id,
      mocThoiGian: `Ca ${prev.ca} ${prev.thoi_gian}`,
    })
    const telegram = await notifyNewRequest(item, diffs, chiNhanh, prev)
    return NextResponse.json({ success: true, item: { ...item, chiNhanh }, telegram })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: "Gửi yêu cầu thất bại: " + (e?.message || "lỗi") }, { status: 500 })
  }
}
