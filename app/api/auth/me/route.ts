import { NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"
import { SESSION_COOKIE, verifySession } from "@/lib/auth"
import { branchContextFromHeaders } from "@/lib/branch-context"
import { BRANCHES, branchName, normalizeBranch } from "@/lib/branches"

export async function GET(request: NextRequest) {
  // Lấy email từ header xác thực (ví dụ: x-user-email)
  const email = request.headers.get("x-user-email")
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { header, rows } = await readFromGoogleSheets("USERS")

  const normalize = (s: string) => (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()

  const findCol = (candidates: string[]) => {
    const normHeader = header.map((h) => normalize(String(h)))
    for (const c of candidates) {
      const idx = normHeader.findIndex((h) => h === normalize(c))
      if (idx !== -1) return idx
    }
    return -1
  }

  const idxEmail = findCol(["Email", "E-mail", "email"])
  const idxName = findCol(["Tên", "Ten", "Name"])
  const idxRole = findCol(["Vai Trò", "Vai Tro", "Role", "Quyen"])
  const idxStatus = findCol(["Trạng Thái", "Trang Thai", "Status"])
  const idxEmployeeId = findCol(["ID Nhân Viên", "ID Nhan Vien", "Employee Id"]) 
  const idxBranch = findCol(["Chi nhánh", "Chi Nhanh", "Branch"])

  const userRow = rows.find((r) => normalize(String(r[idxEmail])) === normalize(email))
  if (!userRow)
    return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    email: userRow[idxEmail],
    name: idxName !== -1 ? userRow[idxName] : "",
    role: idxRole !== -1 ? String(userRow[idxRole] ?? "").trim().toLowerCase() : "",
    status: idxStatus !== -1 ? userRow[idxStatus] : "",
    employeeId: idxEmployeeId !== -1 ? userRow[idxEmployeeId] : "",
    ...(() => {
      // Chi nhánh trong phiên (đổi chi nhánh gốc trong USERS cần đăng nhập lại, như vai trò).
      const ctx = branchContextFromHeaders(request.headers)
      const sheetBranch = idxBranch !== -1 ? normalizeBranch(userRow[idxBranch]) : ""
      return {
        branch: ctx?.home ?? (sheetBranch || "1"),
        branchName: branchName(ctx?.home ?? (sheetBranch || "1")),
        activeBranch: ctx?.active ?? (sheetBranch || "1"),
        canSwitchBranch: !!ctx?.canSwitch,
        branches: BRANCHES,
      }
    })(),
    sessionExpiresAt: await (async () => {
      const t = request.cookies.get(SESSION_COOKIE)?.value
      return t ? (await verifySession(t))?.expiresAt ?? null : null
    })(),
  })
}