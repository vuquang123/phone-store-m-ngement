import { NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

// Chuẩn hoá text để so sánh email
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase()

// Tìm cột theo nhiều tên khả dĩ (không phân biệt hoa/thường, có dấu/không dấu)
function findCol(header: string[], candidates: string[]) {
  const H = header.map((h) =>
    String(h ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase(),
  )
  for (const c of candidates) {
    const key = c
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
    const i = H.findIndex((h) => h === key)
    if (i !== -1) return i
  }
  return -1
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    if (!body?.email || !body?.password) {
      return NextResponse.json({ error: "Thiếu email hoặc mật khẩu" }, { status: 400 })
    }

    // Đọc sheet USERS
    const sheet = await readFromGoogleSheets("USERS")

    // Hỗ trợ cả 2 dạng trả về: { header, rows } hoặc mảng [[header], [row]...]
    let header: string[] = []
    let rows: unknown[][] = []
    if (Array.isArray(sheet)) {
      header = (sheet[0] as string[]) || []
      rows = (sheet.slice(1) as unknown[][]) || []
    } else {
      // @ts-ignore: tùy implement của bạn
      header = (sheet.header as string[]) || []
      // @ts-ignore
      rows = (sheet.rows as unknown[][]) || []
    }

    // Cột bắt buộc chỉ cần Email + Mật Khẩu
    const idxEmail = findCol(header, ["Email", "E-mail", "email"])
    const idxPassword = findCol(header, ["Mật Khẩu", "Mat Khau", "Password", "pass"])

    if (idxEmail === -1 || idxPassword === -1) {
      return NextResponse.json(
        { error: "Thiếu cột Email hoặc Mật Khẩu trong sheet USERS" },
        { status: 500 },
      )
    }

    // (Không kiểm tra trạng thái/role) -> chỉ so khớp email & password
    const emailNorm = norm(body.email)
    const pwdTrim = String(body.password).trim()

    const match = rows.find((r) => {
      const row = r as unknown[]
      const rowEmail = norm(row[idxEmail])
      const rowPwd = String(row[idxPassword] ?? "").trim()
      return rowEmail === emailNorm && rowPwd === pwdTrim
    }) as unknown[] | undefined

    if (!match) {
      return NextResponse.json({ error: "Sai email hoặc mật khẩu" }, { status: 401 })
    }

    // Trả về thông tin cơ bản (tuỳ chọn lấy thêm Tên/Vai Trò nếu có cột)
    const idxName = findCol(header, ["Tên", "Ten", "Name"])
    const idxRole = findCol(header, ["Vai Trò", "Vai Tro", "Role"])
    let role = ""
    if (idxRole !== -1) {
      role = String(match[idxRole] ?? "").trim().toLowerCase()
      // Chỉ cho phép các vai trò hợp lệ
      if (role !== "quan_ly" && role !== "nhan_vien") {
        return NextResponse.json({ error: "Tài khoản không có vai trò hợp lệ" }, { status: 403 })
      }
    }

    return NextResponse.json({
      email: String(match[idxEmail] ?? ""),
      name: idxName !== -1 ? String(match[idxName] ?? "") : "",
      role, // trả về đúng vai trò
    })
  } catch (e) {
    console.error("LOGIN error:", e)
    return NextResponse.json({ error: "Lỗi đăng nhập" }, { status: 500 })
  }
}
