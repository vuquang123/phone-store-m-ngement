import { NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export async function GET(request: NextRequest) {
  // Lấy email từ header xác thực (ví dụ: x-user-email)
  const email = request.headers.get("x-user-email")
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { header, rows } = await readFromGoogleSheets("USERS")
  // Chuẩn hóa lấy cột ID Nhân Viên
  function colIndex(header: string[], ...names: string[]) {
    const h = header.map((x) => x.trim())
    for (const n of names) {
      const i = h.findIndex((x) => x === n)
      if (i !== -1) return i
    }
    // fallback nhẹ bằng normalize (phòng sai khác dấu)
    const norm = (s: string) => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "_").toLowerCase()
    const hh = header.map((x) => norm(x))
    for (const n of names) {
      const i = hh.findIndex((x) => x === norm(n))
      if (i !== -1) return i
    }
    return -1
  }
  const idxEmail = header.indexOf("Email")
  const idxName = header.indexOf("Tên")
  const idxRole = header.indexOf("Vai Trò")
  const idxStatus = header.indexOf("Trạng Thái")
  const idxEmployeeId = colIndex(header, "ID Nhân Viên")

  const userRow = rows.find(
    (r) => String(r[idxEmail]).trim().toLowerCase() === email.trim().toLowerCase()
  )
  if (!userRow)
    return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
  email: userRow[idxEmail],
  name: userRow[idxName],
  role: userRow[idxRole],
  status: userRow[idxStatus],
  employeeId: idxEmployeeId !== -1 ? userRow[idxEmployeeId] : "",
  })
}