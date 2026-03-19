import { NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

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

  const userRow = rows.find((r) => normalize(String(r[idxEmail])) === normalize(email))
  if (!userRow)
    return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    email: userRow[idxEmail],
    name: idxName !== -1 ? userRow[idxName] : "",
    role: idxRole !== -1 ? String(userRow[idxRole] ?? "").trim().toLowerCase() : "",
    status: idxStatus !== -1 ? userRow[idxStatus] : "",
    employeeId: idxEmployeeId !== -1 ? userRow[idxEmployeeId] : "",
  })
}