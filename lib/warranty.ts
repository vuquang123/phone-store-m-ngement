import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues } from "./google-sheets"

export interface WarrantyPackage {
  code: string
  name: string
  price: number
  exchangeDays: number
  hwMonths: number
  cncMonths: number
  lifetime: boolean
  active: boolean
  notes?: string
}

export interface WarrantySelectionInput {
  imei?: string
  serial?: string
  packageCode: string
  startDate?: string // ISO string optional
  phone?: string
  employee?: string
  note?: string
}

export interface WarrantyContractRow {
  contractCode: string
  orderId: string
  imei: string
  serial?: string
  phone: string
  packageCode: string
  purchaseDate: string
  startDate: string
  exchangeUntil: string
  hardwareUntil: string
  cncUntil: string
  overallUntil: string
  lifetime: boolean
  status: string
  employee: string
  benefitJson: string
  note: string
}

const PACKAGE_SHEET = "GOI_BAO_HANH"
const CONTRACT_SHEET = "HOP_DONG_BAO_HANH"

function parseNumber(v: any): number { if (v === undefined || v === null || v === '') return 0; const n = Number(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0 }

export async function loadWarrantyPackages(): Promise<Record<string, WarrantyPackage>> {
  const { header, rows } = await readFromGoogleSheets(PACKAGE_SHEET)
  const map: Record<string, WarrantyPackage> = {}
  const idx = (name: string) => header.indexOf(name)
  const C = {
    code: idx("Mã Gói"), name: idx("Tên Gói"), price: idx("Giá (VND)"), ex: idx("Ngày Đổi 1-1"),
    hw: idx("Tháng BH Phần Cứng"), cnc: idx("Tháng BH CNC/Độ Sim"), lifetime: idx("Hỗ Trợ Trọn Đời"), active: idx("Kích Hoạt (TRUE/FALSE)"), notes: idx("Ghi Chú")
  }
  for (const r of rows) {
    const code = (r[C.code] || '').trim(); if (!code) continue
    map[code] = {
      code,
      name: r[C.name] || code,
      price: parseNumber(r[C.price]),
      exchangeDays: parseNumber(r[C.ex]),
      hwMonths: parseNumber(r[C.hw]),
      cncMonths: parseNumber(r[C.cnc]),
      lifetime: String(r[C.lifetime] || '').toLowerCase() === 'true',
      active: String(r[C.active] || '').toLowerCase() !== 'false',
      notes: r[C.notes] || ''
    }
  }
  return map
}

export function generateContractCode(orderId: string, identifier: string) {
  const orderDigits = (orderId || '').replace(/\D/g, '')
  const last3Order = orderDigits.slice(-3).padStart(3, '0')
  const idDigits = (identifier || '').replace(/\W/g, '')
  const last5 = idDigits.slice(-5).padStart(5, '0')
  return `HĐ${last5}-${last3Order}`
}

function addDays(date: Date, d: number) { const nd = new Date(date); nd.setDate(nd.getDate() + d); return nd }
function addMonths(date: Date, m: number) { const nd = new Date(date); nd.setMonth(nd.getMonth() + m); return nd }
function fmt(d: Date) { return d.toISOString().slice(0,10) } // YYYY-MM-DD

export function buildContracts(orderId: string, phone: string, selections: WarrantySelectionInput[], packages: Record<string, WarrantyPackage>, employee?: string): WarrantyContractRow[] {
  const now = new Date()
  return selections.map(sel => {
    const pkg = packages[sel.packageCode]
    const start = sel.startDate ? new Date(sel.startDate) : now
    const exchangeUntil = pkg.exchangeDays ? addDays(start, pkg.exchangeDays) : start
    const hwUntil = pkg.hwMonths ? addMonths(start, pkg.hwMonths) : start
    const cncUntil = pkg.cncMonths ? addMonths(start, pkg.cncMonths) : start
    const overall = new Date(Math.max(hwUntil.getTime(), cncUntil.getTime()))
    const benefit = {
      exchangeDays: pkg.exchangeDays,
      hardwareMonths: pkg.hwMonths,
      cncMonths: pkg.cncMonths,
      lifetimeSupport: pkg.lifetime
    }
    const identifier = sel.imei || sel.serial || ''
    return {
      contractCode: generateContractCode(orderId, identifier),
      orderId,
      imei: sel.imei || '',
      serial: sel.serial,
      phone: sel.phone || phone,
      packageCode: pkg.code,
      purchaseDate: fmt(now),
      startDate: fmt(start),
      exchangeUntil: fmt(exchangeUntil),
      hardwareUntil: fmt(hwUntil),
      cncUntil: fmt(cncUntil),
      overallUntil: fmt(overall),
      lifetime: pkg.lifetime,
      status: overall >= now ? 'active' : 'expired',
      employee: employee || sel.employee || '',
      benefitJson: JSON.stringify(benefit),
      note: sel.note || ''
    }
  })
}

export async function saveContracts(rows: WarrantyContractRow[]) {
  if (!rows.length) return { success: true, count: 0 }
  // Load header once to map order
  const { header } = await readFromGoogleSheets(CONTRACT_SHEET, 'A1:Z1')
  const index = (name: string) => header.indexOf(name)
  const push = async (row: WarrantyContractRow) => {
    const line = header.map(col => {
      switch (col) {
        case 'Mã HĐ': return row.contractCode
        case 'Mã Đơn': return row.orderId
        case 'IMEI': return row.imei
        case 'Serial': return row.serial || ''
        case 'SĐT Khách': return row.phone
        case 'Mã Gói': return row.packageCode
        case 'Ngày Mua': return row.purchaseDate
        case 'Ngày Bắt Đầu': return row.startDate
        case 'Hạn 1 Đổi 1': return row.exchangeUntil
        case 'Hạn Phần Cứng': return row.hardwareUntil
        case 'Hạn CNC/Độ Sim': return row.cncUntil
        case 'Hạn Tổng': return row.overallUntil
        case 'Hỗ Trợ Trọn Đời': return row.lifetime ? 'TRUE' : 'FALSE'
        case 'Trạng Thái': return row.status
        case 'Nhân Viên': return row.employee
        case 'Thông Tin Lợi Ích': return row.benefitJson
        case 'Ghi Chú': return row.note
        default: return ''
      }
    })
    await appendToGoogleSheets(CONTRACT_SHEET, line)
  }
  for (const r of rows) { await push(r) }
  return { success: true, count: rows.length }
}

export interface WarrantyQueryFilter {
  orderId?: string
  imei?: string
  serial?: string
  phone?: string
  status?: string // active | expired
  expiringDays?: number
}

export async function queryContracts(filter: WarrantyQueryFilter = {}) {
  const { header, rows } = await readFromGoogleSheets(CONTRACT_SHEET)
  const idx = (name: string) => header.indexOf(name)
  const C = {
    contractCode: idx('Mã HĐ'), orderId: idx('Mã Đơn'), imei: idx('IMEI'), serial: idx('Serial'), phone: idx('SĐT Khách'), pkg: idx('Mã Gói'),
    exchange: idx('Hạn 1 Đổi 1'), hw: idx('Hạn Phần Cứng'), cnc: idx('Hạn CNC/Độ Sim'), overall: idx('Hạn Tổng'), lifetime: idx('Hỗ Trợ Trọn Đời'), status: idx('Trạng Thái')
  }
  const today = new Date()
  const expDays = filter.expiringDays && filter.expiringDays > 0 ? filter.expiringDays : null
  const result = [] as any[]
  for (const r of rows) {
    const rec = {
      ma_hd: r[C.contractCode] || '',
      ma_don: r[C.orderId] || '',
      imei: r[C.imei] || '',
      serial: C.serial!==-1 ? (r[C.serial] || '') : '',
      sdt: r[C.phone] || '',
      ma_goi: r[C.pkg] || '',
      han_tong: r[C.overall] || '',
      trang_thai: r[C.status] || '',
    }
    if (filter.orderId && rec.ma_don !== filter.orderId) continue
    if (filter.imei && rec.imei !== filter.imei) continue
    if (filter.serial && rec.serial !== filter.serial) continue
    if (filter.phone && rec.sdt !== filter.phone) continue
    if (filter.status && rec.trang_thai !== filter.status) continue
    if (expDays) {
      const d = new Date(rec.han_tong)
      if (!rec.han_tong || Number.isNaN(d.getTime())) continue
      const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000)
      if (diff < 0 || diff > expDays) continue
      ;(rec as any).so_ngay_con_lai = diff
    }
    result.push(rec)
  }
  return result
}

