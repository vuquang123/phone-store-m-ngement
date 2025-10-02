import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEET = "USERS"

/* ========== helpers ========== */
const norm = (s: string) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")

function colIndex(header: string[], ...names: string[]) {
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

function parseToEpoch(v: any): number {
  if (!v) return 0
  const str = String(v)
  const t = Date.parse(str)
  if (!Number.isNaN(t)) return t
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const [_, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m
    return new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss).getTime()
  }
  return 0
}

function getCols(header: string[]) {
  return {
    id: header.indexOf("ID Nhân Viên"),
    email: header.indexOf("Email"),
    name: header.indexOf("Tên"),
    role: header.indexOf("Vai Trò"),
    status: header.indexOf("Trạng Thái"),
    lastLogin: header.indexOf("Lần Đăng Nhập Cuối"),
    password: header.indexOf("Mật Khẩu"),
    createdAt: colIndex(header, "Ngày tạo", "Ngày Tạo", "Ngay Tao", "Created At", "Created_At"),
    phone: colIndex(header, "Số Điện Thoại", "So Dien Thoai", "Phone"),
  }
}

/* ========== GET: danh sách nhân viên (chỉ quản lý) ========== */
export async function GET(request: NextRequest) {
  try {
    const callerEmail = request.headers.get("x-user-email") || ""
    if (!callerEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") || "").trim()
    const limit = Math.max(1, Math.min(1000, parseInt(searchParams.get("limit") || "1000")))

    // Đọc USERS
    const { header, rows } = await readFromGoogleSheets(SHEET)
    const C = getCols(header)
    if (C.email === -1 || C.name === -1 || C.role === -1 || C.status === -1) {
      return NextResponse.json({ error: "USERS thiếu các cột bắt buộc" }, { status: 500 })
    }

    // Quyền: chỉ quản lý
    const callerRow = rows.find((r) => norm(r[C.email]) === norm(callerEmail))
    const callerRoleNorm = norm(callerRow ? String(callerRow[C.role] || "") : "")
    const isManager = ["quan_ly", "manager", "admin"].some((k) => callerRoleNorm.includes(k))
    if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Lọc & sắp xếp
    const q = norm(search)
    const data = rows
      .filter((r) => {
        if (!q) return true
        const nameOk = norm(String(r[C.name] || "")).includes(q)
        const emailOk = norm(String(r[C.email] || "")).includes(q)
        const phoneOk = C.phone !== -1 ? norm(String(r[C.phone] || "")).includes(q) : false
        return nameOk || emailOk || phoneOk
      })
      .map((r) => ({
        id: C.id !== -1 ? r[C.id] : undefined,
        email: r[C.email],
        ho_ten: r[C.name],
        so_dien_thoai: C.phone !== -1 ? r[C.phone] : undefined,
        vai_tro: r[C.role],
        trang_thai: r[C.status],
        ngay_tao: C.createdAt !== -1 ? r[C.createdAt] : null,
        lan_dang_nhap_cuoi: C.lastLogin !== -1 ? r[C.lastLogin] : null,
      }))
      .sort((a, b) => parseToEpoch(b.ngay_tao) - parseToEpoch(a.ngay_tao))
      .slice(0, limit)

    return NextResponse.json(data)
  } catch (err) {
    console.error("NhanVien GET error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/* ========== POST: vô hiệu hóa (quản lý thêm trực tiếp trên sheet) ========== */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Tạo nhân viên được thực hiện trực tiếp trong Google Sheets (USERS). API này đã bị vô hiệu hóa." },
    { status: 403 },
  )
}
