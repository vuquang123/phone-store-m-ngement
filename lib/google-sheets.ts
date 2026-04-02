import { DateTime } from "luxon"
import { google } from "googleapis"

/* =================== Utils  =================== */
export const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .toLowerCase()

export function colIndex(header: string[], ...names: string[]) {
  const h = header.map((x) => x.trim())
  for (const n of names) {
    const i = h.findIndex((x) => x === n)
    if (i !== -1) return i
  }
  // fallback nhẹ bằng normalize (phòng sai khác dấu)
  const hh = header.map((x) => norm(x))
  for (const n of names) {
    const i = hh.findIndex((x) => x === norm(n))
    if (i !== -1) return i
  }
  return -1
}


// Cập nhật trạng thái bảo hành cho nhiều sản phẩm trong sheet Bao_Hanh
export async function updateBaoHanhStatus(imeis: string[], employeeId: string) {
  const { header, rows } = await readFromGoogleSheets("Bao_Hanh")
  const idxIMEI = header.findIndex(h => h.trim().toLowerCase() === "imei")
  const idxTrangThai = header.findIndex(h => h.trim().toLowerCase() === "trạng thái")
  const idxNgayNhanLai = header.findIndex(h => h.trim().toLowerCase() === "ngày nhận lại")
  if (idxIMEI === -1 || idxTrangThai === -1) return { success: false, error: "Không tìm thấy cột IMEI hoặc Trạng Thái" }
  const nowVN = DateTime.now().setZone('Asia/Ho_Chi_Minh').toFormat('HH:mm:ss dd/MM/yyyy')
  const ngayNhanLai = nowVN
  const updatedRows = rows.map(row => {
    if (imeis.includes(row[idxIMEI])) {
      row[idxTrangThai] = "Hoàn thành bảo hành"
      if (idxNgayNhanLai !== -1) {
        row[idxNgayNhanLai] = ngayNhanLai
      }
    }
    return row
  })
  await syncToGoogleSheets("Bao_Hanh", updatedRows)
  // Ghi lịch sử trạng thái máy
  await logProductHistory(imeis, "Hoàn thành bảo hành", employeeId)
  return { success: true, count: imeis.length }
}
// Lấy danh sách sản phẩm bảo hành hiện tại từ sheet Bao_Hanh
export async function getBaoHanhProducts() {
  const { header, rows } = await readFromGoogleSheets("Bao_Hanh")
  // Chỉ lấy các sản phẩm có trạng thái "Bảo hành" (không phân biệt hoa thường)
  const idxTrangThai = header.findIndex(h => h.trim().toLowerCase() === "trạng thái")
  if (idxTrangThai === -1) return []
  const filteredRows = rows.filter(row => (row[idxTrangThai] || "").trim().toLowerCase() === "bảo hành")
  // Trả về mảng object cho dễ dùng ở FE, luôn lấy dữ liệu mới nhất từ sheet
  return filteredRows.map(row => {
    const obj: any = {}
    header.forEach((col, idx) => {
      if (col.trim() === "Màu Sắc") {
        obj["Màu Sắc"] = row[idx] || ""
      } else {
        obj[col.trim()] = row[idx] || ""
      }
    })
    return obj
  })
}

const GOOGLE_SHEETS_CLIENT_EMAIL =
  process.env.GOOGLE_CLIENT_EMAIL ||
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  ""

const RAW_PRIVATE_KEY =
  (process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "")