// Load contracts with optional filters
export interface WarrantyContractFilter {
  orderId?: string
  imei?: string
  serial?: string
  phone?: string
  status?: string // active | expired
  expiringDays?: number
}

export async function loadWarrantyContracts(filter: WarrantyContractFilter = {}) {
  const { header, rows } = await readFromGoogleSheets(CONTRACT_SHEET)
  const idx = (name: string) => header.indexOf(name)
  const C = {
    maHd: idx('Mã HĐ'), maDon: idx('Mã Đơn'), imei: idx('IMEI'), serial: idx('Serial'), phone: idx('SĐT Khách'), maGoi: idx('Mã Gói'),
    hanDoi1: idx('Hạn 1 Đổi 1'), hw: idx('Hạn Phần Cứng'), cnc: idx('Hạn CNC/Độ Sim'), hanTong: idx('Hạn Tổng'),
    trangThai: idx('Trạng Thái'), lifetime: idx('Hỗ Trợ Trọn Đời')
  }
  const now = Date.now()
  const list = rows.map(r => {
    const overall = C.hanTong!==-1 && r[C.hanTong] ? new Date(r[C.hanTong]) : null
    const daysLeft = overall ? Math.ceil((overall.getTime() - now)/86400000) : null
    return {
      ma_hd: C.maHd!==-1? r[C.maHd]: '',
      ma_don: C.maDon!==-1? r[C.maDon]: '',
  imei: C.imei!==-1? r[C.imei]: '',
  serial: C.serial!==-1? r[C.serial]: '',
      sdt_khach: C.phone!==-1? r[C.phone]: '',
      ma_goi: C.maGoi!==-1? r[C.maGoi]: '',
      han_1doi1: C.hanDoi1!==-1? r[C.hanDoi1]: '',
      han_phan_cung: C.hw!==-1? r[C.hw]: '',
      han_cnc: C.cnc!==-1? r[C.cnc]: '',
      han_tong: C.hanTong!==-1? r[C.hanTong]: '',
      trang_thai: C.trangThai!==-1? (r[C.trangThai]||''): '',
      lifetime: C.lifetime!==-1? String(r[C.lifetime]||'').toLowerCase()==='true' : undefined,
      con_lai: daysLeft
    }
  })
  let filtered = list
  if (filter.orderId) filtered = filtered.filter(c => c.ma_don === filter.orderId)
  if (filter.imei) filtered = filtered.filter(c => c.imei === filter.imei)
  if (filter.serial) filtered = filtered.filter(c => c.serial === filter.serial)
  if (filter.phone) filtered = filtered.filter(c => c.sdt_khach === filter.phone)
  if (filter.status) filtered = filtered.filter(c => c.trang_thai === filter.status)
  if (typeof filter.expiringDays === 'number' && filter.expiringDays > 0) {
    const limit = filter.expiringDays
    filtered = filtered.filter(c => typeof c.con_lai === 'number' && c.con_lai > 0 && (c.con_lai as number) <= limit)
  }
  return filtered
}

