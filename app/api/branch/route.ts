// Đổi chi nhánh đang xem (chỉ chủ shop và quản lý). Nhân viên luôn ở chi nhánh của mình.
import { NextRequest, NextResponse } from "next/server"
import { branchContextFromHeaders } from "@/lib/branch-context"
import { BRANCH_COOKIE, normalizeBranch } from "@/lib/branches"
import { TOKEN_TTL_SECONDS } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const ctx = branchContextFromHeaders(req.headers)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(ctx)
}

export async function POST(req: NextRequest) {
  const ctx = branchContextFromHeaders(req.headers)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!ctx.canSwitch) {
    return NextResponse.json({ error: "Tài khoản nhân viên không được chuyển chi nhánh" }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const raw = String(body?.branch ?? "").trim().toLowerCase()
  const value = raw === "all" ? "all" : normalizeBranch(raw)
  if (!value) return NextResponse.json({ error: "Chi nhánh không hợp lệ" }, { status: 400 })
  const res = NextResponse.json({ ok: true, active: value })
  res.cookies.set(BRANCH_COOKIE, value, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  })
  return res
}
