// Chi nhánh của request hiện tại (phía server). Middleware đã tiêm header
// x-user-branch / x-active-branch từ phiên đăng nhập + cookie ps_branch.
import { HDR_EMAIL, HDR_ROLE } from "./auth"
import {
  HDR_ACTIVE_BRANCH,
  HDR_BRANCH,
  DEFAULT_BRANCH,
  isBranchColumn,
  normalizeBranch,
  resolveActiveBranch,
  rowBranchId,
  branchName,
  canSwitchBranch,
  type ActiveBranch,
  type BranchId,
} from "./branches"

export type BranchContext = {
  role: string
  /** Chi nhánh gốc của tài khoản */
  home: BranchId
  /** Chi nhánh đang xem ("all" chỉ có với chủ shop/quản lý) */
  active: ActiveBranch
  canSwitch: boolean
  /** Chi nhánh ghi vào dữ liệu mới (đang xem "Tất cả" thì ghi cho chi nhánh gốc) */
  writeBranch: BranchId
}

type HeaderLike = { get(name: string): string | null }

export function branchContextFromHeaders(h: HeaderLike): BranchContext | null {
  if (!h.get(HDR_EMAIL)) return null
  const role = decodeURIComponent(h.get(HDR_ROLE) || "")
  const home = normalizeBranch(h.get(HDR_BRANCH)) || DEFAULT_BRANCH
  const active = resolveActiveBranch(role, home, h.get(HDR_ACTIVE_BRANCH))
  return {
    role,
    home,
    active,
    canSwitch: canSwitchBranch(role),
    writeBranch: active === "all" ? home : active,
  }
}

/** Đọc chi nhánh trong request đang chạy; ngoài request (script, cron) trả null. */
export async function currentBranchContext(): Promise<BranchContext | null> {
  try {
    const { headers } = await import("next/headers")
    return branchContextFromHeaders(await headers())
  } catch {
    return null
  }
}

/** Tên chi nhánh để ghi vào dòng mới, hoặc null nếu không ở trong request đăng nhập. */
export async function currentWriteBranchName(): Promise<string | null> {
  const ctx = await currentBranchContext()
  return ctx ? branchName(ctx.writeBranch) : null
}

export function branchColumnIndex(header: unknown[]): number {
  return (header || []).findIndex((h) => isBranchColumn(h))
}

/** Lọc các dòng theo chi nhánh đang xem. Không có cột/không có phiên/"all" -> giữ nguyên. */
export function filterRowsByBranch<T extends unknown[]>(header: unknown[], rows: T[], ctx: BranchContext | null): T[] {
  if (!ctx || ctx.active === "all") return rows
  const idx = branchColumnIndex(header)
  if (idx === -1) return ctx.active === DEFAULT_BRANCH ? rows : []
  return rows.filter((r) => rowBranchId(r?.[idx]) === ctx.active)
}

/** Một dòng có được xem với ctx này không. */
export function rowVisible(header: unknown[], row: unknown[], ctx: BranchContext | null): boolean {
  if (!ctx || ctx.active === "all") return true
  const idx = branchColumnIndex(header)
  if (idx === -1) return ctx.active === DEFAULT_BRANCH
  return rowBranchId(row?.[idx]) === ctx.active
}