function normalizePrivateKey(raw: string) {
  if (!raw) return ""
  let key = raw.trim()
  // Nếu người dùng dán kèm dấu quote bao quanh → bỏ
  if ((key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  // Luôn thay literal \n thành newline thật (an toàn, kể cả đã có newline sẵn)
  key = key.replace(/\\n/g, "\n")
  // Một số copy có thoát dấu gạch ngang \- (hiếm) → chuẩn hoá nhẹ
  key = key.replace(/-----BEGIN[ -]PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----')
  key = key.replace(/-----END[ -]PRIVATE KEY-----/, '-----END PRIVATE KEY-----')
      const nowVN = DateTime.now().setZone('Asia/Ho_Chi_Minh').toFormat('HH:mm:ss dd/MM/yyyy')
  if (!key.includes('BEGIN') && /^[A-Za-z0-9+/=]+$/.test(key)) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8')
      if (decoded.includes('BEGIN PRIVATE KEY')) key = decoded
    } catch {}
  }
  return key
}

const GOOGLE_SHEETS_PRIVATE_KEY = normalizePrivateKey(RAW_PRIVATE_KEY)

// Ghi thông tin debug (an toàn, không in toàn bộ key) để endpoint khác lấy
try {
  ;(globalThis as any).__GS_KEY_DEBUG = {
    hasBegin: GOOGLE_SHEETS_PRIVATE_KEY.includes('BEGIN PRIVATE KEY'),
    firstLine: GOOGLE_SHEETS_PRIVATE_KEY.split('\n')[0],
    lastLine: GOOGLE_SHEETS_PRIVATE_KEY.split('\n').slice(-1)[0],
    lineCount: GOOGLE_SHEETS_PRIVATE_KEY ? GOOGLE_SHEETS_PRIVATE_KEY.split('\n').length : 0,
    length: GOOGLE_SHEETS_PRIVATE_KEY.length,
  }
} catch {}

const GOOGLE_SHEETS_SPREADSHEET_ID =
  (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID || "") as string

if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
  console.error("[Google Sheets] Thiếu biến môi trường cần thiết.")
  console.error("  GOOGLE_SHEETS_CLIENT_EMAIL:", GOOGLE_SHEETS_CLIENT_EMAIL ? "OK" : "MISSING")
  console.error("  PRIVATE_KEY present:", RAW_PRIVATE_KEY ? "YES" : "NO")
  console.error("  SPREADSHEET_ID:", GOOGLE_SHEETS_SPREADSHEET_ID ? "OK" : "MISSING")
}


