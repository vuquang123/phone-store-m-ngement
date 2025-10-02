import { type NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, syncToGoogleSheets } from "@/lib/google-sheets"
import { getUserFromRequest } from "@/lib/sheets-auth" // Auth từ sheet USERS

// Helpers
const norm = (s: any) => String(s ?? "").trim()
const toNumber = (v: any) => {
  if (v === null || v === undefined) return 0
  // Loại bỏ dấu chấm, ký tự đ, khoảng trắng, và ký tự không phải số
  const s = String(v)
    .replace(/\./g, "") // bỏ dấu chấm
    .replace(/đ/g, "") // bỏ ký tự đ
    .replace(/,/g, "") // bỏ dấu phẩy nếu có
    .replace(/\s+/g, "") // bỏ khoảng trắng
    .replace(/[^\d.-]/g, "") // giữ lại số, dấu trừ, dấu chấm thập phân
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// Chuẩn hoá output của readFromGoogleSheets về { header, rows }
function normalizeSheetData(
  data: { header: any[]; rows: any[][] } | any[][]
): { header: any[]; rows: any[][] } {
  if (Array.isArray(data)) {
    const header = data[0] ?? []
    const rows = data.slice(1) ?? []
    return { header, rows }
  }
  // đã là { header, rows }
  return data as any
}

export async function POST(request: NextRequest) {
  try {
    // Chỉ QUẢN LÝ mới được chạy
    const authed = await getUserFromRequest(request)
    if (authed.role !== "quan_ly") {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 })
    }

    const body = await request.json()
    const { sheet, action = "sync" } = body

    // ============== READ: Kho_Hang =================
    if (action === "read" && sheet === "Kho_Hang") {
      try {
        const raw = await readFromGoogleSheets("Kho_Hang")
        const { header, rows } = normalizeSheetData(raw)

        let updatedCount = 0
        if (rows.length > 0) {
          const idx = (name: string) => header.indexOf(name)

          const idxImei = idx("IMEI")
          const idxTen = idx("Tên Sản Phẩm")
          const idxGiaBan = idx("Giá Bán")

          if (idxImei === -1 || idxTen === -1 || idxGiaBan === -1) {
            console.error("Lỗi thiếu cột:", { header, idxImei, idxTen, idxGiaBan })
            return NextResponse.json(
              { error: "Thiếu cột IMEI / Tên Sản Phẩm / Giá Bán trong tab Kho_Hang" },
              { status: 400 },
            )
          }

          for (const [i, row] of rows.entries()) {
            const imei = norm(row[idxImei])
            const ten = norm(row[idxTen])
            const giaBan = toNumber(row[idxGiaBan])
            if (!(imei && ten && giaBan > 0)) {
              console.error(`Row ${i + 2} không hợp lệ:`, { imei, ten, giaBan, row })
            }
            if (imei && ten && giaBan > 0) updatedCount++
          }
        } else {
          console.error("Không có dữ liệu rows Kho_Hang", { header, rows })
        }

        return NextResponse.json({
          success: true,
          message: `Đã đọc ${updatedCount} sản phẩm từ Google Sheets`,
          updated: updatedCount,
        })
      } catch (err) {
        console.error("Error reading from Google Sheets:", err)
        return NextResponse.json({ error: "Lỗi đọc dữ liệu từ Google Sheets" }, { status: 500 })
      }
    }

    // ============== SYNC: đẩy/ghi lại các sheet ==============
    if (action === "sync" || !action) {
      // Kho_Hang
      {
        const raw = await readFromGoogleSheets("Kho_Hang")
        const { header, rows } = normalizeSheetData(raw)
        if (rows.length > 0) await syncToGoogleSheets("Kho_Hang", rows)
      }

      // Ban_Hang
      {
        const raw = await readFromGoogleSheets("Ban_Hang")
        const { rows } = normalizeSheetData(raw)
        if (rows.length > 0) await syncToGoogleSheets("Ban_Hang", rows)
      }

      // Khach_Hang
      {
        const raw = await readFromGoogleSheets("Khach_Hang")
        const { rows } = normalizeSheetData(raw)
        if (rows.length > 0) await syncToGoogleSheets("Khach_Hang", rows)
      }

      // Phu_Kien
      {
        const raw = await readFromGoogleSheets("Phu_Kien")
        const { rows } = normalizeSheetData(raw)
        if (rows.length > 0) await syncToGoogleSheets("Phu_Kien", rows)
      }

      // Hoan_Tra
      {
        const raw = await readFromGoogleSheets("Hoan_Tra")
        const { rows } = normalizeSheetData(raw)
        if (rows.length > 0) await syncToGoogleSheets("Hoan_Tra", rows)
      }

      return NextResponse.json({ success: true, message: "Đồng bộ Google Sheets thành công" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Lỗi đồng bộ:", error)
    return NextResponse.json({ error: "Lỗi đồng bộ Google Sheets" }, { status: 500 })
  }
}
