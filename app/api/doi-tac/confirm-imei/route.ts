import { NextResponse } from "next/server"
import { readFromGoogleSheets, updateRangeValues } from "@/lib/google-sheets"

function stripAccents(str: string) {
  return (str || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "")
}
function normHeader(str: string) {
  return stripAccents((str || "").trim().toLowerCase())
}
function findIdx(header: string[], candidates: string[]) {
  const normed = header.map(normHeader)
  for (const c of candidates) {
    const target = normHeader(c)
    const i = normed.indexOf(target)
    if (i !== -1) return i
  }
  for (const c of candidates) {
    const target = normHeader(c)
    const i = normed.findIndex((h) => h.includes(target) || target.includes(h))
    if (i !== -1) return i
  }
  return -1
}
function columnToLetter(colIndexZeroBased: number) {
  let n = colIndexZeroBased + 1
  let s = ""
  while (n > 0) {
    const mod = (n - 1) % 26
    s = String.fromCharCode(65 + mod) + s
    n = Math.floor((n - mod) / 26)
  }
  return s
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const sheet: string = body.sheet
    const row_index: number = Number(body.row_index)
    const imei: string = String(body.imei || "").replace(/\D/g, "")
    const createIdMay: boolean = body.createIdMay !== false

    if (!sheet || !row_index || !imei) {
      return NextResponse.json({ success: false, error: "Thiếu sheet, row_index hoặc imei" }, { status: 400 })
    }

    // Đọc header để tìm cột cần ghi
    const { header } = await readFromGoogleSheets(sheet)
    if (!header || header.length === 0) {
      return NextResponse.json({ success: false, error: "Không đọc được header của sheet" }, { status: 500 })
    }
    const idxIMEI = findIdx(header, ["IMEI"]) // ưu tiên cột IMEI
    if (idxIMEI === -1) {
      return NextResponse.json({ success: false, error: "Sheet không có cột IMEI" }, { status: 400 })
    }

    const updates: { range: string; values: any[][] }[] = []
    const imeiCol = columnToLetter(idxIMEI)
    updates.push({ range: `'${sheet}'!${imeiCol}${row_index}`, values: [[imei]] })

    let idMayWritten: string | undefined
    if (createIdMay) {
      const idxIdMay = findIdx(header, ["ID Máy", "ID May", "IDMay", "ID"]) // tuỳ sheet
      if (idxIdMay !== -1) {
        // Mặc định: 5 số cuối IMEI làm ID Máy
        idMayWritten = imei.slice(-5)
        const idCol = columnToLetter(idxIdMay)
        updates.push({ range: `'${sheet}'!${idCol}${row_index}`, values: [[idMayWritten]] })
      }
    }

    for (const u of updates) {
      await updateRangeValues(u.range, u.values)
    }

    return NextResponse.json({ success: true, sheet, row_index, imei, id_may: idMayWritten })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Lỗi xác nhận IMEI" }, { status: 500 })
  }
}