function buildAuth() {
  // Ghi log nhẹ dạng fingerprint để debug (không in toàn bộ key)
  const fingerprint = GOOGLE_SHEETS_PRIVATE_KEY
    ? GOOGLE_SHEETS_PRIVATE_KEY.split('\n').slice(-2, -1)[0]?.slice(0, 16)
    : 'none'
  if (!GOOGLE_SHEETS_PRIVATE_KEY.includes('BEGIN')) {
    console.error('[Google Sheets] Private key không chứa BEGIN PRIVATE KEY (có thể chưa decode đúng). Fingerprint:', fingerprint)
  }
  return new google.auth.JWT({
    email: GOOGLE_SHEETS_CLIENT_EMAIL,
    key: GOOGLE_SHEETS_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

const auth = buildAuth()


const sheets = google.sheets({ version: "v4", auth })

type SheetData = { header: string[]; rows: string[][] }

type SheetCacheEntry = {
  data?: SheetData
  expiresAt: number
  pending?: Promise<SheetData>
  lastErrorAt?: number
}

// Reuse a global cache in dev to avoid HMR re-allocations
const SHEETS_CACHE: Map<string, SheetCacheEntry> = (globalThis as any).__GS_SHEETS_CACHE || new Map()
;(globalThis as any).__GS_SHEETS_CACHE = SHEETS_CACHE

// Lưu lần đọc thành công gần nhất để dùng khi bị quota 429
const LAST_GOOD_DATA: Map<string, SheetData> = (globalThis as any).__GS_LAST_GOOD_DATA || new Map()
;(globalThis as any).__GS_LAST_GOOD_DATA = LAST_GOOD_DATA

const READ_MIN_INTERVAL_MS = 250
const CACHE_TTL_MS = 15_000
const MAX_CACHE_ENTRIES = 8
let lastReadAt = 0

async function throttleReads() {
  const now = Date.now()
  const elapsed = now - lastReadAt
  if (elapsed < READ_MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, READ_MIN_INTERVAL_MS - elapsed))
  }
  lastReadAt = Date.now()
}

function escapeSheetName(name: string) {
  // Always wrap in single quotes and escape internal quotes by doubling them
  const sanitized = (name || "").replace(/'/g, "''")
  return `'${sanitized}'`
}

function invalidateSheetCache(sheetName: string) {
  try {
    const prefix = `${sheetName}::`
    for (const key of Array.from(SHEETS_CACHE.keys())) {
      if (key.startsWith(prefix)) {
        SHEETS_CACHE.delete(key)
      }
    }
  } catch {}
}

// Đọc dữ liệu, trả về { header, rows }
// Mặc định đọc rộng tới cột ZZ để tránh thiếu cột (sheet này vượt quá Z)
export async function readFromGoogleSheets(sheetName: string, range: string = "A1:ZZ10000", options?: { silent?: boolean }): Promise<SheetData> {
  const cacheKey = `${sheetName}::${range}`
  const cacheEntry = SHEETS_CACHE.get(cacheKey)
  const now = Date.now()

  if (cacheEntry?.data && cacheEntry.expiresAt > now) {
    return cacheEntry.data
  }

  if (cacheEntry?.pending) {
    return cacheEntry.pending
  }

  // prune expired entries and enforce max size
  for (const [k, v] of SHEETS_CACHE) {
    if (!v.data || v.expiresAt <= now) SHEETS_CACHE.delete(k)
  }
  if (SHEETS_CACHE.size > MAX_CACHE_ENTRIES) {
    const keys = Array.from(SHEETS_CACHE.keys())
    for (const k of keys) {
      if (SHEETS_CACHE.size <= MAX_CACHE_ENTRIES) break
      SHEETS_CACHE.delete(k)
    }
  }

  const fetchPromise = (async (): Promise<SheetData> => {
    try {
      await throttleReads()
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
        range: `${escapeSheetName(sheetName)}!${range}`,
      })
      const values = response.data.values || []
      const data: SheetData = {
        header: values[0] || [],
        rows: values.slice(1),
      }
      // Avoid caching extremely large payloads (>10k cells) to reduce memory footprint
      const approxCells = (data.header.length + data.rows.length * (data.header.length || 10))
      const shouldCache = approxCells < 10_000
      SHEETS_CACHE.set(cacheKey, {
        data: shouldCache ? data : undefined,
        expiresAt: shouldCache ? (Date.now() + CACHE_TTL_MS) : 0,
      })
      LAST_GOOD_DATA.set(cacheKey, data)
      return data
    } catch (error: any) {
      const logPayload = {
        sheet: sheetName,
        range,
        message: error?.message,
        code: error?.code,
        errors: error?.errors,
        hasBegin: GOOGLE_SHEETS_PRIVATE_KEY.includes('BEGIN'),
        keyFirstLine: GOOGLE_SHEETS_PRIVATE_KEY.split('\n')[0],
        email: GOOGLE_SHEETS_CLIENT_EMAIL,
      }

      if (!options?.silent) {
        console.error("[Sheets] Read error:", logPayload)
      }

      if (error?.code === 429 && (cacheEntry?.data || LAST_GOOD_DATA.has(cacheKey))) {
        const fallback = cacheEntry?.data || LAST_GOOD_DATA.get(cacheKey)!
        const cachedAge = cacheEntry?.data
          ? (now - (cacheEntry.expiresAt - CACHE_TTL_MS))
          : 0
        console.warn(`[Sheets] Serving stale data for ${sheetName} due to quota (age ${cachedAge}ms).`)
        SHEETS_CACHE.set(cacheKey, {
          data: fallback,
          expiresAt: Date.now() + Math.min(CACHE_TTL_MS, 5_000),
          lastErrorAt: Date.now(),
        })
        return fallback
      }

      SHEETS_CACHE.set(cacheKey, {
        data: cacheEntry?.data,
        expiresAt: cacheEntry?.data ? Date.now() + 2_000 : 0,
        lastErrorAt: Date.now(),
      })

      const err = new Error(error?.message || "Lỗi đọc Google Sheets") as any
      if (error?.code) err.code = error.code
      throw err
    } finally {
      const entry = SHEETS_CACHE.get(cacheKey)
      if (entry) {
        delete entry.pending
      }
    }
  })()

  SHEETS_CACHE.set(cacheKey, {
    ...(cacheEntry || { expiresAt: 0 }),
    pending: fetchPromise,
    data: cacheEntry?.data,
    expiresAt: cacheEntry?.data ? cacheEntry.expiresAt : 0,
  })

  return fetchPromise
}

