// GET: báo cáo cuối ca gần nhất của chi nhánh đang check-in (mốc đối chiếu số máy).
import { NextResponse } from "next/server"
import { currentBranchContext } from "@/lib/branch-context"
import { branchName } from "@/lib/branches"
import { getLastCheckoutForBranch } from "@/lib/check-out"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    const ctx = await currentBranchContext()
    if (!ctx) return NextResponse.json({ success: false, message: "Chưa đăng nhập" }, { status: 401 })
    if (ctx.active === "all") return NextResponse.json({ success: true, allView: true, prev: null })
    const prev = await getLastCheckoutForBranch(ctx.writeBranch)
    return NextResponse.json({ success: true, allView: false, branch: branchName(ctx.writeBranch), prev })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || "Không đọc được báo cáo cuối ca" }, { status: 500 })
  }
}
