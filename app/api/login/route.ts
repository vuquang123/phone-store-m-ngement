import { NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, updateRangeValues } from "@/lib/google-sheets"

function toColumnLetter(colNum: number) {
  let letter = ""
  while (colNum > 0) {
    const mod = (colNum - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    colNum = Math.floor((colNum - mod) / 26)
  }
  return letter
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Thiếu email hoặc mật khẩu" }, { status: 400 })
    }

    const SHEET_NAME = "USERS"
    const { header, rows } = await readFromGoogleSheets(SHEET_NAME)

    const emailIdx = header.indexOf("Email")
    const passwordIdx = header.indexOf("Mật Khẩu")
    const nameIdx = header.indexOf("Tên")
    const roleIdx = header.indexOf("Vai Trò")
    const statusIdx = header.indexOf("Trạng Thái")
    const lastLoginIdx = header.indexOf("Lần Đăng Nhập Cuối")

    if ([emailIdx, passwordIdx, nameIdx, roleIdx, statusIdx].includes(-1)) {
      return NextResponse.json({ success: false, message: "Cấu trúc sheet không hợp lệ" }, { status: 500 })
    }

    const userRow = rows.find(
      (row) =>
        (row[emailIdx] || "").trim().toLowerCase() === String(email).trim().toLowerCase() &&
        (row[passwordIdx] || "") === password
    )
    if (!userRow) {
      return NextResponse.json({ success: false, message: "Sai email hoặc mật khẩu" }, { status: 401 })
    }

    // Hàm tìm cột theo tên chuẩn hóa
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
    const idxIdNhanVien = colIndex(header, "ID Nhân Viên")
    const user = {
  email: userRow[emailIdx] ?? "",
  name: userRow[nameIdx] ?? "",
  role: userRow[roleIdx] ?? "",
  status: userRow[statusIdx] ?? "",
  employeeId: idxIdNhanVien !== -1 ? userRow[idxIdNhanVien] : "",
    }

    if (user.status !== "hoat_dong") {
      return NextResponse.json({ success: false, message: "Tài khoản bị khóa" }, { status: 403 })
    }

    // Cập nhật "Lần Đăng Nhập Cuối" nếu cột tồn tại
    if (lastLoginIdx !== -1) {
      const rowNumber = rows.indexOf(userRow) + 2
      const colLetter = toColumnLetter(lastLoginIdx + 1)
      const range = `${SHEET_NAME}!${colLetter}${rowNumber}`

      const nowVN = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      await updateRangeValues(range, [[nowVN]])
    }

    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false, message: "Lỗi server" }, { status: 500 })
  }
}