
import { NextResponse, type NextRequest } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

// ================== CONFIG ==================
const SHEET = "Phu_Kien"

// ================== GET: list/search/pagination ==================
export async function GET(request: NextRequest) {
  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    const keyMap: { [key: string]: string } = {
      "ID": "id",
      "Tên Sản Phẩm": "ten_phu_kien",
      "Loại": "loai_phu_kien",
      "Số Lượng": "so_luong_ton",
      "Giá Nhập": "gia_nhap",
      "Giá Bán": "gia_ban",
      "Ghi Chú": "ghi_chu",
      "Cập nhật lần cuối": "updated_at"
    }
    const mapped = rows.map((row) => {
      const obj: Record<string, any> = {}
      header.forEach((k, i) => {
        if (keyMap[k]) obj[keyMap[k]] = row[i]
      })
      return obj
    })
    return NextResponse.json({ data: mapped }, { status: 200 })
  } catch (err) {
    console.error("Phu_Kien GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ================== POST: create (append) ==================
export async function POST(request: NextRequest) {
  try {
    const { header, rows } = await readFromGoogleSheets(SHEET)
    const keyMap: { [key: string]: string } = {
      "ID": "id",
      "Tên Sản Phẩm": "ten_phu_kien",
      "Loại": "loai_phu_kien",
      "Số Lượng": "so_luong_ton",
      "Giá Nhập": "gia_nhap",
      "Giá Bán": "gia_ban",
      "Ghi Chú": "ghi_chu",
      "Cập nhật lần cuối": "updated_at"
    }
    const mapped = rows.map((row) => {
      const obj: Record<string, any> = {}
      header.forEach((k, i) => {
        if (keyMap[k]) obj[keyMap[k]] = row[i]
      })
      return obj
    })
    return NextResponse.json({ ok: true, data: mapped }, { status: 200 })
  } catch (err) {
    console.error("Phu_Kien POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
