// Chủ shop / quản lý đang xem "Tất cả chi nhánh" thì phải chọn 1 chi nhánh trước khi tạo đơn,
// để đơn (và tin Telegram) vào đúng chi nhánh, không mặc định về chi nhánh gốc.
import { NextResponse } from "next/server"
import { branchContextFromHeaders } from "@/lib/branch-context"

import { CHOOSE_BRANCH_MESSAGE } from "@/lib/branches"
export { CHOOSE_BRANCH_MESSAGE }

/** Trả response lỗi 400 nếu đang xem "Tất cả", ngược lại null. */
export function requireSingleBranch(req: { headers: Headers }) {
  const ctx = branchContextFromHeaders(req.headers)
  if (ctx?.active === "all") {
    return NextResponse.json({ success: false, error: CHOOSE_BRANCH_MESSAGE, message: CHOOSE_BRANCH_MESSAGE }, { status: 400 })
  }
  return null
}