// Cancel/update warranty contracts by IMEI list
export async function cancelContractsByIMEIs(
  imeis: string[],
  options?: { reason?: string; actor?: string }
) {
  function toColumnLetter(colNum: number) {
    let letter = ""
    while (colNum > 0) {
      const mod = (colNum - 1) % 26
      letter = String.fromCharCode(65 + mod) + letter
      colNum = Math.floor((colNum - mod) / 26)
    }
    return letter
  }
  if (!imeis || imeis.length === 0) return { success: true, updated: 0 }
  const { header, rows } = await readFromGoogleSheets(CONTRACT_SHEET)
  const idx = (name: string) => header.indexOf(name)
  const C = {
    imei: idx('IMEI'),
    status: idx('Trạng Thái'),
    note: idx('Ghi Chú')
  }
  if (C.imei === -1 || C.status === -1) return { success: false, error: 'Missing IMEI or Trạng Thái column' }
  const set = new Set(imeis.map(x => String(x)))
  let updated = 0
  const nowVN = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const im = r[C.imei]
    if (!im || !set.has(String(im))) continue
    const curStatus = r[C.status] || ''
    if (String(curStatus).toLowerCase() === 'canceled') continue
    const rowNum = i + 2
    // Update status
    await updateRangeValues(`${CONTRACT_SHEET}!${toColumnLetter(C.status + 1)}${rowNum}`, [[ 'canceled' ]])
    // Append note if possible
    if (C.note !== -1) {
      const extra = `Canceled${options?.reason ? `: ${options.reason}` : ''}${options?.actor ? ` (by ${options.actor})` : ''} @ ${nowVN}`
      const prev = r[C.note] || ''
      const merged = prev ? `${prev} | ${extra}` : extra
      await updateRangeValues(`${CONTRACT_SHEET}!${toColumnLetter(C.note + 1)}${rowNum}`, [[ merged ]])
    }
    updated++
  }
  return { success: true, updated }
}
