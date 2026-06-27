// ---------------------------------------------------------------------------
// Đăng nhập an toàn:
//  1) Đọc sheet USERS, tìm theo email (giữ logic chuẩn hoá cột như cũ).
//  2) So khớp mật khẩu qua bcrypt; tài khoản cũ (plaintext) vẫn vào được và
//     được TỰ HASH lại ngay (lazy migration).
//  3) Ký JWT, đặt vào cookie httpOnly => phiên đăng nhập thật, không còn dựa
//     vào header x-user-email giả mạo được.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs" // googleapis + bcrypt cần Node (OpenSSL đầy đủ)

import { readFromGoogleSheets, updateRangeValues } from "@/lib/google-sheets"
import { SESSION_COOKIE, TOKEN_TTL_SECONDS, signSession, type SessionUser } from "@/lib/auth"
import { verifyPassword, hashPassword } from "@/lib/password"

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
      return NextResponse.json(
        { success: false, message: "Không kết nối được Google Sheets (USERS)", detail: err?.message, env: envStatus },
        { status: 500 },
      )
    }

    const norm = (s: string) =>
      (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()

    const HNorm = header.map((h) => norm(h))
    const find = (candidates: string[]) => {
      for (const c of candidates) {
        const n = norm(c)
        const i = HNorm.findIndex((h) => h === n)
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
    const employeeIdx = find(["ID Nhân Viên", "ID Nhan Vien", "Employee Id"])

    if ([emailIdx, passwordIdx].includes(-1)) {
      return NextResponse.json(
        { success: false, message: "Thiếu cột Email hoặc Mật Khẩu trong sheet USERS" },
        { status: 500 },
      )
    }

    // Tìm theo email trước (không tiết lộ email tồn tại hay không qua thông báo).
    const userRow = rows.find(
      (row) => (row[emailIdx] || "").trim().toLowerCase() === String(email).trim().toLowerCase(),
    )
    const INVALID = NextResponse.json({ success: false, message: "Sai email hoặc mật khẩu" }, { status: 401 })
    if (!userRow) return INVALID

    const stored = String(userRow[passwordIdx] ?? "")
    const { ok, needsUpgrade } = await verifyPassword(String(password), stored)
    if (!ok) return INVALID

    const status = statusIdx !== -1 ? String(userRow[statusIdx] ?? "") : ""
    if (statusIdx !== -1 && status && status !== "hoat_dong") {
      return NextResponse.json({ success: false, message: "Tài khoản bị khóa" }, { status: 403 })
    }

    const rowNumber = rows.indexOf(userRow) + 2 // rows[] bắt đầu từ dòng 2 của sheet

    // Lazy migration: mật khẩu đang plaintext -> hash lại ngay (best-effort, không chặn login).
    if (needsUpgrade) {
      try {
        const newHash = await hashPassword(String(password))
        const colLetter = toColumnLetter(passwordIdx + 1)
        await updateRangeValues(`${SHEET_NAME}!${colLetter}${rowNumber}`, [[newHash]])
      } catch (e: any) {
        console.warn("[LOGIN] Không nâng cấp được hash mật khẩu:", e?.message)
      }
    }

    // Cập nhật "Lần Đăng Nhập Cuối" nếu có cột.
    if (lastLoginIdx !== -1) {
      try {
        const colLetter = toColumnLetter(lastLoginIdx + 1)
        const nowVN = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
        await updateRangeValues(`${SHEET_NAME}!${colLetter}${rowNumber}`, [[nowVN]])
      } catch {
        /* không chặn login nếu ghi log thất bại */
      }
    }

    const user: SessionUser = {
      email: String(userRow[emailIdx] ?? ""),
      name: nameIdx !== -1 ? String(userRow[nameIdx] ?? "") : "",
      role: roleIdx !== -1 ? String(userRow[roleIdx] ?? "").trim().toLowerCase() : "",
      employeeId: employeeIdx !== -1 ? String(userRow[employeeIdx] ?? "") : "",
    }

    let token: string
    try {
      token = await signSession(user)
    } catch (e: any) {
      const detail = e?.message || "unknown"
      console.error("[LOGIN] Ký phiên thất bại:", detail)
      return NextResponse.json(
        { success: false, message: `Lỗi server: ${detail}` },
        { status: 500 },
      )
    }

    const res = NextResponse.json({ success: true, user })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_TTL_SECONDS,
    })
    return res
  } catch (err: any) {
    console.error("[LOGIN] Unhandled error:", err)
    return NextResponse.json({ success: false, message: "Lỗi server", detail: err?.message }, { status: 500 })
  }
}
