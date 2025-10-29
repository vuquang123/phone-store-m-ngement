import { NextRequest, NextResponse } from "next/server"
import { appendToGoogleSheets, readFromGoogleSheets } from "@/lib/google-sheets"
import { DateTime } from "luxon"

const SHEET = "Lich_Su_Trang_Thai_May"

export async function POST(request: NextRequest) {
  try {
  // body: { id_may, imei, ten_san_pham, trang_thai_cu, trang_thai_moi, thoi_gian, nguoi_thay_doi }
  const body = await request.json()

    // Try to derive authenticated employee id from x-user-email header (preferred)
    let editor = body.nguoi_thay_doi || ""
    try {
      const email = request.headers.get("x-user-email") || ""
      if (email) {
        const { header, rows } = await readFromGoogleSheets("USERS")
        // helper to find employee id column index with some fallbacks
        function colIndex(h: string[], ...names: string[]) {
          const hh = h.map((x) => String(x).trim())
          for (const n of names) {
            const i = hh.findIndex((x) => x === n)
            if (i !== -1) return i
          }
          const norm = (s: string) => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "_").toLowerCase()
          const nh = h.map((x) => norm(String(x)))
          for (const n of names) {
            const i = nh.findIndex((x) => x === norm(n))
            if (i !== -1) return i
          }
          return -1
        }
        const idxEmail = header.findIndex((x) => String(x).trim() === "Email")
        const idxEmployeeId = colIndex(header, "ID Nhân Viên", "ID_Nhan_Vien", "ID")
        const userRow = rows.find((r) => String(r[idxEmail] || "").trim().toLowerCase() === String(email).trim().toLowerCase())
        if (userRow && idxEmployeeId !== -1) {
          const found = userRow[idxEmployeeId]
          if (found) editor = String(found)
        }
      }
    } catch (e) {
      // ignore errors and fall back to body.nguoi_thay_doi
    }

  const nowVN = DateTime.now().setZone('Asia/Ho_Chi_Minh').toFormat('HH:mm:ss dd/MM/yyyy')
    const newRow = [
      body.id_may || "",
      body.imei || "",
      body.ten_san_pham || "",
      body.trang_thai_cu || "",
      body.trang_thai_moi || "",
      body.thoi_gian || nowVN,
      editor || ""
    ]
    const result = await appendToGoogleSheets(SHEET, newRow)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Lỗi ghi lịch sử" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, created: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
