// app/api/khach-hang/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, appendToGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEET = "Khach_Hang"

/* ============== helpers ============== */
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()

function colIndex(header: string[], ...names: string[]) {
  // match đúng trước
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  // fallback: bỏ dấu + thường hoá
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "")
const normalizePhone = (p: string) => {
  const d = onlyDigits(p || "")
  return d.startsWith("84") ? "0" + d.slice(2) : d
}

// Parse ISO hoặc dd/mm/yyyy [hh:mm[:ss]]
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

/* ============== GET ============== */
export async function GET(request: NextRequest) {
  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    const keyMap: { [key: string]: string } = {
      "Ngày tạo": "created_at",
      "Tên Khách Hàng": "ten_khach",
      "Số Điện Thoại": "sdt",
      "Tổng Mua": "tong_mua",
      "Lần Mua Cuối": "lan_mua_cuoi",
      "Ghi Chú": "ghi_chu"
    }
    const mapped = rows.map((row) => {
      const obj: Record<string, any> = {}
      header.forEach((k, i) => {
        if (keyMap[k]) obj[keyMap[k]] = row[i]
      })
      return obj
    })
    return NextResponse.json(mapped)
  } catch (error) {
    console.error("Khach_Hang GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ============== POST ============== */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("POST body:", body)
    // Thêm khách hàng mới vào sheet
    // Chỉ thực hiện nếu có đủ thông tin cần thiết
    if (!body.ten_khach?.trim() || !body.sdt?.trim()) {
      return NextResponse.json({ error: "Thiếu tên khách hoặc số điện thoại" }, { status: 400 })
    }
    // Đọc sheet để lấy header
    const { header } = await readFromGoogleSheets(SHEET)
    const newRow = header.map((k) => {
      switch (k) {
        case "Tên Khách Hàng": return body.ten_khach
        case "Số Điện Thoại": return body.sdt
        case "Tổng Mua": return body.tong_mua || 0
        case "Lần Mua Cuối": return body.lan_mua_cuoi || ""
        case "Ghi Chú": return body.ghi_chu || ""
        case "Ngày tạo": return body.created_at || new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
        default: return ""
      }
    })
    await appendToGoogleSheets(SHEET, newRow)
    // Trả về object khách hàng vừa tạo
    const customer = {
      ten_khach: body.ten_khach,
      sdt: body.sdt,
      ghi_chu: body.ghi_chu || "",
      created_at: body.created_at || new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    }
    return NextResponse.json({ ok: true, created: true, customer }, { status: 201 })
  } catch (error) {
    console.error("Khach_Hang POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
