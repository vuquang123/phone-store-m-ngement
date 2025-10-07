// Cập nhật trạng thái bảo hành cho nhiều sản phẩm trong sheet Bao_Hanh
export async function updateBaoHanhStatus(imeis: string[], employeeId: string) {
  const { header, rows } = await readFromGoogleSheets("Bao_Hanh")
  const idxIMEI = header.findIndex(h => h.trim().toLowerCase() === "imei")
  const idxTrangThai = header.findIndex(h => h.trim().toLowerCase() === "trạng thái")
  const idxNgayNhanLai = header.findIndex(h => h.trim().toLowerCase() === "ngày nhận lại")
  if (idxIMEI === -1 || idxTrangThai === -1) return { success: false, error: "Không tìm thấy cột IMEI hoặc Trạng Thái" }
  const now = new Date()
  const ngayNhanLai = now.toLocaleTimeString("vi-VN") + " " + now.toLocaleDateString("vi-VN")
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
      obj[col.trim()] = row[idx] || ""
    })
    return obj
  })
}
import { google } from "googleapis"

// Hỗ trợ cả hai bộ tên biến môi trường để tránh nhầm lẫn:
//  - Cũ: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID
//  - Khuyến nghị / Bạn đã tạo: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_SHEETS_ID
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
  // Nếu thiếu BEGIN nhưng là base64 thuần → thử decode
  if (!key.includes('BEGIN') && /^[A-Za-z0-9+/=]+$/.test(key)) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8')
      if (decoded.includes('BEGIN PRIVATE KEY')) key = decoded
    } catch {}
  }
  return key
}

const GOOGLE_SHEETS_PRIVATE_KEY = normalizePrivateKey(RAW_PRIVATE_KEY)

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

// Đọc dữ liệu, trả về { header, rows }
export async function readFromGoogleSheets(sheetName: string, range: string = "A:Z") {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    })
    const values = response.data.values || []
    const header = values[0] || []
    const rows = values.slice(1)
    return { header, rows }
  } catch (error: any) {
    console.error("[Sheets] Read error:", {
      sheet: sheetName,
      range,
      message: error?.message,
      code: error?.code,
      errors: error?.errors,
      hasBegin: GOOGLE_SHEETS_PRIVATE_KEY.includes('BEGIN'),
      keyFirstLine: GOOGLE_SHEETS_PRIVATE_KEY.split('\n')[0],
      email: GOOGLE_SHEETS_CLIENT_EMAIL,
    })
    throw new Error(error.message || "Lỗi đọc Google Sheets")
  }
}

