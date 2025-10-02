// app/api/search/route.ts
import { google } from "googleapis"
import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// ========= CONFIG =========
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID as string
const SHEET_PRODUCTS = "Kho_Hang"
const SHEET_ACCESSORIES = "Phu_Kien"

// Header thực tế trong ảnh Kho_Hang
const PRODUCT_HEADERS = [
  "ID Máy",
  "Ngày Nhập",
  "Tên Sản Phẩm",
  "Loại Máy",
  "Dung Lượng",
  "Pin (%)",
  "Màu Sắc",
  "IMEI",
  "Tình Trạng Máy",
  "Giá Nhập",
  "Giá Bán",
  "Ghi Chú",
  "Trạng Thái",
] as const

// Header thực tế trong Phu_Kien
const ACCESSORY_HEADERS = [
  "ID",
  "Tên Sản Phẩm",
  "Loại",
  "Số Lượng",
  "Giá Nhập",
  "Giá Bán",
  "Ghi Chú",
] as const

// ========= GOOGLE SHEETS CLIENT =========
function sheetsClient(scope: "ro" | "rw" = "ro") {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: [
      scope === "ro"
        ? "https://www.googleapis.com/auth/spreadsheets.readonly"
        : "https://www.googleapis.com/auth/spreadsheets",
    ],
  })
  return google.sheets({ version: "v4", auth })
}

async function readSheetAll(sheetName: string) {
  const sheets = sheetsClient("ro")
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  })
  return (res.data.values || []) as string[][]
}

const norm = (s: any) => String(s ?? "").toLowerCase().trim()
const idxMap = (headers: string[]) => {
  const m: Record<string, number> = {}
  headers.forEach((h, i) => (m[h] = i))
  return m
}

// ========= AUTH PLACEHOLDER =========
// Thay bằng NextAuth/JWT/Supabase Auth nếu muốn chặn không đăng nhập.
async function getUserFromRequest(_req: NextRequest): Promise<{ id: string }> {
  return { id: "demo-user-id" }
}