// Ghi đè toàn bộ dữ liệu (bỏ qua header)
export async function syncToGoogleSheets(sheetName: string, data: any[], range: string = "A2") {
  try {
    if (!data || !Array.isArray(data)) {
        return { success: false, error: "Dữ liệu đồng bộ không hợp lệ (không phải mảng)" }
    }

    // Xóa dữ liệu cũ rộng hẳn ra (đến cột ZZ) để chắc chắn không còn dữ liệu "ma"
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${escapeSheetName(sheetName)}!A2:ZZ10000`,
    })
    // Thêm dữ liệu mới
    if (data.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
          range: `${escapeSheetName(sheetName)}!${range}`,
          valueInputOption: "RAW",
          requestBody: {
            values: data,
          },
        })
    }
    invalidateSheetCache(sheetName)
    return { success: true }
  } catch (error: any) {
    console.error("Lỗi đồng bộ Google Sheets:", error)
    return { success: false, error: error.message || "Lỗi đồng bộ Google Sheets" }
  }
}

// Helper chuyển số thành tên cột (1 -> A, 27 -> AA)
function numberToColumnName(num: number): string {
    let name = "";
    while (num > 0) {
        let mod = (num - 1) % 26;
        name = String.fromCharCode(65 + mod) + name;
        num = Math.floor((num - mod) / 26);
    }
    return name || "Z";
}

// Thêm dòng mới vào sheet
export async function appendToGoogleSheets(sheetName: string, data: any[]) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: escapeSheetName(sheetName),
      valueInputOption: "RAW",
      requestBody: {
        values: [data],
      },
    })
    invalidateSheetCache(sheetName)
    return { success: true }
  } catch (error: any) {
    console.error("Lỗi thêm vào Google Sheets:", error)
    return { success: false, error: error.message || "Lỗi thêm vào Google Sheets" }
  }
}

// Thêm nhiều dòng mới vào sheet
export async function appendMultipleToGoogleSheets(sheetName: string, data: any[][]) {
  if (!data || data.length === 0) return { success: true }
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: escapeSheetName(sheetName),
      valueInputOption: "RAW",
      requestBody: {
        values: data,
      },
    })
    invalidateSheetCache(sheetName)
    return { success: true }
  } catch (error: any) {
    console.error("Lỗi bulk thêm vào Google Sheets:", error)
    return { success: false, error: error.message || "Lỗi bulk thêm vào Google Sheets" }
  }
}

// Cập nhật một dòng theo giá trị khóa
export async function updateRowInGoogleSheets(sheetName: string, key: string, keyValue: string, newData: any[]) {
  try {
    const { header, rows } = await readFromGoogleSheets(sheetName)
    const keyIndex = colIndex(header, key)
    if (keyIndex === -1) return { success: false, error: `Không tìm thấy cột khóa "${key}"` }

    let updatedRows: any[][] = [];
    if (Array.isArray(newData[0])) {
        updatedRows = newData;
    } else {
        const rowIndex = rows.findIndex(row => String(row[keyIndex]).trim() === String(keyValue).trim());
        if (rowIndex === -1) {
            return { success: false, error: `Không tìm thấy dòng có ${key} = ${keyValue}` };
        }
        updatedRows = [...rows];
        updatedRows[rowIndex] = newData;
    }

    await syncToGoogleSheets(sheetName, updatedRows)
    return { success: true }
  } catch (error: any) {
    console.error("Lỗi cập nhật dòng Google Sheets:", error)
    return { success: false, error: error.message || "Lỗi cập nhật dòng Google Sheets" }
  }
}

export async function updateRangeValues(range: string, values: any[][]) {
  const sheets = google.sheets({ version: "v4", auth })
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values },
  })
  try {
    const m = range.match(/^'?(.*?)'?!/)
    if (m && m[1]) invalidateSheetCache(m[1].replace(/''/g, "'"))
  } catch {}
  return { success: true }
}

// Cập nhật trạng thái cho nhiều sản phẩm trong sheet Kho_Hang
export async function updateProductsStatus(productIds: string[], newStatus: string) {
  const { header, rows } = await readFromGoogleSheets("Kho_Hang")
  const idxId = colIndex(header, "ID Máy")
  const idxIMEI = colIndex(header, "IMEI")
  const idxSerial = colIndex(header, "Serial")
  const idxTrangThai = colIndex(header, "Trạng Thái")
  
  if (idxId === -1 || idxTrangThai === -1) return { success: false, error: "Không tìm thấy cột ID Máy hoặc Trạng Thái" }
  
  // Chuẩn hóa productIds để so khớp
  const normIds = productIds.map(id => String(id || "").trim().toLowerCase()).filter(Boolean)

  const updatedRows = rows.map(row => {
    const imei = String(row[idxIMEI] || "").trim()
    const serial = String(row[idxSerial] || "").trim()
    const idMay = String(row[idxId] || "").trim()

    const imeiLower = imei.toLowerCase()
    const serialLower = serial.toLowerCase()
    const idMayLower = idMay.toLowerCase()

    const imeiLast5 = imeiLower.length >= 5 ? imeiLower.slice(-5) : ""
    const serialLast5 = serialLower.length >= 5 ? serialLower.slice(-5) : ""

    const isMatch = normIds.some(pid => 
      (imeiLower && pid === imeiLower) ||
      (serialLower && pid === serialLower) ||
      (idMayLower && pid === idMayLower) ||
      (imeiLast5 && pid === imeiLast5) ||
      (serialLast5 && pid === serialLast5)
    )

    if (isMatch) {
      row[idxTrangThai] = newStatus
    }
    return row
  })
  
  const syncResult = await syncToGoogleSheets("Kho_Hang", updatedRows)
  if (!syncResult.success) {
    return { success: false, error: "Lỗi đồng bộ kho hàng: " + syncResult.error }
  }
  return { success: true, count: productIds.length }
}
export async function moveProductsToCNC(productIds: string[], cncAddress: string) {
  // Đọc dữ liệu kho hàng
  const { header: khoHeader, rows } = await readFromGoogleSheets("Kho_Hang")
  const idxId = colIndex(khoHeader, "ID Máy")
  const idxTrangThai = colIndex(khoHeader, "Trạng Thái")
  const idxNguonKho = colIndex(khoHeader, "Nguồn", "Nguồn Hàng", "Nguon", "Nguon Hang", "Trạng Thái Kho")
  if (idxId === -1 || idxTrangThai === -1) return { success: false, error: "Không tìm thấy cột ID Máy hoặc Trạng Thái" }

  // Tìm các sản phẩm cần chuyển
  const productsToMove = rows.filter(row => productIds.includes(row[idxId]))
  if (productsToMove.length === 0) return { success: false, error: "Không tìm thấy sản phẩm cần chuyển" }

  // Cập nhật trạng thái trong kho
  const updatedRows = rows.map(row => {
    if (productIds.includes(row[idxId])) {
      row[idxTrangThai] = "Đang CNC"
    }
    return row
  })
  const syncResult = await syncToGoogleSheets("Kho_Hang", updatedRows)
  if (!syncResult.success) {
    return { success: false, error: "Lỗi đồng bộ kho hàng: " + syncResult.error }
  }

  // Đọc dữ liệu sheet CNC
  const { header: cncHeader, rows: cncRows } = await readFromGoogleSheets("CNC")
  const idxCncId = colIndex(cncHeader, "ID Máy")
  const idxCncTrangThai = colIndex(cncHeader, "Trạng Thái")
  const idxCncNgayGui = colIndex(cncHeader, "Ngày gửi")
  const idxCncDiaChi = colIndex(cncHeader, "Địa chỉ CNC")


  // Ghi nhận thời gian theo múi giờ Việt Nam để tránh lệch UTC
  const nowVN = DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("HH:mm:ss dd/MM/yyyy")

  let newCncRows = [...cncRows]
  for (const row of productsToMove) {
    const idMay = row[idxId]
    // Map các trường đặc biệt nếu thiếu
    const imei = row[khoHeader.indexOf("IMEI")] || ""
    const nguon = (idxNguonKho !== -1 && row[idxNguonKho]) ? row[idxNguonKho] : "Kho trong"
    const tinh_trang = row[khoHeader.indexOf("Tình Trạng Máy")] || row[khoHeader.indexOf("Tình trạng")] || ""
    // Tạo dòng mới đúng thứ tự cột CNC
    const newRow = cncHeader.map(col => {
      if (col === "IMEI" || col === "Imei") return imei
      if (col === "Nguồn") return nguon
      if (col === "Tình trạng") return tinh_trang
      if (col === "Màu Sắc" || col === "mau_sac") {
        const idxMau = colIndex(khoHeader, "Màu Sắc", "mau_sac")
        return idxMau !== -1 ? row[idxMau] : ""
      }
      const idxInKho = colIndex(khoHeader, col)
      if (idxInKho !== -1) {
        return row[idxInKho]
      }
      if (col === "Địa chỉ CNC") return cncAddress
      if (col === "Ngày gửi") return nowVN
      if (col === "Trạng Thái") return "Đang CNC"
      return ""
    })
    // Nếu máy đã tồn tại trong sheet CNC thì cập nhật, nếu chưa thì thêm mới
    const existIdx = newCncRows.findIndex(r => r[idxCncId] === idMay)
    if (existIdx !== -1) {
    newCncRows[existIdx] = newRow
    } else {
      newCncRows.push(newRow)
    }
  }
  const syncCncResult = await syncToGoogleSheets("CNC", newCncRows)
  if (!syncCncResult.success) {
    return { success: false, error: "Lỗi đồng bộ sheet CNC: " + syncCncResult.error }
  }

    // Ghi lịch sử trạng thái máy sẽ được gọi từ API, không ghi ở đây nữa
    return { success: true, count: productsToMove.length }
  }

  // Lấy danh sách lịch sử bảo hành từ sheet Bao_Hanh
  export async function getBaoHanhHistory() {
    const { header, rows } = await readFromGoogleSheets("Bao_Hanh")
    // Trả về mảng object cho dễ dùng ở FE
    return rows.map(row => {
      const obj: any = {}
      header.forEach((col, idx) => {
        if (col === "Màu Sắc" || col === "mau_sac") {
          obj["Màu Sắc"] = row[idx] || ""
        } else {
          obj[col] = row[idx] || ""
        }
      })
      return obj
    })
}

// Ghi lịch sử trạng thái máy
export async function logProductHistory(productIds: string[], newStatus: string, employeeId: string, oldStatuses?: string[]) {
  const { header, rows } = await readFromGoogleSheets("Kho_Hang")
  const idxId = colIndex(header, "ID Máy")
  const idxTenSP = colIndex(header, "Tên Sản Phẩm")

  const now = new Date()
  const nowVN = DateTime.now().setZone('Asia/Ho_Chi_Minh').toFormat('HH:mm:ss dd/MM/yyyy')
  // Đọc thêm sheet CNC để lấy tên sản phẩm nếu không có ở kho
  const { header: cncHeader, rows: cncRows } = await readFromGoogleSheets("CNC")
  const idxCncId = colIndex(cncHeader, "ID Máy")
  const idxCncTenSP = colIndex(cncHeader, "Tên Sản Phẩm")
  const idxCncIMEI = colIndex(cncHeader, "IMEI")

  for (let i = 0; i < productIds.length; i++) {
    let imei = productIds[i];
    let idLast5 = imei.slice(-5);
    let tenSP = "";
    let trangThaiCu = "";
    const imeiIdx = colIndex(header, "IMEI")
    const ttIdx = colIndex(header, "Trạng Thái")
    let row = rows.find(r => {
      return imeiIdx !== -1 && r[imeiIdx] && String(r[imeiIdx]).endsWith(idLast5);
    });
    if (row) {
      tenSP = row[idxTenSP];
      trangThaiCu = oldStatuses && oldStatuses[i] ? oldStatuses[i] : (ttIdx !== -1 ? row[ttIdx] : "");
    } else {
      // Nếu không tìm thấy ở kho thì tìm theo ID Máy ở CNC
      let cncRow = null;
      const cncImeiIdx = colIndex(cncHeader, "IMEI")
      const cncTtIdx = colIndex(cncHeader, "Trạng Thái")
      if (cncImeiIdx !== -1) {
        cncRow = cncRows.find(r => r[cncImeiIdx] && String(r[cncImeiIdx]).endsWith(idLast5));
      }
      tenSP = (cncRow && idxCncTenSP !== -1) ? cncRow[idxCncTenSP] : "";
      trangThaiCu = oldStatuses && oldStatuses[i] ? oldStatuses[i] : (cncRow && cncTtIdx !== -1 ? cncRow[cncTtIdx] : "");
    }
  await appendToGoogleSheets("Lich_Su_Trang_Thai_May", [
      idLast5,
      tenSP,
      trangThaiCu,
      newStatus,
      nowVN,
      employeeId
    ]);
  }
  return { success: true, count: productIds.length }
}

export async function updateProductsNguon(productIds: string[], newNguon: string, employeeId: string) {
  const { header, rows } = await readFromGoogleSheets("Kho_Hang")
  const idxId = colIndex(header, "ID Máy")
  // Kiểm tra nhiều tên cột khác nhau để tìm cột Nguồn hàng (giống logic trong app/api/kho-hang/route.ts)
  const idxNguon = colIndex(header, "Nguồn", "Nguồn Hàng", "Nguon", "Nguon Hang", "Trạng Thái Kho", "Trạng thái kho", "Tình Trạng Tồn", "Kho Hiển Thị")
  const idxTrangThai = colIndex(header, "Trạng Thái")

  if (idxId === -1 || idxNguon === -1) {
    return { success: false, error: `Không tìm thấy cột ID Máy (${idxId}) hoặc Nguồn hàng (${idxNguon}).` }
  }

  const oldStatuses: string[] = []
  const devices: any[] = []
  const idxTenSP = colIndex(header, "Tên Sản Phẩm")
  const idxIMEI = colIndex(header, "IMEI")

  const updatedRows = rows.map(row => {
    if (productIds.includes(row[idxId])) {
      oldStatuses.push(idxTrangThai !== -1 ? row[idxTrangThai] : "")
      row[idxNguon] = newNguon
      devices.push({
        name: idxTenSP !== -1 ? row[idxTenSP] : "Máy",
        imei: idxIMEI !== -1 ? row[idxIMEI] : ""
      })
    }
    return row
  })

  const syncResult = await syncToGoogleSheets("Kho_Hang", updatedRows)
  if (syncResult.success) {
    // Ghi lịch sử chuyển kho
    await logProductHistory(productIds, `Chuyển sang ${newNguon}`, employeeId, oldStatuses)
    return { ...syncResult, devices }
  }
  return syncResult
}