// Ghi đè toàn bộ dữ liệu (bỏ qua header)
export async function syncToGoogleSheets(sheetName: string, data: any[], range: string = "A2") {
  try {
    // Xóa dữ liệu cũ
    await sheets.spreadsheets.values.clear({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${sheetName}!A2:Z`,
    })
    // Thêm dữ liệu mới
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
      valueInputOption: "RAW",
      requestBody: {
        values: data,
      },
    })
    return { success: true }
  } catch (error: any) {
    console.error("Lỗi đồng bộ Google Sheets:", error)
    return { success: false, error: error.message || "Lỗi đồng bộ Google Sheets" }
  }
}

// Thêm dòng mới vào sheet
export async function appendToGoogleSheets(sheetName: string, data: any[]) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: "RAW",
      requestBody: {
        values: [data],
      },
    })
    return { success: true }
  } catch (error: any) {
    console.error("Lỗi thêm vào Google Sheets:", error)
    return { success: false, error: error.message || "Lỗi thêm vào Google Sheets" }
  }
}

// Cập nhật một dòng theo giá trị khóa
export async function updateRowInGoogleSheets(sheetName: string, key: string, keyValue: string, newData: any[]) {
  try {
    const { header, rows } = await readFromGoogleSheets(sheetName)
    const keyIndex = header.indexOf(key)
    if (keyIndex === -1) return { success: false, error: "Không tìm thấy cột khóa" }
    // newData là mảng các dòng đã cập nhật, thay thế toàn bộ rows
    await syncToGoogleSheets(sheetName, newData)
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
  return { success: true }
}

// Di chuyển nhiều sản phẩm sang sheet CNC, cập nhật trạng thái, ghi lịch sử
// Cập nhật trạng thái cho nhiều sản phẩm trong sheet Kho_Hang
export async function updateProductsStatus(productIds: string[], newStatus: string) {
  const { header, rows } = await readFromGoogleSheets("Kho_Hang")
  const idxId = header.indexOf("ID Máy")
  const idxIMEI = header.indexOf("IMEI")
  const idxTrangThai = header.indexOf("Trạng Thái")
  if (idxId === -1 || idxIMEI === -1 || idxTrangThai === -1) return { success: false, error: "Không tìm thấy cột ID Máy, IMEI hoặc Trạng Thái" }
  const updatedRows = rows.map(row => {
    // So sánh 5 số cuối IMEI với ID Máy
    const imei = row[idxIMEI] || ""
    const idMay = row[idxId] || ""
    const imeiLast5 = imei.slice(-5)
    if (productIds.includes(imei) || productIds.includes(imeiLast5) || productIds.includes(idMay)) {
      row[idxTrangThai] = newStatus
    }
    return row
  })
  await syncToGoogleSheets("Kho_Hang", updatedRows)
  return { success: true, count: productIds.length }
}
export async function moveProductsToCNC(productIds: string[], cncAddress: string) {
  // Đọc dữ liệu kho hàng
  const { header: khoHeader, rows } = await readFromGoogleSheets("Kho_Hang")
  const idxId = khoHeader.indexOf("ID Máy")
  const idxTrangThai = khoHeader.indexOf("Trạng Thái")
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
  await syncToGoogleSheets("Kho_Hang", updatedRows)

  // Đọc dữ liệu sheet CNC
  const { header: cncHeader, rows: cncRows } = await readFromGoogleSheets("CNC")
  const idxCncId = cncHeader.indexOf("ID Máy")
  const idxCncTrangThai = cncHeader.indexOf("Trạng Thái")
  const idxCncNgayGui = cncHeader.indexOf("Ngày gửi")
  const idxCncDiaChi = cncHeader.indexOf("Địa chỉ CNC")

  let newCncRows = [...cncRows]
  for (const row of productsToMove) {
    const idMay = row[idxId]
    // Map các trường đặc biệt nếu thiếu
    const imei = row[khoHeader.indexOf("IMEI")] || ""
    const nguon = row[khoHeader.indexOf("Nguồn")] || ((row[khoHeader.indexOf("Giá Nhập")] || row[khoHeader.indexOf("Giá Bán")]) ? "Kho shop" : "Khách ngoài")
    const tinh_trang = row[khoHeader.indexOf("Tình Trạng Máy")] || row[khoHeader.indexOf("Tình trạng")] || ""
    // Tạo dòng mới đúng thứ tự cột CNC
    const newRow = cncHeader.map(col => {
      if (col === "IMEI" || col === "Imei") return imei
      if (col === "Nguồn") return nguon
      if (col === "Tình trạng") return tinh_trang
      const idxInKho = khoHeader.indexOf(col)
      if (idxInKho !== -1) {
        return row[idxInKho]
      }
      if (col === "Địa chỉ CNC") return cncAddress
      if (col === "Ngày gửi") return new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN")
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
  await syncToGoogleSheets("CNC", newCncRows)

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
        obj[col] = row[idx] || ""
      })
      return obj
    })
}

// Ghi lịch sử trạng thái máy
export async function logProductHistory(productIds: string[], newStatus: string, employeeId: string, oldStatuses?: string[]) {
  const { header, rows } = await readFromGoogleSheets("Kho_Hang")
  const idxId = header.indexOf("ID Máy")
  const idxTenSP = header.indexOf("Tên Sản Phẩm")
  const now = new Date()
  // Đọc thêm sheet CNC để lấy tên sản phẩm nếu không có ở kho
  const { header: cncHeader, rows: cncRows } = await readFromGoogleSheets("CNC")
  const idxCncId = cncHeader.indexOf("ID Máy")
  const idxCncTenSP = cncHeader.indexOf("Tên Sản Phẩm")
  const idxCncIMEI = cncHeader.indexOf("IMEI")
  for (let i = 0; i < productIds.length; i++) {
    let imei = productIds[i];
    let idLast5 = imei.slice(-5);
    let tenSP = "";
    let trangThaiCu = "";
    let row = rows.find(r => {
      const imeiIdx = header.indexOf("IMEI");
      return r[imeiIdx] && r[imeiIdx].endsWith(idLast5);
    });
    if (row) {
      tenSP = row[idxTenSP];
      trangThaiCu = oldStatuses && oldStatuses[i] ? oldStatuses[i] : (row ? row[header.indexOf("Trạng Thái")] : "");
    } else {
      // Nếu không tìm thấy ở kho thì tìm theo ID Máy ở CNC
      let cncRow = null;
      if (idxCncIMEI !== -1) {
        cncRow = cncRows.find(r => r[idxCncIMEI] && r[idxCncIMEI].endsWith(idLast5));
      }
      tenSP = cncRow ? cncRow[idxCncTenSP] : "";
      trangThaiCu = oldStatuses && oldStatuses[i] ? oldStatuses[i] : (cncRow ? cncRow[cncHeader.indexOf("Trạng Thái")] : "");
    }
    await appendToGoogleSheets("Lich_Su_Trang_Thai_May", [
      idLast5,
      tenSP,
      trangThaiCu,
      newStatus,
      now.toLocaleTimeString("vi-VN") + " " + now.toLocaleDateString("vi-VN"),
      employeeId
    ]);
  }
  return { success: true, count: productIds.length }
}
