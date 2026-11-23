// lib/tai-chinh/api.ts
// Dùng chung cho các route /api/tai-chinh/*: chỉ CHỦ SHOP được xem/sửa số liệu tài chính.
import { NextResponse, type NextRequest } from "next/server"
import { getServerUser, type SessionUser } from "@/lib/auth"
import { isOwnerRole } from "@/lib/roles"
import { branchContextFromHeaders } from "@/lib/branch-context"
import { branchName, type ActiveBranch } from "@/lib/branches"
import { LoiNghiepVu } from "./ghi"

export type NguCanh = { user: SessionUser; active: ActiveBranch; chiNhanhGhi: string; tenNguoi: string }

/** Trả ngữ cảnh nếu là chủ shop, ngược lại trả Response 403. */
export function chiChuShop(req: NextRequest): NguCanh | NextResponse {
  const user = getServerUser(req)
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  if (!isOwnerRole(user.role)) return NextResponse.json({ error: "Chỉ chủ shop được xem phần Tài chính" }, { status: 403 })
  return nguCanh(req, user)
}

export function nguCanh(req: NextRequest, user: SessionUser): NguCanh {
  const ctx = branchContextFromHeaders(req.headers)
  return {
    user,
    active: ctx?.active || "1",
    chiNhanhGhi: branchName(ctx?.writeBranch || "1"),
    tenNguoi: user.name || user.email,
  }
}

export function loiApi(e: any) {
  if (e instanceof LoiNghiepVu) return NextResponse.json({ error: e.message }, { status: 400 })
  console.error("[Tài chính]", e)
  return NextResponse.json({ error: e?.message || "Lỗi máy chủ" }, { status: 500 })
}
