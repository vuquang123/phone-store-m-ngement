// app/api/phu-kien/[id]/route.ts
import { google } from "googleapis"
import { NextResponse, type NextRequest } from "next/server"

// ================== CONFIG ==================
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID as string

// Tên sheet đúng như trên file bạn gửi
const PK_SHEET = "Phu_Kien"
const USERS_SHEET = "USERS"

// Header đúng thứ tự trên Google Sheet
const SHEET_HEADERS = [
  "ID",
  "Tên Sản Phẩm",
  "Loại",
  "Số Lượng",
  "Giá Nhập",
  "Giá Bán",
  "Ghi Chú",
  "Cập nhật lần cuối",
] as const

const USER_HEADERS = [
  "ID Nhân Viên",
  "Email",
  "Tên",
  "Vai Trò",
  "Ngày Tạo",
  "Trạng Thái",
  "Lần Đăng Nhập Cuối",
  "Mật Khẩu",
] as const

// Giữ nguyên schema API cho client
type APIItem = {
  id: string
  ten_phu_kien?: string
  loai_phu_kien?: string
  so_luong_ton?: number
  gia_nhap?: string | number
  gia_ban?: string | number
  ghi_chu?: string
  updated_at?: string
}

// ================== GOOGLE SHEETS CLIENT ==================
function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  return google.sheets({ version: "v4", auth })
}

async function getAllValues(sheetName: string) {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  })
  return res.data.values || []
}

function toIndexMap(headers: string[]) {
  const m: Record<string, number> = {}
  headers.forEach((h, i) => (m[h] = i))
  return m
}

function columnLetter(colNum: number) {
  let s = ""
  while (colNum > 0) {
    const mod = (colNum - 1) % 26
    s = String.fromCharCode(65 + mod) + s
    colNum = Math.floor((colNum - mod) / 26)
  }
  return s
}

function normalizeRole(v?: string | null) {
  if (!v) return undefined
  const x = v.trim().toLowerCase()
  // chấp nhận "quan_ly", "quản lý", "manager"
  if (x === "quan_ly" || x === "quản lý" || x === "manager") return "quan_ly"
  return x
}

// ================== AUTH (thay cho supabase.auth.getUser) ==================
// Bạn nối hàm này với NextAuth/JWT/Supabase Auth (chỉ xác thực) tùy hệ thống.
// Trả về { id } khớp với cột "ID Nhân Viên" trên sheet USERS.
async function getUserFromRequest(_req: NextRequest): Promise<{ id: string }> {
  // TODO: Implement thật sự (ví dụ đọc JWT từ cookie/header)
  // Trong lúc dev: comment dòng throw để test nhanh
  // throwIfUnauthorized(true)
  return { id: "demo-user-id" }
}
function throwIfUnauthorized(condition: boolean) {
  if (!condition) return
  const err: any = new Error("UNAUTHORIZED")
  err.status = 401
  throw err
}

// ================== HELPERS: PHU_KIEN ==================
function sheetRowToAPI(row: string[], header: string[]): APIItem {
  const idx = toIndexMap(header)
  return {
    id: row[idx["ID"]] || "",
    ten_phu_kien: row[idx["Tên Sản Phẩm"]] || "",
    loai_phu_kien: row[idx["Loại"]] || "",
    so_luong_ton: row[idx["Số Lượng"]] ? Number(row[idx["Số Lượng"]]) : undefined,
    gia_nhap: row[idx["Giá Nhập"]] ?? "",
    gia_ban: row[idx["Giá Bán"]] ?? "",
    ghi_chu: row[idx["Ghi Chú"]] ?? "",
    updated_at: row[idx["Cập nhật lần cuối"]] ?? "",
  }
}

function apiPatchToSheetPatch(patch: Partial<APIItem>, header: string[], currentRow: string[]) {
  // map field API -> header sheet
  const m: Record<string, any> = {}
  if (patch.ten_phu_kien !== undefined) m["Tên Sản Phẩm"] = patch.ten_phu_kien
  if (patch.loai_phu_kien !== undefined) m["Loại"] = patch.loai_phu_kien
  if (patch.so_luong_ton !== undefined && patch.so_luong_ton !== null && patch.so_luong_ton !== ("" as any)) {
    m["Số Lượng"] = Number(patch.so_luong_ton)
     const idx = toIndexMap(header)
    if (currentRow[idx["Số Lượng"]] !== String(patch.so_luong_ton)) {
      m["Cập nhật lần cuối"] = new Date().toISOString()
    }
  }
  if (patch.gia_nhap !== undefined) m["Giá Nhập"] = patch.gia_nhap
  if (patch.gia_ban !== undefined) m["Giá Bán"] = patch.gia_ban
  if (patch.ghi_chu !== undefined) m["Ghi Chú"] = patch.ghi_chu
  return m
}

