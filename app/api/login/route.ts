import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
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
    let header: string[] = []
    let rows: any[][] = []
    try {
      const sheetData = await readFromGoogleSheets(SHEET_NAME)
      header = sheetData.header
      rows = sheetData.rows as any[][]
    } catch (err: any) {
      console.error("[LOGIN] Không đọc được sheet USERS:", err?.message)
      const envStatus = {
        EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL || !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        KEY: !!process.env.GOOGLE_PRIVATE_KEY || !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        SHEET_ID: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID || !!process.env.GOOGLE_SHEETS_ID,
      }
      console.error("[LOGIN] Env presence:", envStatus)
      return NextResponse.json({ success: false, message: "Không kết nối được Google Sheets (USERS)", detail: err?.message, env: envStatus }, { status: 500 })
    }

    const norm = (s: string) => (s || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase()

    const HNorm = header.map(h => norm(h))
    const find = (candidates: string[]) => {
      for (const c of candidates) {
        const n = norm(c)
        const i = HNorm.findIndex(h => h === n)
        if (i !== -1) return i
      }
      return -1
    }

    const emailIdx = find(["Email", "E-mail", "email"])
    const passwordIdx = find(["Mật Khẩu", "Mat Khau", "Password", "Pass", "pwd"]) 
    const nameIdx = find(["Tên", "Ten", "Name"])
    const roleIdx = find(["Vai Trò", "Vai Tro", "Role", "Quyen"]) 
    const statusIdx = find(["Trạng Thái", "Trang Thai", "Status"]) 
    const lastLoginIdx = find(["Lần Đăng Nhập Cuối", "Lan Dang Nhap Cuoi", "Last Login"]) 

    if ([emailIdx, passwordIdx].includes(-1)) {
      return NextResponse.json({ success: false, message: "Thiếu cột Email hoặc Mật Khẩu trong sheet USERS" }, { status: 500 })
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

    if (statusIdx !== -1 && user.status && user.status !== "hoat_dong") {
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
  } catch (err: any) {
    console.error("[LOGIN] Unhandled error:", err)
    return NextResponse.json({ success: false, message: "Lỗi server", detail: err?.message }, { status: 500 })
  }
}