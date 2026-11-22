// POST: chủ shop / quản lý duyệt hoặc từ chối yêu cầu lệch ca. body: { action: "duyet" | "tu_choi", ghiChu? }
import { NextRequest, NextResponse } from "next/server"
import { getServerUser } from "@/lib/auth"
import { currentBranchContext } from "@/lib/branch-context"
import { branchName } from "@/lib/branches"
import { isManagerRole } from "@/lib/roles"
import { getYeuCau, setYeuCauStatus, publicYeuCau } from "@/lib/lech-ca"
import { notifyDecision } from "@/lib/lech-ca-notify"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest, ctxArg: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctxArg.params
    const user = getServerUser(req)
    const ctx = await currentBranchContext()
    if (!user || !ctx) return NextResponse.json({ success: false, message: "Chưa đăng nhập" }, { status: 401 })
    if (!isManagerRole(user.role)) {
      return NextResponse.json({ success: false, message: "Chỉ chủ shop hoặc quản lý được duyệt" }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "")
    if (!["duyet", "tu_choi"].includes(action)) {
      return NextResponse.json({ success: false, message: "Thao tác không hợp lệ" }, { status: 400 })
    }
    const ghiChu = String(body?.ghiChu ?? "").trim()
    if (action === "tu_choi" && !ghiChu) {
      return NextResponse.json({ success: false, message: "Vui lòng ghi lý do từ chối" }, { status: 400 })
    }

    const y = await getYeuCau(id)
    if (!y) return NextResponse.json({ success: false, message: "Không tìm thấy yêu cầu" }, { status: 404 })
    if (ctx.active !== "all" && y.branchId !== ctx.active) {
      return NextResponse.json({ success: false, message: "Yêu cầu thuộc chi nhánh khác" }, { status: 403 })
    }
    const updated = await setYeuCauStatus(id, ["cho_duyet"], {
      trangThai: action === "duyet" ? "da_duyet" : "tu_choi",
      nguoiDuyet: user.name || user.email,
      ghiChuDuyet: ghiChu,
    })
    if (!updated) {
      return NextResponse.json({ success: false, message: "Yêu cầu đã được xử lý trước đó" }, { status: 409 })
    }
    const telegram = await notifyDecision(updated, branchName(y.branchId))
    return NextResponse.json({ success: true, item: publicYeuCau(updated), telegram })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Có lỗi xảy ra" }, { status: 500 })
  }
}
