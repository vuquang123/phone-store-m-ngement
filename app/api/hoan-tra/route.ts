import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, appendToGoogleSheets } from "@/lib/google-sheets"
import { sendTelegramMessage } from "@/lib/telegram"

const SHEETS = { HOAN_TRA: "Hoan_Tra" } as const

const norm = (s: string) => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "_").toLowerCase()
function colIndex(header: string[], ...names: string[]) {
  const h = header.map((x) => x.trim()); for (const n of names) { const i = h.findIndex((x) => x === n); if (i !== -1) return i }
  const hh = header.map((x) => norm(x)); for (const n of names) { const i = hh.findIndex((x) => x === norm(n)); if (i !== -1) return i }
  return -1
}

export async function GET(request: NextRequest) {
  try {
    const { header, rows } = await readFromGoogleSheets(SHEETS.HOAN_TRA)
    // Map rows to object
    const mapped = rows.map((row) => {
      const obj: Record<string, any> = {}
      header.forEach((k, i) => {
        obj[k] = row[i]
      })
      return obj
    })
    return NextResponse.json({ data: mapped })
  } catch (error) {
    console.error("Hoan tra GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Đọc header sheet để map đúng thứ tự cột
    const { header } = await readFromGoogleSheets(SHEETS.HOAN_TRA)
    const newRow = header.map((k) => body[k] || "")
    const result = await appendToGoogleSheets(SHEETS.HOAN_TRA, newRow)
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Lỗi ghi Google Sheets" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, created: true }, { status: 201 })
  } catch (error) {
    console.error("Hoan tra POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