// ========= ROUTE =========
export async function GET(request: NextRequest) {
  try {
    await getUserFromRequest(request)

    const { searchParams } = new URL(request.url)
    const search = norm(searchParams.get("search") || "")
    const limit = Number.parseInt(searchParams.get("limit") || "20") || 20

    if (!search) return NextResponse.json([])

    // Đọc 2 sheet
    const [pAll, aAll] = await Promise.all([
      readSheetAll(SHEET_PRODUCTS),
      readSheetAll(SHEET_ACCESSORIES),
    ])

    // ===== Products từ Kho_Hang =====
    let productResults: any[] = []
    if (pAll.length) {
      const header = pAll[0]
      const pIdx = idxMap(header)
      const h = (k: (typeof PRODUCT_HEADERS)[number]) => pIdx[k] ?? -1

      const nameCol = h("Tên Sản Phẩm")
      const loaiCol = h("Loại Máy")
      const dungLuongCol = h("Dung Lượng")
      const pinCol = h("Pin (%)")
      const mauCol = h("Màu Sắc")
      const imeiCol = h("IMEI")
      const ttMayCol = h("Tình Trạng Máy")
      const giaNhapCol = h("Giá Nhập")
      const giaBanCol = h("Giá Bán")
      const idMayCol = h("ID Máy")
      const trangThaiCol = h("Trạng Thái")

      productResults = pAll
        .slice(1)
        .filter((row) => {
          // Nếu có cột Trạng Thái: chỉ lấy còn hàng/blank (tùy bạn chỉnh)
          if (trangThaiCol >= 0) {
            const st = norm(row[trangThaiCol])
            if (st && st !== "Còn hàng" && st !== "còn hàng") return false
          }
          const name = nameCol >= 0 ? norm(row[nameCol]) : ""
          const loai = loaiCol >= 0 ? norm(row[loaiCol]) : ""
          const imei = imeiCol >= 0 ? norm(row[imeiCol]) : ""
          return name.includes(search) || loai.includes(search) || imei.includes(search)
        })
        .map((row) => {
          const giaNhapRaw = giaNhapCol >= 0 ? row[giaNhapCol] : ""
          const giaBanRaw = giaBanCol >= 0 ? row[giaBanCol] : ""
          const ghiChuCol = header.findIndex(h => h === "Ghi Chú")
          const ghiChu = ghiChuCol >= 0 ? row[ghiChuCol] : ""
          // Xử lý giá: loại bỏ dấu chấm ngăn cách hàng nghìn trước khi ép kiểu số
          const gia_nhap = Number(String(giaNhapRaw).replace(/\./g, "").replace(/[^\d.-]/g, "")) || 0
          const gia_ban = Number(String(giaBanRaw).replace(/\./g, "").replace(/[^\d.-]/g, "")) || 0
          return {
            type: "product",
            id: idMayCol >= 0 ? row[idMayCol] : undefined,
            ten_san_pham: `${nameCol >= 0 ? row[nameCol]  : ""} ${dungLuongCol >= 0 ? row[dungLuongCol] : ""} - ${mauCol >= 0 ? row[mauCol] : ""}`.trim(),
            loai_may: loaiCol >= 0 ? row[loaiCol] : "",
            dung_luong: dungLuongCol >= 0 ? row[dungLuongCol] : "",
            pin: pinCol >= 0 ? row[pinCol] : "",
            mau_sac: mauCol >= 0 ? row[mauCol] : "",
            imei: imeiCol >= 0 ? row[imeiCol] : "",
            tinh_trang: ttMayCol >= 0 ? row[ttMayCol] : "",
            gia_nhap,
            gia_ban,
            ghi_chu: ghiChu,
            trang_thai: trangThaiCol >= 0 ? row[trangThaiCol] : "",
          };
        })
    }

    // ===== Accessories từ Phu_Kien =====
    let accessoryResults: any[] = []
    if (aAll.length) {
      const header = aAll[0]
      const aIdx = idxMap(header)
      const h = (k: (typeof ACCESSORY_HEADERS)[number]) => aIdx[k] ?? -1

      const tenCol = h("Tên Sản Phẩm")
      const loaiCol = h("Loại")
      const soLuongCol = h("Số Lượng")
      const giaBanCol = h("Giá Bán")

      accessoryResults = aAll
        .slice(1)
        .filter((row) => {
          // chỉ lấy > 0 nếu có cột số lượng
          if (soLuongCol >= 0) {
            const n = Number(String(row[soLuongCol]).replace(/[^\d.-]/g, "")) || 0
            if (n <= 0) return false
          }
          const ten = tenCol >= 0 ? norm(row[tenCol]) : ""
          const loai = loaiCol >= 0 ? norm(row[loaiCol]) : ""
          return ten.includes(search) || loai.includes(search)
        })
        .map((row) => {
          const id = h("ID") >= 0 ? row[h("ID")] : undefined
          const ten = tenCol >= 0 ? row[tenCol] : ""
          const loai = loaiCol >= 0 ? row[loaiCol] : ""
          const gia = giaBanCol >= 0 ? row[giaBanCol] : ""
          // Ép kiểu giá bán về number, loại bỏ ký tự không phải số
          // Xử lý giá phụ kiện: loại bỏ dấu chấm ngăn cách hàng nghìn trước khi ép kiểu số
          const gia_ban = Number(String(gia).replace(/\./g, "").replace(/[^\d.-]/g, "")) || 0
          return {
            id,
            type: "accessory" as const,
            ten_phu_kien: ten,
            loai_phu_kien: loai,
            so_luong_ton: soLuongCol >= 0 ? Number(row[soLuongCol]) || 0 : undefined,
            ten_san_pham: ten,
            gia_ban,
          };
        })
    }

    // Gộp & giới hạn
    const results = [...productResults, ...accessoryResults].slice(0, limit)
    return NextResponse.json(results)
  } catch (error) {
    console.error("Search products error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