function findRowById(allValues: string[][], idValue: string) {
  if (!allValues.length) return null
  const header = allValues[0]
  const idIdx = header.indexOf("ID")
  if (idIdx === -1) return null
  for (let i = 1; i < allValues.length; i++) {
    const row = allValues[i]
    if ((row[idIdx] || "") === idValue) {
      return { header, row, rowNumber: i + 1 }
    }
  }
  return null
}

async function updateRow(
  sheetName: string,
  rowNumber: number,
  patchByHeader: Record<string, any>
) {
  const sheets = getSheetsClient()
  const all = await getAllValues(sheetName)
  const header = all[0] || []
  const idx = toIndexMap(header)
  const current = all[rowNumber - 1] || []
  const newRow = [...current]

  for (const k of Object.keys(patchByHeader)) {
    const col = idx[k]
    if (col === undefined) continue
    const v = patchByHeader[k]
    if (v === undefined) continue
    if (v === null) newRow[col] = ""
    else newRow[col] = String(v)
  }

  const range = `${sheetName}!A${rowNumber}:${columnLetter(header.length)}${rowNumber}`
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [newRow] },
  })
}

async function deleteRow(sheetName: string, rowNumber: number) {
  const sheets = getSheetsClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const found = meta.data.sheets?.find((s) => s.properties?.title === sheetName)
  const sheetId = found?.properties?.sheetId
  if (sheetId == null) throw new Error(`Không tìm thấy sheet ${sheetName}`)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        },
      ],
    },
  })
}

// ================== HELPERS: USERS/ROLE ==================
async function getUserRole(userId: string) {
  const all = await getAllValues(USERS_SHEET)
  if (!all.length) return undefined
  const header = all[0]
  const idIdx = header.indexOf("ID Nhân Viên")
  const roleIdx = header.indexOf("Vai Trò")
  if (idIdx === -1 || roleIdx === -1) return undefined
  for (let i = 1; i < all.length; i++) {
    const row = all[i]
    if ((row[idIdx] || "") === userId) {
      return normalizeRole(row[roleIdx] || "")
    }
  }
  return undefined
}

// ================== ROUTES ==================
export async function GET(request: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
    const params = 'params' in ctx && typeof (ctx as any).params?.then === 'function'
      ? await (ctx as any).params
      : (ctx as any).params
    await getUserFromRequest(request)

    const all = await getAllValues(PK_SHEET)
    const found = findRowById(all, params.id)
    if (!found) return NextResponse.json({ error: "Không tìm thấy phụ kiện" }, { status: 404 })

    const data = sheetRowToAPI(found.row, found.header)
    return NextResponse.json(data)
  } catch (error: any) {
    if (error?.status === 401 || error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Phu kien GET by ID error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
    const params = 'params' in ctx && typeof (ctx as any).params?.then === 'function'
      ? await (ctx as any).params
      : (ctx as any).params
    await getUserFromRequest(request)
    const body = (await request.json()) as Partial<APIItem>

    const all = await getAllValues(PK_SHEET)
    const found = findRowById(all, params.id)
    if (!found) return NextResponse.json({ error: "Không tìm thấy phụ kiện" }, { status: 404 })

    // Truyền thêm header và currentRow vào patch
    const patch = apiPatchToSheetPatch(body, found.header, found.row)

    await updateRow(PK_SHEET, found.rowNumber, patch)

    const allAfter = await getAllValues(PK_SHEET)
    const ref = findRowById(allAfter, params.id)
    return NextResponse.json(ref ? sheetRowToAPI(ref.row, ref.header) : { id: params.id, ...body })
  } catch (error: any) {
    if (error?.status === 401 || error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Phu kien PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, ctx: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  try {
    const params = 'params' in ctx && typeof (ctx as any).params?.then === 'function'
      ? await (ctx as any).params
      : (ctx as any).params
    const user = await getUserFromRequest(request)
    const role = await getUserRole(user.id)

    if (normalizeRole(role) !== "quan_ly") {
      return NextResponse.json({ error: "Chỉ quản lý mới có thể xóa phụ kiện" }, { status: 403 })
    }

    const all = await getAllValues(PK_SHEET)
    const found = findRowById(all, params.id)
    if (!found) return NextResponse.json({ error: "Không tìm thấy phụ kiện" }, { status: 404 })

    await deleteRow(PK_SHEET, found.rowNumber)
    return NextResponse.json({ message: "Đã xóa phụ kiện thành công" })
  } catch (error: any) {
    if (error?.status === 401 || error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Phu kien DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
