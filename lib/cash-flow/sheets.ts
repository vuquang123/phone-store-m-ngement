import { DateTime } from "luxon"
import { ensureSheetHeader, readFromGoogleSheets, appendToGoogleSheets, appendMultipleToGoogleSheets, batchUpdateRangeValues, updateRangeValues, syncToGoogleSheets, colIndex, norm } from "@/lib/google-sheets"
import { getCashBalance } from "@/lib/cash"
import { extractGhtkCode } from "@/lib/ghtk-status"
import { parseVietnameseNumber } from "@/lib/number"
import { generateCashFlowAiReport } from "@/services/ai/generate-cash-flow-report"
import type {
  AvailabilityStatus,
  CashAccount,
  CashFlowAiReport,
  CashFlowDashboardData,
  CashFlowDailyReport,
  CashFlowOverview,
  CashFlowPlanRow,
  CashFlowScenarioInput,
  DepositOrderSummary,
  InventoryItem,
  LedgerTransaction,
  LongTermDebt,
  Payable,
  PaymentSuggestion,
  ProfitFundEntry,
  PriorityLevel,
  Receivable,
} from "./types"

const SHEETS = {
  ACCOUNTS: "DongTien_NguonTien",
  RECEIVABLES: "DongTien_CongNoThu",
  PAYABLES: "DongTien_PhaiTra",
  TRANSACTIONS: "DongTien_GiaoDich",
  PROFIT_FUND: "DongTien_QuyLai",
  LONG_TERM_DEBTS: "DongTien_NoDaiHan",
  SETTINGS: "DongTien_CaiDat",
  REPORTS: "DongTien_BaoCao",
  BAN_HANG: "Ban_Hang",
  KHO_HANG: "Kho_Hang",
  DAT_COC: "Dat_Coc",
} as const

const ACCOUNT_HEADER = [
  "ID",
  "Tên Nguồn",
  "Loại Nguồn",
  "Số Dư",
  "Trạng Thái Khả Dụng",
  "Ngày Cập Nhật",
  "Ghi Chú",
  "Tự Động",
  "Created At",
  "Updated At",
]

const RECEIVABLE_HEADER = [
  "ID",
  "Đối Tượng",
  "Số Điện Thoại",
  "Nội Dung",
  "Tổng Phải Thu",
  "Đã Thu",
  "Ngày Phát Sinh",
  "Ngày Hẹn Thanh Toán",
  "Khả Năng Thu",
  "Trạng Thái",
  "Tài Khoản Nhận ID",
  "Auto Ref Type",
  "Auto Ref ID",
  "Ghi Chú",
  "Created At",
  "Updated At",
]

const PAYABLE_HEADER = [
  "ID",
  "Chủ Nợ",
  "Loại Nợ",
  "Nội Dung",
  "Số Tiền Gốc",
  "Đã Thanh Toán",
  "Ngày Phát Sinh",
  "Hạn Thanh Toán",
  "Mức Độ Ưu Tiên",
  "Trạng Thái",
  "Có Tính Lãi",
  "Kiểu Lãi",
  "Giá Trị Lãi",
  "Ngày Bắt Đầu Tính Lãi",
  "Ghi Chú",
  "Auto Ref Type",
  "Auto Ref ID",
  "Created At",
  "Updated At",
]

const TRANSACTION_HEADER = [
  "ID",
  "Loại Giao Dịch",
  "Số Tiền",
  "Ngày Giao Dịch",
  "Tài Khoản ID",
  "Tên Tài Khoản",
  "Ref Loại",
  "Ref ID",
  "Đối Tượng",
  "Nguồn",
  "Ghi Chú",
  "Tự Động",
  "Created By",
  "Created At",
]

const PROFIT_FUND_HEADER = [
  "ID",
  "Ngày",
  "Số Tiền",
  "Loại",
  "Ref Loại",
  "Ref ID",
  "ID Đơn Hàng",
  "Đối Tượng",
  "Ghi Chú",
  "Tự Động",
  "Created By",
  "Created At",
]

const LONG_TERM_DEBT_HEADER = [
  "ID",
  "Chủ Nợ",
  "Nội Dung",
  "Số Tiền Gốc",
  "Đã Thanh Toán",
  "Ngày Phát Sinh",
  "Hạn Thanh Toán",
  "Mức Độ Ưu Tiên",
  "Trạng Thái",
  "Ghi Chú",
  "Created At",
  "Updated At",
]

const SETTINGS_HEADER = [
  "Khóa",
  "Giá Trị",
  "Ghi Chú",
  "Updated At",
]

const REPORTS_HEADER = [
  "Slug",
  "Ngày Báo Cáo",
  "Generated At",
  "Tiêu Đề",
  "Tóm Tắt",
  "Highlights Json",
  "Warnings Json",
  "Cash Actions Json",
  "Inventory Actions Json",
  "Debt Actions Json",
  "AI Model",
  "AI Error",
  "AI Report Json",
  "Data Json",
  "Updated At",
]

const SETTING_KEYS = {
  SAFE_RESERVE: "safe_reserve",
  RESET_ORDER_SEQ: "reset_order_seq",
} as const

const AUTO_REPORT_HOUR = 18
const DEFAULT_SAFE_RESERVE = 20000000
const PROFIT_TRACKING_START = "2026-07-16"

function nowIso() {
  return DateTime.now().setZone("Asia/Ho_Chi_Minh").toISO() || new Date().toISOString()
}

function todayYmd() {
  return DateTime.now().setZone("Asia/Ho_Chi_Minh").toFormat("yyyy-MM-dd")
}

function formatReportSlug(date: string) {
  const dt = DateTime.fromISO(date, { zone: "Asia/Ho_Chi_Minh" })
  if (!dt.isValid) return `bao-cao-${date}`
  return `bao-cao-${dt.toFormat("ddLLLyyyy")}`
}

function parseReportSlug(slug: string) {
  const match = String(slug || "").trim().match(/^bao-cao-(\d{2})([A-Za-z]{3})(\d{4})$/)
  if (!match) return null
  const dt = DateTime.fromFormat(`${match[1]}${match[2]}${match[3]}`, "ddLLLyyyy", {
    locale: "en",
    zone: "Asia/Ho_Chi_Minh",
  })
  return dt.isValid ? dt.toFormat("yyyy-MM-dd") : null
}

function toNumber(v: any): number {
  return parseVietnameseNumber(v)
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function parseBool(v: any) {
  return ["true", "1", "yes", "y", "co", "có"].includes(String(v || "").trim().toLowerCase())
}

function startOfDay(date: string) {
  return DateTime.fromISO(date, { zone: "Asia/Ho_Chi_Minh" }).startOf("day").toMillis()
}

function daysUntil(date: string) {
  const now = DateTime.fromISO(todayYmd(), { zone: "Asia/Ho_Chi_Minh" }).startOf("day").toMillis()
  return Math.floor((startOfDay(date) - now) / 86400000)
}

export async function ensureCashFlowSheets() {
  await ensureSheetHeader(SHEETS.ACCOUNTS, ACCOUNT_HEADER)
  await ensureSheetHeader(SHEETS.RECEIVABLES, RECEIVABLE_HEADER)
  await ensureSheetHeader(SHEETS.PAYABLES, PAYABLE_HEADER)
  await ensureSheetHeader(SHEETS.TRANSACTIONS, TRANSACTION_HEADER)
  await ensureSheetHeader(SHEETS.PROFIT_FUND, PROFIT_FUND_HEADER)
  await ensureSheetHeader(SHEETS.LONG_TERM_DEBTS, LONG_TERM_DEBT_HEADER)
  await ensureSheetHeader(SHEETS.SETTINGS, SETTINGS_HEADER)
  await ensureSheetHeader(SHEETS.REPORTS, REPORTS_HEADER)

  const accounts = await readFromGoogleSheets(SHEETS.ACCOUNTS, undefined, { force: true })
  if (!accounts.rows.length) {
    const seedRows = [
      ["acc_cash", "Tiền mặt", "cash", 57120000, "AVAILABLE", todayYmd(), "Khởi tạo ban đầu", "false", nowIso(), nowIso()],
      ["acc_bank", "Tiền tài khoản", "bank", 200000000, "AVAILABLE", todayYmd(), "Khởi tạo ban đầu", "false", nowIso(), nowIso()],
    ]
    await appendMultipleToGoogleSheets(SHEETS.ACCOUNTS, seedRows)
  }

  const settings = await readFromGoogleSheets(SHEETS.SETTINGS, undefined, { force: true })
  if (!settings.rows.length) {
    await appendToGoogleSheets(SHEETS.SETTINGS, [SETTING_KEYS.SAFE_RESERVE, DEFAULT_SAFE_RESERVE, "Quỹ tiền mặt an toàn mặc định", nowIso()])
  }
}

async function readAccounts(): Promise<CashAccount[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.ACCOUNTS, undefined, { force: true })
  return rows
    .filter((row) => String(row[0] || "").trim())
    .map((row) => ({
      id: String(row[colIndex(header, "ID")] || ""),
      name: String(row[colIndex(header, "Tên Nguồn")] || ""),
      type: String(row[colIndex(header, "Loại Nguồn")] || "other") as any,
      balance: toNumber(row[colIndex(header, "Số Dư")]),
      updatedAt: String(row[colIndex(header, "Ngày Cập Nhật")] || ""),
      availability: (String(row[colIndex(header, "Trạng Thái Khả Dụng")] || "AVAILABLE") as AvailabilityStatus),
      note: String(row[colIndex(header, "Ghi Chú")] || ""),
    }))
}

function findAccountById(accounts: CashAccount[], accountId: string) {
  return accounts.find((item) => item.id === accountId)
}

async function readReceivables(): Promise<Receivable[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.RECEIVABLES, undefined, { force: true })
  const mapped = rows
    .filter((row) => String(row[0] || "").trim())
    .map((row) => ({
      id: String(row[colIndex(header, "ID")] || ""),
      counterparty: String(row[colIndex(header, "Đối Tượng")] || ""),
      phone: String(row[colIndex(header, "Số Điện Thoại")] || ""),
      description: String(row[colIndex(header, "Nội Dung")] || ""),
      totalAmount: toNumber(row[colIndex(header, "Tổng Phải Thu")]),
      collectedAmount: toNumber(row[colIndex(header, "Đã Thu")]),
      incurredAt: String(row[colIndex(header, "Ngày Phát Sinh")] || ""),
      dueDate: String(row[colIndex(header, "Ngày Hẹn Thanh Toán")] || ""),
      collectability: (String(row[colIndex(header, "Khả Năng Thu")] || "medium") as any),
      status: String(row[colIndex(header, "Trạng Thái")] || "NOT_DUE") as any,
      accountId: String(row[colIndex(header, "Tài Khoản Nhận ID")] || ""),
      autoRefType: String(row[colIndex(header, "Auto Ref Type")] || ""),
      autoRefId: String(row[colIndex(header, "Auto Ref ID")] || ""),
      note: String(row[colIndex(header, "Ghi Chú")] || ""),
      createdAt: String(row[colIndex(header, "Created At")] || ""),
      updatedAt: String(row[colIndex(header, "Updated At")] || ""),
    }))

  const deduped = new Map<string, Receivable>()
  const result: Receivable[] = []

  for (const item of mapped) {
    const key = item.autoRefType && item.autoRefId ? `${item.autoRefType}::${item.autoRefId}` : ""
    if (!key) {
      result.push(item)
      continue
    }

    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, item)
      continue
    }

    const existingRemaining = Math.max(0, existing.totalAmount - existing.collectedAmount)
    const itemRemaining = Math.max(0, item.totalAmount - item.collectedAmount)
    const existingTime = new Date(existing.updatedAt || existing.createdAt || existing.incurredAt || 0).getTime() || 0
    const itemTime = new Date(item.updatedAt || item.createdAt || item.incurredAt || 0).getTime() || 0

    const shouldReplace =
      item.collectedAmount > existing.collectedAmount ||
      (item.collectedAmount === existing.collectedAmount && itemRemaining < existingRemaining) ||
      (item.collectedAmount === existing.collectedAmount && itemRemaining === existingRemaining && itemTime >= existingTime)

    if (shouldReplace) {
      deduped.set(key, item)
    }
  }

  return [...result, ...deduped.values()]
}

async function readPayables(): Promise<Payable[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.PAYABLES, undefined, { force: true })
  return rows
    .filter((row) => String(row[0] || "").trim())
    .map((row) => ({
      id: String(row[colIndex(header, "ID")] || ""),
      creditor: String(row[colIndex(header, "Chủ Nợ")] || ""),
      type: String(row[colIndex(header, "Loại Nợ")] || "other") as any,
      description: String(row[colIndex(header, "Nội Dung")] || ""),
      principalAmount: toNumber(row[colIndex(header, "Số Tiền Gốc")]),
      paidAmount: toNumber(row[colIndex(header, "Đã Thanh Toán")]),
      incurredAt: String(row[colIndex(header, "Ngày Phát Sinh")] || ""),
      dueDate: String(row[colIndex(header, "Hạn Thanh Toán")] || ""),
      priority: String(row[colIndex(header, "Mức Độ Ưu Tiên")] || "medium") as PriorityLevel,
      status: String(row[colIndex(header, "Trạng Thái")] || "NOT_DUE") as any,
      hasInterest: parseBool(row[colIndex(header, "Có Tính Lãi")]),
      interestMode: String(row[colIndex(header, "Kiểu Lãi")] || "") as any,
      interestValue: toNumber(row[colIndex(header, "Giá Trị Lãi")]),
      interestStartAt: String(row[colIndex(header, "Ngày Bắt Đầu Tính Lãi")] || ""),
      note: String(row[colIndex(header, "Ghi Chú")] || ""),
    }))
}

async function readTransactions(): Promise<LedgerTransaction[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.TRANSACTIONS, undefined, { force: true })
  return rows
    .filter((row) => String(row[0] || "").trim())
    .map((row) => ({
      id: String(row[colIndex(header, "ID")] || ""),
      type: String(row[colIndex(header, "Loại Giao Dịch")] || ""),
      amount: toNumber(row[colIndex(header, "Số Tiền")]),
      occurredAt: String(row[colIndex(header, "Ngày Giao Dịch")] || ""),
      accountId: String(row[colIndex(header, "Tài Khoản ID")] || ""),
      accountName: String(row[colIndex(header, "Tên Tài Khoản")] || ""),
      refType: String(row[colIndex(header, "Ref Loại")] || ""),
      refId: String(row[colIndex(header, "Ref ID")] || ""),
      counterparty: String(row[colIndex(header, "Đối Tượng")] || ""),
      source: String(row[colIndex(header, "Nguồn")] || ""),
      note: String(row[colIndex(header, "Ghi Chú")] || ""),
      automatic: parseBool(row[colIndex(header, "Tự Động")]),
      createdBy: String(row[colIndex(header, "Created By")] || ""),
      createdAt: String(row[colIndex(header, "Created At")] || ""),
    }))
}

async function readProfitFundEntries(): Promise<ProfitFundEntry[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.PROFIT_FUND, undefined, { force: true })
  return rows
    .filter((row) => String(row[0] || "").trim())
    .map((row) => ({
      id: String(row[colIndex(header, "ID")] || ""),
      date: String(row[colIndex(header, "Ngày")] || ""),
      amount: toNumber(row[colIndex(header, "Số Tiền")]),
      type: String(row[colIndex(header, "Loại")] || "sale_profit") as ProfitFundEntry["type"],
      refType: String(row[colIndex(header, "Ref Loại")] || ""),
      refId: String(row[colIndex(header, "Ref ID")] || ""),
      orderId: String(row[colIndex(header, "ID Đơn Hàng")] || ""),
      counterparty: String(row[colIndex(header, "Đối Tượng")] || ""),
      note: String(row[colIndex(header, "Ghi Chú")] || ""),
      automatic: parseBool(row[colIndex(header, "Tự Động")]),
      createdBy: String(row[colIndex(header, "Created By")] || ""),
      createdAt: String(row[colIndex(header, "Created At")] || ""),
    }))
}

async function readLongTermDebts(): Promise<LongTermDebt[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.LONG_TERM_DEBTS, undefined, { force: true })
  return rows
    .filter((row) => String(row[0] || "").trim())
    .map((row) => ({
      id: String(row[colIndex(header, "ID")] || ""),
      creditor: String(row[colIndex(header, "Chủ Nợ")] || ""),
      description: String(row[colIndex(header, "Nội Dung")] || ""),
      principalAmount: toNumber(row[colIndex(header, "Số Tiền Gốc")]),
      paidAmount: toNumber(row[colIndex(header, "Đã Thanh Toán")]),
      incurredAt: String(row[colIndex(header, "Ngày Phát Sinh")] || ""),
      dueDate: String(row[colIndex(header, "Hạn Thanh Toán")] || ""),
      priority: String(row[colIndex(header, "Mức Độ Ưu Tiên")] || "medium") as PriorityLevel,
      status: String(row[colIndex(header, "Trạng Thái")] || "OPEN") as LongTermDebt["status"],
      note: String(row[colIndex(header, "Ghi Chú")] || ""),
    }))
}

async function readActiveDepositOrders(): Promise<DepositOrderSummary[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.DAT_COC, undefined, { force: true })
  const idxOrderId = colIndex(header, "ID Đơn Hàng", "Mã Đơn Hàng")
  const idxCustomer = colIndex(header, "Tên Khách Hàng")
  const idxPhone = colIndex(header, "Số Điện Thoại")
  const idxStatus = colIndex(header, "Trạng Thái")
  const idxDepositDate = colIndex(header, "Ngày Đặt Cọc")
  const idxDueDate = colIndex(header, "Hạn Thanh Toán")
  const idxDeposit = colIndex(header, "Số Tiền Cọc")
  const idxRemaining = colIndex(header, "Số Tiền Còn Lại", "Còn Lại")
  const idxNote = colIndex(header, "Ghi Chú")
  const idxModel = colIndex(header, "Tên Sản Phẩm")
  const idxCapacity = colIndex(header, "Dung Lượng")
  const idxColor = colIndex(header, "Màu Sắc")
  const idxImei = colIndex(header, "IMEI")
  const idxSerial = colIndex(header, "Serial")
  const idxCondition = colIndex(header, "Tình Trạng Máy")
  const idxCost = colIndex(header, "Giá Nhập")
  const idxSale = colIndex(header, "Giá Bán")

  const groups = new Map<string, DepositOrderSummary>()
  const seenDevices = new Set<string>()
  for (const row of rows) {
    const orderId = String((idxOrderId !== -1 ? row[idxOrderId] : "") || "").trim()
    if (!orderId) continue
    const status = String((idxStatus !== -1 ? row[idxStatus] : "") || "").trim()
    const normalizedStatus = norm(status)
    if (normalizedStatus === "huy_dat_coc" || normalizedStatus === "da_thanh_toan" || normalizedStatus === "da_tat_toan") continue
    // Bỏ dòng trùng máy trong cùng đơn (dữ liệu "ma" do lỗi ghi đè sheet cũ) — tránh cộng đôi giá nhập.
    const deviceKey =
      String((idxImei !== -1 ? row[idxImei] : "") || "").trim() ||
      String((idxSerial !== -1 ? row[idxSerial] : "") || "").trim()
    if (deviceKey) {
      const dedupeKey = `${orderId}::${deviceKey}`
      if (seenDevices.has(dedupeKey)) continue
      seenDevices.add(dedupeKey)
    }
    const existing = groups.get(orderId) || {
      id: orderId,
      customer: String((idxCustomer !== -1 ? row[idxCustomer] : "") || "Khách lẻ"),
      phone: String((idxPhone !== -1 ? row[idxPhone] : "") || ""),
      status: status || "Đặt cọc",
      depositDate: toSheetDateVN(String((idxDepositDate !== -1 ? row[idxDepositDate] : "") || todayYmd())),
      dueDate: String((idxDueDate !== -1 ? row[idxDueDate] : "") || ""),
      depositAmount: toNumber(idxDeposit !== -1 ? row[idxDeposit] : 0),
      remainingAmount: toNumber(idxRemaining !== -1 ? row[idxRemaining] : 0),
      inventoryValue: 0,
      saleValue: 0,
      note: String((idxNote !== -1 ? row[idxNote] : "") || ""),
      products: [],
    }
    const product = {
      model: String((idxModel !== -1 ? row[idxModel] : "") || ""),
      capacity: String((idxCapacity !== -1 ? row[idxCapacity] : "") || ""),
      color: String((idxColor !== -1 ? row[idxColor] : "") || ""),
      imei: String((idxImei !== -1 ? row[idxImei] : "") || ""),
      serial: String((idxSerial !== -1 ? row[idxSerial] : "") || ""),
      condition: String((idxCondition !== -1 ? row[idxCondition] : "") || ""),
      costPrice: toNumber(idxCost !== -1 ? row[idxCost] : 0),
      salePrice: toNumber(idxSale !== -1 ? row[idxSale] : 0),
    }
    existing.inventoryValue += product.costPrice
    existing.saleValue += product.salePrice
    if (product.model || product.imei || product.serial) {
      existing.products.push(product)
    }
    groups.set(orderId, existing)
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aTime = new Date(a.depositDate || 0).getTime()
    const bTime = new Date(b.depositDate || 0).getTime()
    return bTime - aTime
  })
}

function buildProfitFundRow(input: {
  date: string
  amount: number
  type: ProfitFundEntry["type"]
  refType: string
  refId: string
  orderId?: string
  counterparty?: string
  note?: string
  automatic?: boolean
  createdBy?: string
}) {
  return [
    genId("profit"),
    input.date,
    input.amount,
    input.type,
    input.refType,
    input.refId,
    input.orderId || "",
    input.counterparty || "",
    input.note || "",
    input.automatic ? "true" : "false",
    input.createdBy || "system",
    nowIso(),
  ]
}

function buildLongTermDebtRow(input: {
  creditor: string
  description: string
  principalAmount: number
  dueDate: string
  priority?: string
  note?: string
}) {
  return [
    genId("ltd"),
    input.creditor,
    input.description,
    input.principalAmount,
    0,
    todayYmd(),
    input.dueDate,
    input.priority || "medium",
    "OPEN",
    input.note || "",
    nowIso(),
    nowIso(),
  ]
}

async function readSafeReserve() {
  const { header, rows } = await readFromGoogleSheets(SHEETS.SETTINGS)
  const idxKey = colIndex(header, "Khóa")
  const idxValue = colIndex(header, "Giá Trị")
  const found = rows.find((row) => String(row[idxKey] || "") === SETTING_KEYS.SAFE_RESERVE)
  return found ? toNumber(found[idxValue]) : DEFAULT_SAFE_RESERVE
}

async function readSettingValue(key: string) {
  const { header, rows } = await readFromGoogleSheets(SHEETS.SETTINGS)
  const idxKey = colIndex(header, "Khóa")
  const idxValue = colIndex(header, "Giá Trị")
  const found = rows.find((row) => String(row[idxKey] || "") === key)
  return found ? String(found[idxValue] || "") : ""
}

async function upsertSettingRows(items: Array<{ key: string; value: any; note?: string }>) {
  const { header, rows } = await readFromGoogleSheets(SHEETS.SETTINGS, undefined, { force: true })
  const idxKey = colIndex(header, "Khóa")
  const idxValue = colIndex(header, "Giá Trị")
  const idxNote = colIndex(header, "Ghi Chú")
  const idxUpdated = colIndex(header, "Updated At")
  const nextRows = [...rows]

  for (const item of items) {
    const rowIndex = nextRows.findIndex((row) => String(row[idxKey] || "") === item.key)
    if (rowIndex === -1) {
      const row = Array(header.length).fill("")
      if (idxKey !== -1) row[idxKey] = item.key
      if (idxValue !== -1) row[idxValue] = item.value
      if (idxNote !== -1) row[idxNote] = item.note || ""
      if (idxUpdated !== -1) row[idxUpdated] = nowIso()
      nextRows.push(row)
      continue
    }
    const row = [...nextRows[rowIndex]]
    if (idxValue !== -1) row[idxValue] = item.value
    if (idxNote !== -1) row[idxNote] = item.note || row[idxNote] || ""
    if (idxUpdated !== -1) row[idxUpdated] = nowIso()
    nextRows[rowIndex] = row
  }

  await syncToGoogleSheets(SHEETS.SETTINGS, nextRows)
}

function getOrderSequence(orderId: string) {
  const match = String(orderId || "").match(/(\d+)/)
  return match ? Number(match[1]) || 0 : 0
}

async function readResetOrderSeq() {
  return toNumber(await readSettingValue(SETTING_KEYS.RESET_ORDER_SEQ))
}

function shouldSyncOrder(orderId: string, resetSeq: number) {
  if (!resetSeq) return true
  return getOrderSequence(orderId) > resetSeq
}

function findPreferredAccount(accounts: CashAccount[], kind: "cash" | "bank") {
  const exact = accounts.find((item) => item.type === kind && item.availability === "AVAILABLE")
  if (exact) return exact
  const byName = accounts.find((item) =>
    item.availability === "AVAILABLE" &&
    (kind === "cash"
      ? norm(item.name).includes("tien_mat")
      : norm(item.name).includes("tai_khoan") || norm(item.name).includes("ngan_hang")),
  )
  return byName || accounts.find((item) => item.availability === "AVAILABLE") || accounts[0]
}

function parsePaymentSummary(summary: string) {
  const normalized = String(summary || "")
  const parseAmount = (segment: string) => toNumber(segment)
  const segments = normalized.split("|").map((item) => item.trim()).filter(Boolean)
  let cash = 0
  let transfer = 0
  let card = 0
  let cod = 0
  let installmentLoan = 0
  for (const segment of segments) {
    const n = norm(segment)
    if (n.includes("tien_mat")) cash += parseAmount(segment)
    else if (n.includes("chuyen_khoan")) transfer += parseAmount(segment)
    else if (n.includes("the")) card += parseAmount(segment)
    else if (n.includes("cod")) cod += parseAmount(segment)
    else if (n.includes("tra_gop")) {
      const m = segment.match(/gop[^0-9]*(\d[\d.,]*)/i)
      if (m) installmentLoan += toNumber(m[1])
    }
  }
  return { cash, transfer, card, cod, installmentLoan }
}

function getStoredGhtkStatusLabel(shipping: string) {
  const match = String(shipping || "").match(/GHTK\s*[-–]\s*\S+\s*[-–]\s*(.+)$/i)
  return match ? match[1].trim() : ""
}

function parseGhtkMetaNote(note: string, code: string) {
  const safeCode = String(code || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = String(note || "").match(new RegExp(`\\[GHTK_META:${safeCode}:COD=(\\d+):SHIP=(\\d+)\\]`))
  if (!match) return null
  return {
    codMoney: toNumber(match[1]),
    shipMoney: toNumber(match[2]),
  }
}

type GhtkCodSummary = {
  pending3Days: number
  reconciledInCash: number
  pendingOrders: number
  reconciledOrders: number
}

function resolveStoredGhtkCod(row: any[], indexes: {
  ship: number
  note: number
  payment: number
}) {
  const shipping = String(row[indexes.ship] || "")
  const paymentSummary = String(row[indexes.payment] || "")
  const code = extractGhtkCode(shipping, String(row[indexes.note] || ""))
  if (!code) return null
  const statusLabel = getStoredGhtkStatusLabel(shipping)
  const meta = parseGhtkMetaNote(String(row[indexes.note] || ""), code)
  const payment = parsePaymentSummary(paymentSummary)
  const codAmount = Math.max(0, meta?.codMoney ?? payment.cod)
  if (codAmount <= 0) return null
  return {
    code,
    statusLabel,
    codAmount,
    isReconciled: norm(statusLabel) === norm("Đã đối soát"),
  }
}

async function readGhtkCodSummaryFromSales(): Promise<GhtkCodSummary> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.BAN_HANG, undefined, { force: true })
  const idxId = colIndex(header, "ID Đơn Hàng")
  const idxShip = colIndex(header, "Hình Thức Vận Chuyển")
  const idxNote = colIndex(header, "Ghi Chú")
  const idxPayment = colIndex(header, "Hình Thức Thanh Toán")
  const grouped = new Map<string, string[]>()

  for (const row of rows) {
    const orderId = String(row[idxId] || "").trim()
    if (!orderId) continue
    if (!grouped.has(orderId)) grouped.set(orderId, row)
  }

  let pending3Days = 0
  let reconciledInCash = 0
  let pendingOrders = 0
  let reconciledOrders = 0

  for (const row of grouped.values()) {
    const codInfo = resolveStoredGhtkCod(row, {
      ship: idxShip,
      note: idxNote,
      payment: idxPayment,
    })
    if (!codInfo) continue
    if (codInfo.isReconciled) {
      reconciledInCash += codInfo.codAmount
      reconciledOrders += 1
      continue
    }
    pending3Days += codInfo.codAmount
    pendingOrders += 1
  }

  return {
    pending3Days,
    reconciledInCash,
    pendingOrders,
    reconciledOrders,
  }
}

function remainingReceivable(item: Receivable) {
  return Math.max(0, item.totalAmount - item.collectedAmount)
}

function remainingPayable(item: Payable) {
  return Math.max(0, item.principalAmount - item.paidAmount)
}

function statusForReceivable(item: Receivable) {
  const remaining = remainingReceivable(item)
  if (remaining <= 0) return "COLLECTED"
  // Quá hạn/đến hạn phải thắng "đã thu một phần", nếu không khoản thu dở
  // sẽ biến mất khỏi các bucket đến hạn và cảnh báo thiếu hụt.
  const distance = daysUntil(item.dueDate)
  if (distance < 0) return "OVERDUE"
  if (distance === 0) return "DUE_TODAY"
  if (item.collectedAmount > 0) return "PARTIALLY_COLLECTED"
  return "NOT_DUE"
}

function setReceivableStatusValue(item: Receivable) {
  return statusForReceivable(item)
}

function statusForPayable(item: Payable) {
  const remaining = remainingPayable(item)
  if (remaining <= 0) return "PAID"
  const distance = daysUntil(item.dueDate)
  if (distance < 0) return "OVERDUE"
  if (distance === 0) return "DUE_TODAY"
  if (item.paidAmount > 0) return "PARTIALLY_PAID"
  return "NOT_DUE"
}

function setPayableStatusValue(item: Payable) {
  return statusForPayable(item)
}

function toSheetDateVN(raw: string) {
  const formats = ["d/M/yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "yyyy/MM/dd", "HH:mm:ss dd/MM/yyyy"]
  for (const f of formats) {
    const dt = DateTime.fromFormat(raw, f, { zone: "Asia/Ho_Chi_Minh" })
    if (dt.isValid) return dt.toFormat("yyyy-MM-dd")
  }
  const iso = DateTime.fromISO(raw, { zone: "Asia/Ho_Chi_Minh" })
  if (iso.isValid) return iso.toFormat("yyyy-MM-dd")
  return todayYmd()
}

function statusForLongTermDebt(item: LongTermDebt): LongTermDebt["status"] {
  const remaining = Math.max(0, item.principalAmount - item.paidAmount)
  if (remaining <= 0) return "PAID"
  if (item.paidAmount > 0) return "PARTIALLY_PAID"
  return "OPEN"
}

function profitFundColLetter(index: number) {
  let colNum = index + 1
  let letter = ""
  while (colNum > 0) {
    const mod = (colNum - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    colNum = Math.floor((colNum - mod) / 26)
  }
  return letter
}

// Lãi của một đơn có thể thay đổi sau khi bán (ví dụ lúc xuất chưa điền giá nhập,
// sau đó mới cập nhật). Vì vậy ngoài việc thêm đơn mới, hàm này còn ghi đè lại
// số tiền của các dòng lãi tự động đã có nếu cột "Lãi" bên Ban_Hang đã đổi.
async function syncProfitFundFromSales() {
  const { header: fundHeader, rows: fundRows } = await readFromGoogleSheets(SHEETS.PROFIT_FUND, undefined, { force: true })
  const idxFundType = colIndex(fundHeader, "Loại")
  const idxFundRefType = colIndex(fundHeader, "Ref Loại")
  const idxFundRefId = colIndex(fundHeader, "Ref ID")
  const idxFundAmount = colIndex(fundHeader, "Số Tiền")
  if (idxFundRefId === -1 || idxFundAmount === -1) return

  // refId -> dòng lãi tự động đầu tiên (số dòng thật trên sheet, đã tính header)
  const existingSaleRows = new Map<string, { rowNumber: number; amount: number }>()
  fundRows.forEach((row, index) => {
    if (!String(row[0] || "").trim()) return
    const type = String(row[idxFundType] || "").trim()
    const refType = idxFundRefType === -1 ? "" : String(row[idxFundRefType] || "").trim()
    if (type !== "sale_profit" && refType !== "sale_profit") return
    const refId = String(row[idxFundRefId] || "").trim()
    if (!refId || existingSaleRows.has(refId)) return
    existingSaleRows.set(refId, { rowNumber: index + 2, amount: toNumber(row[idxFundAmount]) })
  })

  const { header, rows } = await readFromGoogleSheets(SHEETS.BAN_HANG, undefined, { force: true })
  const idxId = colIndex(header, "ID Đơn Hàng")
  const idxDate = colIndex(header, "Ngày Bán", "Ngày Xuất")
  const idxCustomer = colIndex(header, "Tên Khách Hàng")
  const idxProfit = colIndex(header, "Lãi")
  if (idxId === -1 || idxDate === -1 || idxProfit === -1) return

  const grouped = new Map<string, { date: string; customer: string; profit: number }>()
  for (const row of rows) {
    const orderId = String(row[idxId] || "").trim()
    if (!orderId) continue
    const orderDate = toSheetDateVN(String(row[idxDate] || todayYmd()))
    if (orderDate < PROFIT_TRACKING_START) continue
    const current = grouped.get(orderId) || {
      date: orderDate,
      customer: String(row[idxCustomer] || "Khách lẻ"),
      profit: 0,
    }
    current.profit += toNumber(row[idxProfit])
    grouped.set(orderId, current)
  }

  const amountCol = profitFundColLetter(idxFundAmount)
  const rowsToAppend: any[][] = []
  const updates: Array<{ range: string; values: any[][] }> = []
  for (const [orderId, item] of grouped.entries()) {
    const refType = "sale_profit"
    const refId = orderId
    const profit = Number.isFinite(item.profit) ? item.profit : 0
    const existing = existingSaleRows.get(refId)
    if (existing) {
      // Chênh dưới 1 đồng coi như không đổi (tránh ghi lại vì sai số làm tròn).
      if (Math.abs(existing.amount - profit) >= 1) {
        updates.push({ range: `'${SHEETS.PROFIT_FUND}'!${amountCol}${existing.rowNumber}`, values: [[profit]] })
      }
      continue
    }
    if (profit === 0) continue
    rowsToAppend.push(buildProfitFundRow({
      date: item.date,
      amount: profit,
      type: "sale_profit",
      refType,
      refId,
      orderId,
      counterparty: item.customer,
      note: `Lãi đơn ${orderId}`,
      automatic: true,
      createdBy: "system",
    }))
  }

  if (updates.length) {
    await batchUpdateRangeValues(updates)
  }

  if (rowsToAppend.length) {
    await appendMultipleToGoogleSheets(SHEETS.PROFIT_FUND, rowsToAppend)
  }
}

async function applyAccountDeltas(accountDeltas: Map<string, number>) {
  if (!accountDeltas.size) return
  const { header, rows } = await readFromGoogleSheets(SHEETS.ACCOUNTS, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const idxBalance = colIndex(header, "Số Dư")
  const updates: Array<{ range: string; values: any[][] }> = []
  for (const [accountId, delta] of accountDeltas.entries()) {
    const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === accountId)
    if (rowIndex === -1) continue
    const rowNumber = rowIndex + 2
    const current = toNumber(rows[rowIndex][idxBalance])
    updates.push(
      { range: `'${SHEETS.ACCOUNTS}'!D${rowNumber}`, values: [[current + delta]] },
      { range: `'${SHEETS.ACCOUNTS}'!J${rowNumber}`, values: [[nowIso()]] },
      { range: `'${SHEETS.ACCOUNTS}'!F${rowNumber}`, values: [[todayYmd()]] },
    )
  }
  if (updates.length) await batchUpdateRangeValues(updates)
}

function buildTransactionRow(tx: Omit<LedgerTransaction, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  const id = tx.id || genId("cftx")
  const createdAt = tx.createdAt || nowIso()
  return [
    id,
    tx.type,
    tx.amount,
    tx.occurredAt,
    tx.accountId,
    tx.accountName,
    tx.refType,
    tx.refId,
    tx.counterparty,
    tx.source,
    tx.note,
    tx.automatic ? "true" : "false",
    tx.createdBy,
    createdAt,
  ]
}

function buildReceivableRow(input: {
  counterparty: string
  phone?: string
  description: string
  totalAmount: number
  dueDate: string
  collectability?: string
  note?: string
  accountId?: string
  autoRefType?: string
  autoRefId?: string
}) {
  const remaining = input.totalAmount
  const status = daysUntil(input.dueDate) === 0 ? "DUE_TODAY" : "NOT_DUE"
  return [
    genId("recv"),
    input.counterparty,
    input.phone || "",
    input.description,
    input.totalAmount,
    0,
    todayYmd(),
    input.dueDate,
    input.collectability || "medium",
    status,
    input.accountId || "",
    input.autoRefType || "",
    input.autoRefId || "",
    input.note || `Còn phải thu ${remaining.toLocaleString("vi-VN")} ₫`,
    nowIso(),
    nowIso(),
  ]
}

async function syncOrdersIntoCashFlow(accounts: CashAccount[]) {
  const resetSeq = await readResetOrderSeq()
  const existingTx = await readTransactions()
  const existingRecv = await readReceivables()
  const txRefSet = new Set(existingTx.map((item) => `${item.refType}::${item.refId}`))
  const recvRefSet = new Set(
    existingRecv
      .filter((item) => item.autoRefType && item.autoRefId)
      .map((item) => `${item.autoRefType}::${item.autoRefId}`),
  )
  const cashAccount = findPreferredAccount(accounts, "cash")
  const bankAccount = findPreferredAccount(accounts, "bank")
  if (!cashAccount || !bankAccount) return
  const transactionRows: any[][] = []
  const receivableRows: any[][] = []
  const accountDeltas = new Map<string, number>()
  const addAccountDelta = (accountId: string, amount: number) => {
    accountDeltas.set(accountId, (accountDeltas.get(accountId) || 0) + amount)
  }

  const { header, rows } = await readFromGoogleSheets(SHEETS.BAN_HANG, undefined, { force: true })
  const idxId = colIndex(header, "ID Đơn Hàng")
  const idxDate = colIndex(header, "Ngày Bán", "Ngày Xuất")
  const idxCustomer = colIndex(header, "Tên Khách Hàng")
  const idxPayment = colIndex(header, "Hình Thức Thanh Toán")

  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const orderId = String(row[idxId] || "").trim()
    if (!orderId) continue
    if (!grouped.has(orderId)) grouped.set(orderId, row)
  }

  for (const row of grouped.values()) {
    const orderId = String(row[idxId] || "").trim()
    if (!shouldSyncOrder(orderId, resetSeq)) continue
    const paymentSummary = String(row[idxPayment] || "")
    const customer = String(row[idxCustomer] || "Khách lẻ")
    const orderDate = toSheetDateVN(String(row[idxDate] || todayYmd()))
    const payment = parsePaymentSummary(paymentSummary)

    if (payment.cash > 0) {
      const refId = `${orderId}::cash`
      if (!txRefSet.has(`order_payment::${refId}`)) {
        transactionRows.push(buildTransactionRow({
          type: "sale_cash",
          amount: payment.cash,
          occurredAt: orderDate,
          accountId: cashAccount.id,
          accountName: cashAccount.name,
          refType: "order_payment",
          refId,
          counterparty: customer,
          source: "Ban_Hang",
          note: `Thu tiền mặt từ đơn ${orderId}`,
          automatic: true,
          createdBy: "system",
        }))
        addAccountDelta(cashAccount.id, payment.cash)
        txRefSet.add(`order_payment::${refId}`)
      }
    }

    if (payment.transfer > 0) {
      const refId = `${orderId}::transfer`
      if (!txRefSet.has(`order_payment::${refId}`)) {
        transactionRows.push(buildTransactionRow({
          type: "sale_transfer",
          amount: payment.transfer,
          occurredAt: orderDate,
          accountId: bankAccount.id,
          accountName: bankAccount.name,
          refType: "order_payment",
          refId,
          counterparty: customer,
          source: "Ban_Hang",
          note: `Thu chuyển khoản từ đơn ${orderId}`,
          automatic: true,
          createdBy: "system",
        }))
        addAccountDelta(bankAccount.id, payment.transfer)
        txRefSet.add(`order_payment::${refId}`)
      }
    }

    if (payment.card > 0) {
      const refId = `${orderId}::card`
      const marker = `order_card::${refId}`
      if (!recvRefSet.has(marker)) {
        const due = DateTime.fromISO(orderDate).plus({ days: 2 }).toFormat("yyyy-MM-dd")
        receivableRows.push(buildReceivableRow({
          counterparty: customer,
          description: `Thẻ từ đơn ${orderId}`,
          totalAmount: payment.card,
          dueDate: due,
          collectability: "high",
          accountId: bankAccount.id,
          autoRefType: "order_card",
          autoRefId: refId,
          note: refId,
        }))
        recvRefSet.add(marker)
      }
    }

    if (payment.installmentLoan > 0) {
      const refId = `${orderId}::installment`
      const marker = `order_installment::${refId}`
      if (!recvRefSet.has(marker)) {
        const due = DateTime.fromISO(orderDate).plus({ days: 2 }).toFormat("yyyy-MM-dd")
        receivableRows.push(buildReceivableRow({
          counterparty: customer,
          description: `Trả góp từ đơn ${orderId}`,
          totalAmount: payment.installmentLoan,
          dueDate: due,
          collectability: "medium",
          accountId: bankAccount.id,
          autoRefType: "order_installment",
          autoRefId: refId,
          note: refId,
        }))
        recvRefSet.add(marker)
      }
    }

    // COD GHTK KHÔNG tự cộng vào nguồn tiền. Số COD (chờ về / đã đối soát) chỉ
    // hiển thị để tính phương án qua readGhtkCodSummaryFromSales; chủ cửa hàng
    // tự cộng thủ công vào Nguồn tiền khi GHTK báo tiền về.
  }

  if (transactionRows.length) {
    await appendMultipleToGoogleSheets(SHEETS.TRANSACTIONS, transactionRows)
  }
  if (receivableRows.length) {
    await appendMultipleToGoogleSheets(SHEETS.RECEIVABLES, receivableRows)
  }
  await applyAccountDeltas(accountDeltas)
}

async function syncSingleOrderIntoCashFlow(accounts: CashAccount[], params: {
  orderId: string
  customer: string
  orderDate: string
  shipping?: string
  paymentSummary?: string
  payments?: Array<{ method?: string; amount?: number; loanAmount?: number }>
}) {
  const resetSeq = await readResetOrderSeq()
  if (!shouldSyncOrder(params.orderId, resetSeq)) return
  const existingTx = await readTransactions()
  const existingRecv = await readReceivables()
  const txRefSet = new Set(existingTx.map((item) => `${item.refType}::${item.refId}`))
  const recvRefSet = new Set(
    existingRecv
      .filter((item) => item.autoRefType && item.autoRefId)
      .map((item) => `${item.autoRefType}::${item.autoRefId}`),
  )
  const cashAccount = findPreferredAccount(accounts, "cash")
  const bankAccount = findPreferredAccount(accounts, "bank")
  if (!cashAccount || !bankAccount) return

  const parsedFromArray = Array.isArray(params.payments)
    ? params.payments.reduce((acc, item) => {
        const method = norm(String(item?.method || ""))
        const amount = Number(item?.amount || 0)
        if (method.includes("tien_mat")) acc.cash += amount
        else if (method.includes("chuyen_khoan")) acc.transfer += amount
        else if (method.includes("the")) acc.card += amount
        else if (method.includes("cod")) acc.cod += amount
        else if (method.includes("tra_gop")) acc.installmentLoan += Number(item?.loanAmount || amount || 0)
        return acc
      }, { cash: 0, transfer: 0, card: 0, cod: 0, installmentLoan: 0 })
    : null
  const payment = parsedFromArray || parsePaymentSummary(params.paymentSummary || "")
  const transactionRows: any[][] = []
  const receivableRows: any[][] = []
  const accountDeltas = new Map<string, number>()
  const addDelta = (id: string, amt: number) => accountDeltas.set(id, (accountDeltas.get(id) || 0) + amt)
  const orderDate = toSheetDateVN(params.orderDate || todayYmd())
  const customer = params.customer || "Khách lẻ"

  if (payment.cash > 0) {
    const refId = `${params.orderId}::cash`
    if (!txRefSet.has(`order_payment::${refId}`)) {
      transactionRows.push(buildTransactionRow({
        type: "sale_cash",
        amount: payment.cash,
        occurredAt: orderDate,
        accountId: cashAccount.id,
        accountName: cashAccount.name,
        refType: "order_payment",
        refId,
        counterparty: customer,
        source: "Ban_Hang",
        note: `Thu tiền mặt từ đơn ${params.orderId}`,
        automatic: true,
        createdBy: "system",
      }))
      addDelta(cashAccount.id, payment.cash)
    }
  }

  if (payment.transfer > 0) {
    const refId = `${params.orderId}::transfer`
    if (!txRefSet.has(`order_payment::${refId}`)) {
      transactionRows.push(buildTransactionRow({
        type: "sale_transfer",
        amount: payment.transfer,
        occurredAt: orderDate,
        accountId: bankAccount.id,
        accountName: bankAccount.name,
        refType: "order_payment",
        refId,
        counterparty: customer,
        source: "Ban_Hang",
        note: `Thu chuyển khoản từ đơn ${params.orderId}`,
        automatic: true,
        createdBy: "system",
      }))
      addDelta(bankAccount.id, payment.transfer)
    }
  }

  if (payment.card > 0) {
    const refId = `${params.orderId}::card`
    const marker = `order_card::${refId}`
    if (!recvRefSet.has(marker)) {
      receivableRows.push(buildReceivableRow({
        counterparty: customer,
        description: `Thẻ từ đơn ${params.orderId}`,
        totalAmount: payment.card,
        dueDate: DateTime.fromISO(orderDate).plus({ days: 2 }).toFormat("yyyy-MM-dd"),
        collectability: "high",
        accountId: bankAccount.id,
        autoRefType: "order_card",
        autoRefId: refId,
        note: refId,
      }))
      recvRefSet.add(marker)
    }
  }

  if (payment.installmentLoan > 0) {
    const refId = `${params.orderId}::installment`
    const marker = `order_installment::${refId}`
    if (!recvRefSet.has(marker)) {
      receivableRows.push(buildReceivableRow({
        counterparty: customer,
        description: `Trả góp từ đơn ${params.orderId}`,
        totalAmount: payment.installmentLoan,
        dueDate: DateTime.fromISO(orderDate).plus({ days: 2 }).toFormat("yyyy-MM-dd"),
        collectability: "medium",
        accountId: bankAccount.id,
        autoRefType: "order_installment",
        autoRefId: refId,
        note: refId,
      }))
      recvRefSet.add(marker)
    }
  }

  // COD GHTK không tự cộng vào nguồn tiền — xem ghi chú trong syncOrdersIntoCashFlow.

  if (transactionRows.length) await appendMultipleToGoogleSheets(SHEETS.TRANSACTIONS, transactionRows)
  if (receivableRows.length) await appendMultipleToGoogleSheets(SHEETS.RECEIVABLES, receivableRows)
  await applyAccountDeltas(accountDeltas)
}

async function removeRowById(sheetName: string, id: string) {
  const { header, rows } = await readFromGoogleSheets(sheetName, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const nextRows = rows.filter((row) => String(row[idxId] || "") !== id)
  if (nextRows.length === rows.length) throw new Error("Không tìm thấy bản ghi")
  await syncToGoogleSheets(sheetName, nextRows)
}

async function updateReceivableRow(input: {
  id: string
  counterparty?: string
  phone?: string
  description?: string
  totalAmount?: number
  dueDate?: string
  collectability?: string
  note?: string
}) {
  const { header, rows } = await readFromGoogleSheets(SHEETS.RECEIVABLES, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === input.id)
  if (rowIndex === -1) throw new Error("Không tìm thấy công nợ")
  const row = [...rows[rowIndex]]
  const set = (name: string, value: any) => {
    const idx = colIndex(header, name)
    if (idx !== -1 && value !== undefined) row[idx] = value
  }
  set("Đối Tượng", input.counterparty)
  set("Số Điện Thoại", input.phone)
  set("Nội Dung", input.description)
  set("Tổng Phải Thu", input.totalAmount)
  set("Ngày Hẹn Thanh Toán", input.dueDate)
  set("Khả Năng Thu", input.collectability)
  set("Ghi Chú", input.note)
  set("Updated At", nowIso())
  const simulated: Receivable = {
    id: input.id,
    counterparty: String(row[colIndex(header, "Đối Tượng")] || ""),
    phone: String(row[colIndex(header, "Số Điện Thoại")] || ""),
    description: String(row[colIndex(header, "Nội Dung")] || ""),
    totalAmount: toNumber(row[colIndex(header, "Tổng Phải Thu")]),
    collectedAmount: toNumber(row[colIndex(header, "Đã Thu")]),
    incurredAt: String(row[colIndex(header, "Ngày Phát Sinh")] || todayYmd()),
    dueDate: String(row[colIndex(header, "Ngày Hẹn Thanh Toán")] || todayYmd()),
    collectability: String(row[colIndex(header, "Khả Năng Thu")] || "medium") as any,
    status: "NOT_DUE" as any,
    note: String(row[colIndex(header, "Ghi Chú")] || ""),
  }
  set("Trạng Thái", setReceivableStatusValue(simulated))
  await updateRangeValues(`'${SHEETS.RECEIVABLES}'!A${rowIndex + 2}:P${rowIndex + 2}`, [row])
}

async function updatePayableRow(input: {
  id: string
  creditor?: string
  type?: string
  description?: string
  principalAmount?: number
  dueDate?: string
  priority?: string
  note?: string
}) {
  const { header, rows } = await readFromGoogleSheets(SHEETS.PAYABLES, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === input.id)
  if (rowIndex === -1) throw new Error("Không tìm thấy khoản phải trả")
  const row = [...rows[rowIndex]]
  const set = (name: string, value: any) => {
    const idx = colIndex(header, name)
    if (idx !== -1 && value !== undefined) row[idx] = value
  }
  set("Chủ Nợ", input.creditor)
  set("Loại Nợ", input.type)
  set("Nội Dung", input.description)
  set("Số Tiền Gốc", input.principalAmount)
  set("Hạn Thanh Toán", input.dueDate)
  set("Mức Độ Ưu Tiên", input.priority)
  set("Ghi Chú", input.note)
  set("Updated At", nowIso())
  const simulated: Payable = {
    id: input.id,
    creditor: String(row[colIndex(header, "Chủ Nợ")] || ""),
    type: String(row[colIndex(header, "Loại Nợ")] || "other") as any,
    description: String(row[colIndex(header, "Nội Dung")] || ""),
    principalAmount: toNumber(row[colIndex(header, "Số Tiền Gốc")]),
    paidAmount: toNumber(row[colIndex(header, "Đã Thanh Toán")]),
    incurredAt: String(row[colIndex(header, "Ngày Phát Sinh")] || todayYmd()),
    dueDate: String(row[colIndex(header, "Hạn Thanh Toán")] || todayYmd()),
    priority: String(row[colIndex(header, "Mức Độ Ưu Tiên")] || "medium") as any,
    status: "NOT_DUE" as any,
    hasInterest: parseBool(row[colIndex(header, "Có Tính Lãi")]),
    interestMode: String(row[colIndex(header, "Kiểu Lãi")] || "") as any,
    interestValue: toNumber(row[colIndex(header, "Giá Trị Lãi")]),
    interestStartAt: String(row[colIndex(header, "Ngày Bắt Đầu Tính Lãi")] || ""),
    note: String(row[colIndex(header, "Ghi Chú")] || ""),
  }
  set("Trạng Thái", setPayableStatusValue(simulated))
  await updateRangeValues(`'${SHEETS.PAYABLES}'!A${rowIndex + 2}:S${rowIndex + 2}`, [row])
}

async function collectReceivablePayment(input: {
  id: string
  amount: number
  accountId: string
  note?: string
  actor?: string
}) {
  const receivables = await readReceivables()
  const accounts = await readAccounts()
  const item = receivables.find((row) => row.id === input.id)
  if (!item) throw new Error("Không tìm thấy công nợ")
  const account = findAccountById(accounts, input.accountId)
  if (!account) throw new Error("Không tìm thấy tài khoản nhận")
  const amount = Math.max(0, Math.floor(input.amount || 0))
  const remaining = remainingReceivable(item)
  if (amount <= 0) throw new Error("Số tiền thu phải lớn hơn 0")
  if (amount > remaining) throw new Error("Số tiền thu vượt quá số còn phải thu")

  const { header, rows } = await readFromGoogleSheets(SHEETS.RECEIVABLES, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const idxCollected = colIndex(header, "Đã Thu")
  const idxStatus = colIndex(header, "Trạng Thái")
  const idxUpdated = colIndex(header, "Updated At")
  const idxNote = colIndex(header, "Ghi Chú")
  const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === input.id)
  if (rowIndex === -1) throw new Error("Không tìm thấy công nợ")
  const newCollected = toNumber(rows[rowIndex][idxCollected]) + amount
  const simulated = { ...item, collectedAmount: newCollected }
  await batchUpdateRangeValues([
    { range: `'${SHEETS.RECEIVABLES}'!F${rowIndex + 2}`, values: [[newCollected]] },
    { range: `'${SHEETS.RECEIVABLES}'!J${rowIndex + 2}`, values: [[setReceivableStatusValue(simulated)]] },
    { range: `'${SHEETS.RECEIVABLES}'!P${rowIndex + 2}`, values: [[nowIso()]] },
    { range: `'${SHEETS.RECEIVABLES}'!N${rowIndex + 2}`, values: [[`${String(rows[rowIndex][idxNote] || "")}${input.note ? ` | Thu: ${input.note}` : ""}`.trim()]] },
  ])
  await appendToGoogleSheets(SHEETS.TRANSACTIONS, buildTransactionRow({
    type: "receivable_collection",
    amount,
    occurredAt: todayYmd(),
    accountId: account.id,
    accountName: account.name,
    refType: "receivable_payment",
    refId: input.id,
    counterparty: item.counterparty,
    source: "DongTien",
    note: input.note || `Thu công nợ ${item.description}`,
    automatic: false,
    createdBy: input.actor || "manager",
  }))
  await applyAccountDeltas(new Map([[account.id, amount]]))
}

async function payPayablePayment(input: {
  id: string
  amount: number
  accountId: string
  note?: string
  actor?: string
}) {
  const payables = await readPayables()
  const accounts = await readAccounts()
  const item = payables.find((row) => row.id === input.id)
  if (!item) throw new Error("Không tìm thấy khoản phải trả")
  const account = findAccountById(accounts, input.accountId)
  if (!account) throw new Error("Không tìm thấy tài khoản chi")
  const amount = Math.max(0, Math.floor(input.amount || 0))
  const remaining = remainingPayable(item)
  if (amount <= 0) throw new Error("Số tiền trả phải lớn hơn 0")
  if (amount > remaining) throw new Error("Số tiền trả vượt quá số còn phải trả")
  if (amount > account.balance) throw new Error("Số dư tài khoản không đủ để chi trả")

  const { header, rows } = await readFromGoogleSheets(SHEETS.PAYABLES, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const idxPaid = colIndex(header, "Đã Thanh Toán")
  const idxStatus = colIndex(header, "Trạng Thái")
  const idxUpdated = colIndex(header, "Updated At")
  const idxNote = colIndex(header, "Ghi Chú")
  const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === input.id)
  if (rowIndex === -1) throw new Error("Không tìm thấy khoản phải trả")
  const newPaid = toNumber(rows[rowIndex][idxPaid]) + amount
  const simulated = { ...item, paidAmount: newPaid }
  await batchUpdateRangeValues([
    { range: `'${SHEETS.PAYABLES}'!F${rowIndex + 2}`, values: [[newPaid]] },
    { range: `'${SHEETS.PAYABLES}'!J${rowIndex + 2}`, values: [[setPayableStatusValue(simulated)]] },
    { range: `'${SHEETS.PAYABLES}'!S${rowIndex + 2}`, values: [[nowIso()]] },
    { range: `'${SHEETS.PAYABLES}'!O${rowIndex + 2}`, values: [[`${String(rows[rowIndex][idxNote] || "")}${input.note ? ` | Trả: ${input.note}` : ""}`.trim()]] },
  ])
  await appendToGoogleSheets(SHEETS.TRANSACTIONS, buildTransactionRow({
    type: "payable_payment",
    amount,
    occurredAt: todayYmd(),
    accountId: account.id,
    accountName: account.name,
    refType: "payable_payment",
    refId: input.id,
    counterparty: item.creditor,
    source: "DongTien",
    note: input.note || `Thanh toán ${item.description}`,
    automatic: false,
    createdBy: input.actor || "manager",
  }))
  await applyAccountDeltas(new Map([[account.id, -amount]]))
}

function inventoryStatusToCode(status: string) {
  const x = norm(status)
  if (x.includes("da_ban")) return "SOLD"
  if (x.includes("bao_hanh")) return "WARRANTY"
  if (x.includes("giu")) return "HOLDING"
  if (x.includes("thu_lai") || x.includes("hoan_tra")) return "IN_STOCK_RETURNED"
  return "IN_STOCK"
}

async function readInventorySnapshot(): Promise<InventoryItem[]> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.KHO_HANG, undefined, { force: true })
  const idxId = colIndex(header, "ID Máy")
  const idxImei = colIndex(header, "IMEI")
  const idxName = colIndex(header, "Tên Sản Phẩm")
  const idxCapacity = colIndex(header, "Dung Lượng")
  const idxColor = colIndex(header, "Màu Sắc")
  const idxCondition = colIndex(header, "Tình Trạng Máy")
  const idxCost = colIndex(header, "Giá Nhập")
  const idxSell = colIndex(header, "Giá Bán")
  const idxStocked = colIndex(header, "Ngày Nhập")
  const idxStatus = colIndex(header, "Trạng Thái")
  const uniqueImei = new Set<string>()
  const out: InventoryItem[] = []
  for (const row of rows) {
    const imei = String(row[idxImei] || "").trim()
    if (imei && uniqueImei.has(imei)) continue
    if (imei) uniqueImei.add(imei)
    out.push({
      id: String(row[idxId] || imei || genId("inv")),
      code: String(row[idxId] || imei || ""),
      imei,
      model: String(row[idxName] || ""),
      capacity: String(row[idxCapacity] || ""),
      color: String(row[idxColor] || ""),
      condition: String(row[idxCondition] || ""),
      costPrice: toNumber(row[idxCost]),
      expectedSalePrice: toNumber(row[idxSell]),
      quickSalePrice: Math.round(toNumber(row[idxSell]) * 0.97),
      stockedAt: toSheetDateVN(String(row[idxStocked] || todayYmd())),
      status: inventoryStatusToCode(String(row[idxStatus] || "")) as any,
      note: "",
    })
  }
  return out
}

function buildOverview(args: {
  accounts: CashAccount[]
  inventoryItems: InventoryItem[]
  receivables: Receivable[]
  payables: Payable[]
  profitFundEntries: ProfitFundEntry[]
  longTermDebts: LongTermDebt[]
  depositOrders: DepositOrderSummary[]
  safeReserve: number
  ghtkCodSummary: GhtkCodSummary
}): CashFlowOverview {
  const cashOnHand = args.accounts.reduce((sum, item) => sum + (item.availability === "AVAILABLE" ? item.balance : 0), 0)
  const currentInventory = args.inventoryItems.filter((item) => item.status === "IN_STOCK" || item.status === "IN_STOCK_RETURNED")
  const inventoryValue = currentInventory.reduce((sum, item) => sum + item.costPrice, 0)
  const inventoryExpectedSaleValue = currentInventory.reduce((sum, item) => sum + item.expectedSalePrice, 0)
  const inventoryQuickSaleValue = currentInventory.reduce((sum, item) => sum + item.quickSalePrice, 0)
  const totalReceivables = args.receivables.reduce((sum, item) => sum + remainingReceivable(item), 0)
  const totalPayables = args.payables.reduce((sum, item) => sum + remainingPayable(item), 0)
  const realizedProfitSinceStart = args.profitFundEntries
    .filter((item) => item.type === "sale_profit")
    .reduce((sum, item) => sum + item.amount, 0)
  const profitFundBalance = args.profitFundEntries.reduce((sum, item) => sum + item.amount, 0)
  const longTermDebtTotal = args.longTermDebts.reduce((sum, item) => sum + item.principalAmount, 0)
  const longTermDebtPaid = args.longTermDebts.reduce((sum, item) => sum + item.paidAmount, 0)
  const longTermDebtRemaining = args.longTermDebts.reduce((sum, item) => sum + Math.max(0, item.principalAmount - item.paidAmount), 0)
  const activeDepositOrders = args.depositOrders.length
  const activeDepositCollected = args.depositOrders.reduce((sum, item) => sum + item.depositAmount, 0)
  const activeDepositInventoryValue = args.depositOrders.reduce((sum, item) => sum + item.inventoryValue, 0)
  const activeDepositRemaining = args.depositOrders.reduce((sum, item) => sum + item.remainingAmount, 0)
  // Khoản quá hạn chưa trả vẫn là nghĩa vụ phải xử lý ngay — tách bucket riêng
  // và cộng vào phép tính thiếu hụt, không được bỏ sót như trước.
  const overduePayables = args.payables.reduce((sum, item) => {
    const d = daysUntil(item.dueDate)
    return d < 0 ? sum + remainingPayable(item) : sum
  }, 0)
  const overdueReceivables = args.receivables.reduce((sum, item) => {
    const d = daysUntil(item.dueDate)
    return d < 0 ? sum + remainingReceivable(item) : sum
  }, 0)
  const dueToday = args.payables.reduce((sum, item) => daysUntil(item.dueDate) === 0 ? sum + remainingPayable(item) : sum, 0)
  const dueIn3Days = args.payables.reduce((sum, item) => {
    const d = daysUntil(item.dueDate)
    return d >= 1 && d <= 3 ? sum + remainingPayable(item) : sum
  }, 0)
  const dueIn7Days = args.payables.reduce((sum, item) => {
    const d = daysUntil(item.dueDate)
    return d >= 4 && d <= 7 ? sum + remainingPayable(item) : sum
  }, 0)
  const receivableDueIn3Days = args.receivables.reduce((sum, item) => {
    const d = daysUntil(item.dueDate)
    return d <= 3 ? sum + remainingReceivable(item) : sum
  }, 0)
  const codPending3Days = args.ghtkCodSummary.pending3Days
  const spendableCash = Math.max(0, cashOnHand - args.safeReserve)
  const totalShortTermAssets = cashOnHand + inventoryValue + totalReceivables
  const projectedCashAfterReceivables = cashOnHand + totalReceivables + codPending3Days
  const shortageForUpcomingDues = Math.max(0, overduePayables + dueToday + dueIn3Days - (spendableCash + receivableDueIn3Days + codPending3Days))
  const projectedEndingBalance = totalShortTermAssets - totalPayables
  const ageCount = currentInventory.reduce(
    (acc, item) => {
      const age = Math.max(0, Math.floor((Date.now() - startOfDay(item.stockedAt)) / 86400000))
      if (age > 15) acc.over15Days += 1
      if (age > 30) acc.over30Days += 1
      if (age > 60) acc.over60Days += 1
      return acc
    },
    { over15Days: 0, over30Days: 0, over60Days: 0 },
  )
  return {
    asOfDate: todayYmd(),
    cashOnHand,
    codPending3Days,
    codReconciledInCash: args.ghtkCodSummary.reconciledInCash,
    codPendingOrders: args.ghtkCodSummary.pendingOrders,
    codReconciledOrders: args.ghtkCodSummary.reconciledOrders,
    inventoryValue,
    inventoryExpectedSaleValue,
    inventoryQuickSaleValue,
    inventoryAging: ageCount,
    totalReceivables,
    totalPayables,
    overduePayables,
    overdueReceivables,
    dueToday,
    dueIn3Days,
    dueIn7Days,
    currentLiquidCash: cashOnHand,
    projectedCashAfterReceivables,
    totalShortTermAssets,
    shortageForUpcomingDues,
    projectedEndingBalance,
    safeReserve: args.safeReserve,
    spendableCash,
    realizedProfitSinceStart,
    profitFundBalance,
    longTermDebtTotal,
    longTermDebtPaid,
    longTermDebtRemaining,
    activeDepositOrders,
    activeDepositCollected,
    activeDepositInventoryValue,
    activeDepositRemaining,
  }
}

// Số tiền lãi phát sinh MỖI NGÀY của một khoản nợ, quy đổi theo kiểu lãi.
// interestValue có thể nhập dạng phần trăm (2 = 2%) hoặc tỷ lệ (0.02) — giá trị
// lớn hơn 1 được hiểu là phần trăm.
function dailyInterestAmount(item: Payable): number {
  if (!item.hasInterest || !item.interestValue) return 0
  const remaining = remainingPayable(item)
  if (remaining <= 0) return 0
  switch (item.interestMode) {
    case "daily_rate": {
      const rate = item.interestValue > 1 ? item.interestValue / 100 : item.interestValue
      return Math.round(remaining * rate)
    }
    case "monthly_rate": {
      const rate = item.interestValue > 1 ? item.interestValue / 100 : item.interestValue
      return Math.round((remaining * rate) / 30)
    }
    case "fixed_daily":
    default:
      return item.interestValue
  }
}

function buildPlan(overview: CashFlowOverview, receivables: Receivable[], payables: Payable[]): CashFlowPlanRow[] {
  const rows: CashFlowPlanRow[] = []
  let openingBalance = overview.cashOnHand
  for (let offset = 0; offset <= 7; offset++) {
    const date = DateTime.fromISO(todayYmd(), { zone: "Asia/Ho_Chi_Minh" }).plus({ days: offset }).toFormat("yyyy-MM-dd")
    const receivableInflow = receivables.reduce((sum, item) => item.dueDate === date ? sum + remainingReceivable(item) : sum, 0)
    // Ngày đầu tiên gánh luôn các khoản đã quá hạn — chúng phải được xử lý ngay,
    // bỏ ra ngoài sẽ làm mô phỏng lạc quan hơn thực tế.
    const payablesToday = payables.filter((item) =>
      item.dueDate === date || (offset === 0 && daysUntil(item.dueDate) < 0),
    )
    const externalDebtOutflow = payablesToday.filter((item) => item.type === "external_debt").reduce((sum, item) => sum + remainingPayable(item), 0)
    const inventoryOutflow = payablesToday.filter((item) => item.type === "inventory_payable" || item.type === "supplier").reduce((sum, item) => sum + remainingPayable(item), 0)
    const loanOutflow = payablesToday.filter((item) => item.type === "loan").reduce((sum, item) => sum + remainingPayable(item), 0)
    // Lãi = khoản loại "interest" đến hạn trong ngày + lãi phát sinh hằng ngày
    // của mọi khoản đang tính lãi (tích lũy từng ngày, không chỉ ngày đến hạn).
    const interestOutflow =
      payablesToday.filter((item) => item.type === "interest").reduce((sum, item) => sum + remainingPayable(item), 0) +
      payables.reduce((sum, item) => {
        if (!item.hasInterest || item.type === "interest") return sum
        if (item.interestStartAt && startOfDay(item.interestStartAt) > startOfDay(date)) return sum
        return sum + dailyInterestAmount(item)
      }, 0)
    const operatingOutflow = payablesToday.filter((item) => ["rent", "salary", "operating_cost", "other"].includes(item.type)).reduce((sum, item) => sum + remainingPayable(item), 0)
    const salesInflow = 0
    const otherInflow = 0
    const netCashFlow = receivableInflow + salesInflow + otherInflow - externalDebtOutflow - inventoryOutflow - loanOutflow - interestOutflow - operatingOutflow
    const closingBalance = openingBalance + netCashFlow
    rows.push({
      date,
      openingBalance,
      receivableInflow,
      salesInflow,
      otherInflow,
      externalDebtOutflow,
      inventoryOutflow,
      loanOutflow,
      interestOutflow,
      operatingOutflow,
      netCashFlow,
      closingBalance,
      isNegative: closingBalance < 0,
    })
    openingBalance = closingBalance
  }
  return rows
}

function buildPaymentSuggestions(payables: Payable[], overview: CashFlowOverview, accounts: CashAccount[]): PaymentSuggestion[] {
  let spendable = overview.spendableCash
  const bankAccount = findPreferredAccount(accounts, "bank")
  const cashAccount = findPreferredAccount(accounts, "cash")
  return payables
    .filter((item) => remainingPayable(item) > 0)
    .sort((a, b) => {
      const ad = daysUntil(a.dueDate)
      const bd = daysUntil(b.dueDate)
      if (ad !== bd) return ad - bd
      const rank = (v: PriorityLevel) => v === "critical" ? 0 : v === "high" ? 1 : v === "medium" ? 2 : 3
      return rank(a.priority) - rank(b.priority)
    })
    .map((item) => {
      const amount = remainingPayable(item)
      const enough = spendable >= amount
      if (enough) spendable -= amount
      return {
        id: `suggest_${item.id}`,
        payableId: item.id,
        creditor: item.creditor,
        description: item.description,
        priority: item.priority,
        reason: [
          statusForPayable(item) === "OVERDUE" ? "Khoản quá hạn" : statusForPayable(item) === "DUE_TODAY" ? "Đến hạn hôm nay" : `Đến hạn ${item.dueDate}`,
          item.hasInterest ? "Có tính lãi" : null,
          item.type === "inventory_payable" ? "Ảnh hưởng nguồn nhập hàng" : null,
        ].filter(Boolean).join(" • "),
        suggestedDate: item.dueDate,
        suggestedAmount: amount,
        fundingSource: item.type === "external_debt" ? (cashAccount?.name || bankAccount?.name || "") : (bankAccount?.name || cashAccount?.name || ""),
        hasEnoughCash: enough,
      }
    })
}

function buildAlerts(overview: CashFlowOverview, plan: CashFlowPlanRow[]) {
  const alerts: CashFlowDashboardData["alerts"] = []
  const due3Total = overview.dueToday + overview.dueIn3Days
  if (overview.overduePayables > 0) {
    alerts.push({
      id: "overdue",
      level: "danger",
      title: "Nợ quá hạn chưa xử lý",
      description: "Có khoản phải trả đã quá hạn nhưng chưa tất toán, cần ưu tiên trả hoặc đàm phán giãn ngay.",
      amount: overview.overduePayables,
    })
  }
  alerts.push({
    id: "due_today",
    level: overview.dueToday <= 0 ? "success" : overview.spendableCash >= overview.dueToday ? "success" : "danger",
    title: "Nợ đến hạn hôm nay",
    description:
      overview.dueToday <= 0
        ? "Hôm nay không có khoản phải trả đến hạn."
        : overview.spendableCash >= overview.dueToday
          ? "Tiền có thể chi đang đủ để xử lý các khoản đến hạn hôm nay."
          : "Tiền có thể chi hiện chưa đủ để xử lý các khoản đến hạn hôm nay.",
    amount: overview.dueToday,
    dueDate: todayYmd(),
  })
  alerts.push({
    id: "due_3d",
    level: due3Total <= 0 ? "success" : overview.shortageForUpcomingDues > 0 ? "danger" : "success",
    title: "Nghĩa vụ 3 ngày tới",
    description:
      due3Total <= 0
        ? "Chưa có khoản phải trả nào trong 3 ngày tới."
        : overview.shortageForUpcomingDues > 0
          ? "Dòng tiền 3 ngày tới đang thiếu, cần ưu tiên thu nợ hoặc đàm phán giãn lịch trả."
          : "Dòng tiền 3 ngày tới đang đủ, nên ưu tiên xử lý các khoản ảnh hưởng nhập hàng hoặc có lãi trước.",
    amount: overview.shortageForUpcomingDues > 0 ? overview.shortageForUpcomingDues : due3Total,
  })
  if (overview.inventoryAging.over30Days > 0) {
    alerts.push({
      id: "inventory_30",
      level: "warning",
      title: "Hàng tồn trên 30 ngày",
      description: `${overview.inventoryAging.over30Days} máy đang tồn kho lâu ngày, nên ưu tiên đẩy bán để giảm áp lực dòng tiền.`,
    })
  }
  const negative = plan.find((item) => item.isNegative)
  if (negative) {
    alerts.push({
      id: "negative",
      level: "danger",
      title: "Dòng tiền dự kiến âm",
      description: `Hiện chưa âm ngay, nhưng nếu không có thêm thu vào thì số dư sẽ âm từ ngày ${negative.date}.`,
      amount: Math.abs(negative.closingBalance),
      dueDate: negative.date,
    })
  }
  return alerts
}

function buildScenario(overview: CashFlowOverview, input: CashFlowScenarioInput) {
  // Bán hàng thu về theo giá bán nhanh (thận trọng), không phải giá vốn.
  // Giá trị hàng tồn còn lại vẫn tính theo giá vốn của phần chưa bán.
  const collectibleFromInventory = Math.round(overview.inventoryQuickSaleValue * input.sellThroughRate)
  const soldInventoryCost = Math.round(overview.inventoryValue * input.sellThroughRate)
  const collectibleFromReceivables = Math.round(overview.totalReceivables * input.receivableCollectRate)
  const endingBalance = overview.cashOnHand + collectibleFromInventory + collectibleFromReceivables - overview.totalPayables
  return {
    collectibleFromInventory,
    collectibleFromReceivables,
    totalOutflow: overview.totalPayables,
    endingBalance,
    remainingInventoryValue: overview.inventoryValue - soldInventoryCost,
    remainingReceivables: overview.totalReceivables - collectibleFromReceivables,
    firstNegativeDate: endingBalance < 0 ? todayYmd() : null,
    shortage: Math.max(0, input.safeReserve - endingBalance),
  }
}

function buildCashFlowReportContent(data: CashFlowDashboardData, reportDate: string): Omit<CashFlowDailyReport, "slug" | "reportDate" | "generatedAt" | "data"> {
  const { overview, inventoryItems, payables, receivables, paymentSuggestions, alerts } = data
  const currentInventory = inventoryItems.filter((item) => item.status === "IN_STOCK" || item.status === "IN_STOCK_RETURNED")
  const agedInventory = currentInventory
    .map((item) => ({
      ...item,
      ageDays: Math.max(0, Math.floor((Date.now() - startOfDay(item.stockedAt)) / 86400000)),
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 3)
  const urgentPayables = payables
    .filter((item) => remainingPayable(item) > 0)
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))
    .slice(0, 3)
  const nearReceivables = receivables
    .filter((item) => remainingReceivable(item) > 0)
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))
    .slice(0, 3)
  const negativeAlert = alerts.find((item) => item.id === "negative")
  const reportLabel = DateTime.fromISO(reportDate, { zone: "Asia/Ho_Chi_Minh" }).toFormat("dd/MM/yyyy")

  const highlights = [
    `Tiền mặt và tài khoản hiện có ${overview.cashOnHand.toLocaleString("vi-VN")} ₫, sau khi trừ quỹ an toàn còn chi được ${overview.spendableCash.toLocaleString("vi-VN")} ₫.`,
    `COD GHTK đã đối soát ${overview.codReconciledInCash.toLocaleString("vi-VN")} ₫; COD chờ về 3 ngày tới ${overview.codPending3Days.toLocaleString("vi-VN")} ₫.`,
    `Nghĩa vụ gần hạn gồm hôm nay ${overview.dueToday.toLocaleString("vi-VN")} ₫, 3 ngày tới ${overview.dueIn3Days.toLocaleString("vi-VN")} ₫, 7 ngày tới ${overview.dueIn7Days.toLocaleString("vi-VN")} ₫.`,
  ]

  const warnings = [
    overview.overduePayables > 0
      ? `Có ${overview.overduePayables.toLocaleString("vi-VN")} ₫ nợ đã quá hạn chưa tất toán, cần xử lý trước tiên.`
      : "Không có nợ quá hạn tồn đọng.",
    overview.shortageForUpcomingDues > 0
      ? `Đang thiếu ${overview.shortageForUpcomingDues.toLocaleString("vi-VN")} ₫ cho chu kỳ 3 ngày tới ngay cả khi đã tính công nợ và COD sắp thu.`
      : "Chu kỳ 3 ngày tới hiện chưa có thiếu hụt sau khi tính công nợ và COD dự kiến.",
    overview.inventoryAging.over30Days > 0
      ? `Có ${overview.inventoryAging.over30Days} máy tồn trên 30 ngày, cần ưu tiên xử lý để giảm áp lực vốn.`
      : "Chưa có cảnh báo tồn kho trên 30 ngày.",
    negativeAlert?.description || "Chưa xuất hiện điểm âm trong mô phỏng dòng tiền hiện tại.",
  ]

  const cashActions = [
    overview.codPending3Days > 0
      ? `Bám sát ${overview.codPendingOrders} đơn GHTK còn COD, tổng ${overview.codPending3Days.toLocaleString("vi-VN")} ₫; ưu tiên đối soát sớm các đơn đã giao.`
      : "Không có COD GHTK chờ về đáng kể trong 3 ngày tới.",
    nearReceivables[0]
      ? `Ưu tiên thu ${remainingReceivable(nearReceivables[0]).toLocaleString("vi-VN")} ₫ từ ${nearReceivables[0].counterparty} trước ngày ${nearReceivables[0].dueDate}.`
      : "Không có công nợ phải thu ngắn hạn nổi bật cần nhắc riêng.",
    paymentSuggestions[0]
      ? `Giữ ngân quỹ cho khoản ${paymentSuggestions[0].creditor} - ${paymentSuggestions[0].description} với mức nên chi ${paymentSuggestions[0].suggestedAmount.toLocaleString("vi-VN")} ₫.`
      : "Chưa có gợi ý phân bổ tiền nổi bật từ hệ thống.",
  ]

  const inventoryActions = [
    agedInventory.length > 0
      ? `Ưu tiên đẩy bán các máy tồn lâu: ${agedInventory.map((item) => `${item.model} ${item.capacity} (${item.ageDays} ngày)`).join(", ")}.`
      : "Tồn kho hiện tại chưa có máy lâu ngày nổi bật.",
    `Giá trị hàng tồn theo giá nhập là ${overview.inventoryValue.toLocaleString("vi-VN")} ₫, bán nhanh ước thu ${overview.inventoryQuickSaleValue.toLocaleString("vi-VN")} ₫.`,
  ]

  const debtActions = [
    urgentPayables[0]
      ? `Làm việc trước với ${urgentPayables[0].creditor} cho khoản ${urgentPayables[0].description}, còn ${remainingPayable(urgentPayables[0]).toLocaleString("vi-VN")} ₫, hạn ${urgentPayables[0].dueDate}.`
      : "Chưa có khoản phải trả gấp cần xử lý ngay.",
    overview.shortageForUpcomingDues > 0
      ? "Nếu chưa cân đủ tiền trong 24 giờ tới, nên chia đợt trả hoặc xin giãn các khoản chưa tính lãi trước."
      : "Có thể ưu tiên trả trước các khoản ảnh hưởng nguồn nhập hàng hoặc đang phát sinh lãi.",
  ]

  const summary = overview.shortageForUpcomingDues > 0
    ? `Kết thúc ngày ${reportLabel}, dòng tiền đang chịu áp lực ngắn hạn. Tiền sẵn có cùng công nợ và COD dự kiến vẫn chưa đủ phủ toàn bộ nghĩa vụ gần hạn, nên trọng tâm là kéo tiền về nhanh và xử lý bớt hàng tồn lâu ngày.`
    : `Kết thúc ngày ${reportLabel}, dòng tiền đang trong vùng kiểm soát. Tiền sẵn có cùng công nợ và COD dự kiến đủ xử lý nghĩa vụ gần hạn, nên có thể tập trung tối ưu vòng quay hàng và trả trước các khoản nhạy cảm.`

  return {
    title: `Báo cáo dòng tiền ngày ${reportLabel}`,
    summary,
    highlights,
    warnings,
    cashActions,
    inventoryActions,
    debtActions,
  }
}

function parseJsonArray(value: any) {
  try {
    const parsed = JSON.parse(String(value || "[]"))
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "")) : []
  } catch {
    return []
  }
}

function parseJsonObject<T>(value: any): T | null {
  try {
    return JSON.parse(String(value || "null")) as T
  } catch {
    return null
  }
}

async function upsertCashFlowReport(report: CashFlowDailyReport) {
  const { header, rows } = await readFromGoogleSheets(SHEETS.REPORTS, undefined, { force: true })
  const idxSlug = colIndex(header, "Slug")
  const nextRows = [...rows]
  const row = [
    report.slug,
    report.reportDate,
    report.generatedAt,
    report.title,
    report.summary,
    JSON.stringify(report.highlights || []),
    JSON.stringify(report.warnings || []),
    JSON.stringify(report.cashActions || []),
    JSON.stringify(report.inventoryActions || []),
    JSON.stringify(report.debtActions || []),
    report.aiModel || "",
    report.aiError || "",
    JSON.stringify(report.aiReport || null),
    JSON.stringify(report.data),
    nowIso(),
  ]
  const rowIndex = nextRows.findIndex((item) => String(item[idxSlug] || "") === report.slug)
  if (rowIndex === -1) nextRows.push(row)
  else nextRows[rowIndex] = row
  await syncToGoogleSheets(SHEETS.REPORTS, nextRows)
}

async function readCashFlowReportBySlugInternal(slug: string): Promise<CashFlowDailyReport | null> {
  const { header, rows } = await readFromGoogleSheets(SHEETS.REPORTS, undefined, { force: true })
  const idxSlug = colIndex(header, "Slug")
  const idxDate = colIndex(header, "Ngày Báo Cáo")
  const idxGeneratedAt = colIndex(header, "Generated At")
  const idxTitle = colIndex(header, "Tiêu Đề")
  const idxSummary = colIndex(header, "Tóm Tắt")
  const idxHighlights = colIndex(header, "Highlights Json")
  const idxWarnings = colIndex(header, "Warnings Json")
  const idxCashActions = colIndex(header, "Cash Actions Json")
  const idxInventoryActions = colIndex(header, "Inventory Actions Json")
  const idxDebtActions = colIndex(header, "Debt Actions Json")
  const idxAiModel = colIndex(header, "AI Model")
  const idxAiError = colIndex(header, "AI Error")
  const idxAiReport = colIndex(header, "AI Report Json")
  const idxData = colIndex(header, "Data Json")
  const row = rows.find((item) => String(item[idxSlug] || "") === slug)
  if (!row) return null
  const data = parseJsonObject<CashFlowDashboardData>(row[idxData])
  if (!data) return null
  return {
    slug: String(row[idxSlug] || ""),
    reportDate: String(row[idxDate] || ""),
    generatedAt: String(row[idxGeneratedAt] || ""),
    title: String(row[idxTitle] || ""),
    summary: String(row[idxSummary] || ""),
    highlights: parseJsonArray(row[idxHighlights]),
    warnings: parseJsonArray(row[idxWarnings]),
    cashActions: parseJsonArray(row[idxCashActions]),
    inventoryActions: parseJsonArray(row[idxInventoryActions]),
    debtActions: parseJsonArray(row[idxDebtActions]),
    aiModel: String(row[idxAiModel] || ""),
    aiError: String(row[idxAiError] || ""),
    aiReport: parseJsonObject<CashFlowAiReport>(row[idxAiReport]),
    data,
  }
}

async function createCashFlowDailyReport(reportDate: string, data?: CashFlowDashboardData, force = false) {
  const slug = formatReportSlug(reportDate)
  const existing = force ? null : await readCashFlowReportBySlugInternal(slug)
  if (existing) return existing
  const snapshot = data || await getCashFlowDashboardDataFromSheets()
  const ai = await generateCashFlowAiReport(snapshot, reportDate)
  const report: CashFlowDailyReport = {
    slug,
    reportDate,
    generatedAt: nowIso(),
    data: snapshot,
    aiModel: ai.model,
    aiError: ai.error,
    aiReport: ai.report,
    ...buildCashFlowReportContent(snapshot, reportDate),
  }

  if (ai.report?.executive_summary) {
    report.summary = ai.report.executive_summary
  }
  if (ai.report?.priority_actions?.within_24_hours?.length) {
    report.cashActions = ai.report.priority_actions.within_24_hours
      .slice(0, 3)
      .map((item) => String(item.action || "").trim())
      .filter(Boolean)
  }
  if (ai.report?.inventory_actions?.length) {
    report.inventoryActions = ai.report.inventory_actions
      .slice(0, 3)
      .map((item) => {
        const name = String(item.product_name || "").trim()
        const action = String(item.recommended_action || "").trim()
        const reason = String(item.reason || "").trim()
        return [name, action, reason].filter(Boolean).join(" - ")
      })
      .filter(Boolean)
  }
  if (ai.report?.payment_plan?.length) {
    report.debtActions = ai.report.payment_plan
      .slice(0, 3)
      .map((item) => {
        const ref = String(item.reference_id || item.creditor_code || "").trim()
        const amount = Number(item.recommended_payment || 0)
        const reason = String(item.reason || "").trim()
        return [ref, amount > 0 ? `${amount.toLocaleString("vi-VN")} ₫` : "", reason].filter(Boolean).join(" - ")
      })
      .filter(Boolean)
  }
  await upsertCashFlowReport(report)
  return report
}

export async function maybeCreateDailyCashFlowReport(data?: CashFlowDashboardData) {
  const now = DateTime.now().setZone("Asia/Ho_Chi_Minh")
  if (now.hour < AUTO_REPORT_HOUR) return null
  const reportDate = now.toFormat("yyyy-MM-dd")
  return createCashFlowDailyReport(reportDate, data, false)
}

export async function getCashFlowReportBySlug(slug: string) {
  const existing = await readCashFlowReportBySlugInternal(slug)
  if (existing) return existing
  const reportDate = parseReportSlug(slug)
  if (!reportDate) return null
  if (reportDate !== todayYmd()) return null
  return createCashFlowDailyReport(reportDate, undefined, true)
}

// Chống chạy sync chồng nhau: hai GET song song cùng đọc txRefSet trước khi bên
// kia kịp append sẽ ghi trùng giao dịch và cộng tiền 2 lần. Mutex trong process
// đảm bảo mọi caller cùng chờ một lượt sync; throttle tránh sync lại liên tục
// mỗi lần reload (bấm "Đồng bộ lại từ sheet" sẽ force bỏ qua throttle).
let orderSyncInFlight: Promise<void> | null = null
let lastOrderSyncAt = 0
const ORDER_SYNC_MIN_INTERVAL_MS = 30_000

async function runOrderSyncs(forceSync = false) {
  if (orderSyncInFlight) return orderSyncInFlight
  if (!forceSync && Date.now() - lastOrderSyncAt < ORDER_SYNC_MIN_INTERVAL_MS) return
  orderSyncInFlight = (async () => {
    try {
      const accounts = await readAccounts()
      await syncOrdersIntoCashFlow(accounts)
      await syncProfitFundFromSales()
      lastOrderSyncAt = Date.now()
    } finally {
      orderSyncInFlight = null
    }
  })()
  return orderSyncInFlight
}

export async function getCashFlowDashboardDataFromSheets(options?: { forceSync?: boolean }): Promise<CashFlowDashboardData> {
  await ensureCashFlowSheets()
  await runOrderSyncs(options?.forceSync)
  const rawAccounts = await readAccounts()
  // "Tiền mặt" luôn bằng tổng quỹ tiền mặt (sheet Tien_mat), không cho chỉnh tay.
  // Nguồn "Tiền mặt ở shop" cũ được ẩn khỏi dashboard.
  const cashFundBalance = await getCashBalance().catch(() => null)
  const freshAccounts = rawAccounts
    .filter((item) => norm(item.name) !== norm("Tiền mặt ở shop"))
    .map((item) =>
      cashFundBalance !== null && (item.id === "acc_cash" || norm(item.name) === norm("Tiền mặt"))
        ? { ...item, balance: cashFundBalance, note: item.note || "Tự động đồng bộ từ Quỹ tiền mặt" }
        : item,
    )
  const transactions = await readTransactions()
  const profitFundEntries = await readProfitFundEntries()
  const longTermDebts = (await readLongTermDebts()).map((item) => ({ ...item, status: statusForLongTermDebt(item) }))
  const depositOrders = await readActiveDepositOrders()
  const inventoryItems = await readInventorySnapshot()
  const receivables = await readReceivables()
  const payables = await readPayables()
  const safeReserve = await readSafeReserve()
  const ghtkCodSummary = await readGhtkCodSummaryFromSales()
  const receivablesWithStatus = receivables.map((item) => ({ ...item, status: statusForReceivable(item) as any }))
  const payablesWithStatus = payables.map((item) => ({ ...item, status: statusForPayable(item) as any }))
  // Tiền mặt và tài khoản = ĐÚNG tổng các nguồn AVAILABLE trong Nguồn tiền.
  // Tiền cọc và COD GHTK không tự cộng vào — chủ cửa hàng tự cộng thủ công khi
  // tiền thực về; các con số đó chỉ hiển thị riêng để tính phương án.
  const overview = buildOverview({
    accounts: freshAccounts,
    inventoryItems,
    receivables: receivablesWithStatus,
    payables: payablesWithStatus,
    profitFundEntries,
    longTermDebts,
    depositOrders,
    safeReserve,
    ghtkCodSummary,
  })
  const plan = buildPlan(overview, receivablesWithStatus, payablesWithStatus)
  const paymentSuggestions = buildPaymentSuggestions(payablesWithStatus, overview, freshAccounts)
  const alerts = buildAlerts(overview, plan)
  const scenarios = [
    { id: "none", name: "Không bán được hàng", sellThroughRate: 0, receivableCollectRate: 0, safeReserve },
    { id: "25", name: "Bán 25% hàng tồn", sellThroughRate: 0.25, receivableCollectRate: 0.5, safeReserve },
    { id: "50", name: "Bán 50% hàng tồn", sellThroughRate: 0.5, receivableCollectRate: 0.5, safeReserve },
    { id: "75", name: "Bán 75% hàng tồn", sellThroughRate: 0.75, receivableCollectRate: 1, safeReserve },
    { id: "100", name: "Bán 100% hàng tồn", sellThroughRate: 1, receivableCollectRate: 1, safeReserve },
  ].map((scenario) => ({ ...scenario, ...buildScenario(overview, scenario) }))
  return {
    overview,
    accounts: freshAccounts,
    transactions: [...transactions].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.occurredAt || 0).getTime()
      const bTime = new Date(b.createdAt || b.occurredAt || 0).getTime()
      return bTime - aTime
    }),
    profitFundEntries: [...profitFundEntries].sort((a, b) => {
      const aTime = new Date(a.createdAt || a.date || 0).getTime()
      const bTime = new Date(b.createdAt || b.date || 0).getTime()
      return bTime - aTime
    }),
    longTermDebts,
    depositOrders,
    inventoryItems,
    receivables: receivablesWithStatus,
    payables: payablesWithStatus,
    alerts,
    plan,
    paymentSuggestions,
    scenarios,
  }
}

export async function resetCashFlowData() {
  await ensureCashFlowSheets()

  const [{ header: accountHeader, rows: accountRows }, { header: saleHeader, rows: saleRows }] = await Promise.all([
    readFromGoogleSheets(SHEETS.ACCOUNTS, undefined, { force: true }),
    readFromGoogleSheets(SHEETS.BAN_HANG, undefined, { force: true }),
  ])

  const accountIdIdx = colIndex(accountHeader, "ID")
  const accountNameIdx = colIndex(accountHeader, "Tên Nguồn")
  const accountTypeIdx = colIndex(accountHeader, "Loại Nguồn")
  const accountBalanceIdx = colIndex(accountHeader, "Số Dư")
  const accountAvailabilityIdx = colIndex(accountHeader, "Trạng Thái Khả Dụng")
  const accountDateIdx = colIndex(accountHeader, "Ngày Cập Nhật")
  const accountNoteIdx = colIndex(accountHeader, "Ghi Chú")
  const accountAutoIdx = colIndex(accountHeader, "Tự Động")
  const accountCreatedIdx = colIndex(accountHeader, "Created At")
  const accountUpdatedIdx = colIndex(accountHeader, "Updated At")

  const sourceRows = accountRows.length
    ? accountRows
    : [
        ["acc_cash", "Tiền mặt", "cash", 0, "AVAILABLE", todayYmd(), "", "false", nowIso(), nowIso()],
        ["acc_bank", "Tiền tài khoản", "bank", 0, "AVAILABLE", todayYmd(), "", "false", nowIso(), nowIso()],
      ]

  const normalizedAccounts = sourceRows.map((row) => {
    const next = Array(accountHeader.length).fill("")
    if (accountIdIdx !== -1) next[accountIdIdx] = row[accountIdIdx] || genId("acc")
    if (accountNameIdx !== -1) next[accountNameIdx] = row[accountNameIdx] || ""
    if (accountTypeIdx !== -1) next[accountTypeIdx] = row[accountTypeIdx] || "other"
    if (accountBalanceIdx !== -1) next[accountBalanceIdx] = 0
    if (accountAvailabilityIdx !== -1) next[accountAvailabilityIdx] = row[accountAvailabilityIdx] || "AVAILABLE"
    if (accountDateIdx !== -1) next[accountDateIdx] = todayYmd()
    if (accountNoteIdx !== -1) next[accountNoteIdx] = ""
    if (accountAutoIdx !== -1) next[accountAutoIdx] = row[accountAutoIdx] || "false"
    if (accountCreatedIdx !== -1) next[accountCreatedIdx] = row[accountCreatedIdx] || nowIso()
    if (accountUpdatedIdx !== -1) next[accountUpdatedIdx] = nowIso()
    return next
  })

  const saleIdIdx = colIndex(saleHeader, "ID Đơn Hàng")
  const maxOrderSeq = saleRows.reduce((max, row) => {
    const seq = getOrderSequence(String(row[saleIdIdx] || ""))
    return Math.max(max, seq)
  }, 0)

  await syncToGoogleSheets(SHEETS.ACCOUNTS, normalizedAccounts)
  await syncToGoogleSheets(SHEETS.RECEIVABLES, [])
  await syncToGoogleSheets(SHEETS.PAYABLES, [])
  await syncToGoogleSheets(SHEETS.TRANSACTIONS, [])
  await syncToGoogleSheets(SHEETS.PROFIT_FUND, [])
  await syncToGoogleSheets(SHEETS.LONG_TERM_DEBTS, [])
  await upsertSettingRows([
    { key: SETTING_KEYS.SAFE_RESERVE, value: 0, note: "Reset về 0 để nhập lại thủ công" },
    { key: SETTING_KEYS.RESET_ORDER_SEQ, value: maxOrderSeq, note: "Chỉ đồng bộ các đơn phát sinh sau lần reset gần nhất" },
  ])

  return {
    success: true,
    resetOrderSeq: maxOrderSeq,
    accountCount: normalizedAccounts.length,
  }
}

export async function createCashFlowAccount(input: {
  name: string
  type: string
  balance: number
  availability?: string
  note?: string
}) {
  await ensureCashFlowSheets()
  await appendToGoogleSheets(SHEETS.ACCOUNTS, [
    genId("acc"),
    input.name,
    input.type,
    input.balance,
    input.availability || "AVAILABLE",
    todayYmd(),
    input.note || "",
    "false",
    nowIso(),
    nowIso(),
  ])
}

export async function updateCashFlowAccount(input: {
  id: string
  name?: string
  type?: string
  balance?: number
  availability?: string
  note?: string
}) {
  const { header, rows } = await readFromGoogleSheets(SHEETS.ACCOUNTS, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === input.id)
  if (rowIndex === -1) throw new Error("Không tìm thấy nguồn tiền")
  const row = [...rows[rowIndex]]
  const set = (name: string, value: any) => {
    const idx = colIndex(header, name)
    if (idx !== -1 && value !== undefined) row[idx] = value
  }
  set("Tên Nguồn", input.name)
  set("Loại Nguồn", input.type)
  set("Số Dư", input.balance)
  set("Trạng Thái Khả Dụng", input.availability)
  set("Ghi Chú", input.note)
  set("Updated At", nowIso())
  const sheetRow = rowIndex + 2
  await updateRangeValues(`'${SHEETS.ACCOUNTS}'!A${sheetRow}:J${sheetRow}`, [row])
}

export async function createCashFlowReceivable(input: {
  counterparty: string
  phone?: string
  description: string
  totalAmount: number
  dueDate: string
  collectability?: string
  note?: string
  accountId?: string
}) {
  await ensureCashFlowSheets()
  await appendToGoogleSheets(SHEETS.RECEIVABLES, buildReceivableRow(input))
}

export async function updateCashFlowReceivable(input: {
  id: string
  counterparty?: string
  phone?: string
  description?: string
  totalAmount?: number
  dueDate?: string
  collectability?: string
  note?: string
}) {
  await updateReceivableRow(input)
}

export async function deleteCashFlowReceivable(id: string) {
  await removeRowById(SHEETS.RECEIVABLES, id)
}

export async function createCashFlowPayable(input: {
  creditor: string
  type: string
  description: string
  principalAmount: number
  dueDate: string
  priority?: string
  note?: string
  hasInterest?: boolean
}) {
  await ensureCashFlowSheets()
  await appendToGoogleSheets(SHEETS.PAYABLES, [
    genId("pay"),
    input.creditor,
    input.type,
    input.description,
    input.principalAmount,
    0,
    todayYmd(),
    input.dueDate,
    input.priority || "medium",
    daysUntil(input.dueDate) === 0 ? "DUE_TODAY" : "NOT_DUE",
    input.hasInterest ? "true" : "false",
    "",
    0,
    "",
    input.note || "",
    "",
    "",
    nowIso(),
    nowIso(),
  ])
}

export async function createLongTermDebt(input: {
  creditor: string
  description: string
  principalAmount: number
  dueDate: string
  priority?: string
  note?: string
}) {
  await ensureCashFlowSheets()
  await appendToGoogleSheets(SHEETS.LONG_TERM_DEBTS, buildLongTermDebtRow(input))
}

export async function updateCashFlowPayable(input: {
  id: string
  creditor?: string
  type?: string
  description?: string
  principalAmount?: number
  dueDate?: string
  priority?: string
  note?: string
}) {
  await updatePayableRow(input)
}

export async function updateLongTermDebt(input: {
  id: string
  creditor?: string
  description?: string
  principalAmount?: number
  dueDate?: string
  priority?: string
  note?: string
}) {
  const { header, rows } = await readFromGoogleSheets(SHEETS.LONG_TERM_DEBTS, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === input.id)
  if (rowIndex === -1) throw new Error("Không tìm thấy nợ dài hạn")
  const row = [...rows[rowIndex]]
  const set = (name: string, value: any) => {
    const idx = colIndex(header, name)
    if (idx !== -1 && value !== undefined) row[idx] = value
  }
  set("Chủ Nợ", input.creditor)
  set("Nội Dung", input.description)
  set("Số Tiền Gốc", input.principalAmount)
  set("Hạn Thanh Toán", input.dueDate)
  set("Mức Độ Ưu Tiên", input.priority)
  set("Ghi Chú", input.note)
  const simulated: LongTermDebt = {
    id: input.id,
    creditor: String(row[colIndex(header, "Chủ Nợ")] || ""),
    description: String(row[colIndex(header, "Nội Dung")] || ""),
    principalAmount: toNumber(row[colIndex(header, "Số Tiền Gốc")]),
    paidAmount: toNumber(row[colIndex(header, "Đã Thanh Toán")]),
    incurredAt: String(row[colIndex(header, "Ngày Phát Sinh")] || todayYmd()),
    dueDate: String(row[colIndex(header, "Hạn Thanh Toán")] || todayYmd()),
    priority: String(row[colIndex(header, "Mức Độ Ưu Tiên")] || "medium") as PriorityLevel,
    status: "OPEN",
    note: String(row[colIndex(header, "Ghi Chú")] || ""),
  }
  set("Trạng Thái", statusForLongTermDebt(simulated))
  set("Updated At", nowIso())
  await updateRangeValues(`'${SHEETS.LONG_TERM_DEBTS}'!A${rowIndex + 2}:L${rowIndex + 2}`, [row])
}

export async function deleteCashFlowPayable(id: string) {
  await removeRowById(SHEETS.PAYABLES, id)
}

export async function deleteLongTermDebt(id: string) {
  await removeRowById(SHEETS.LONG_TERM_DEBTS, id)
}

export async function collectCashFlowReceivable(input: {
  id: string
  amount: number
  accountId: string
  note?: string
  actor?: string
}) {
  await collectReceivablePayment(input)
}

export async function payCashFlowPayable(input: {
  id: string
  amount: number
  accountId: string
  note?: string
  actor?: string
}) {
  await payPayablePayment(input)
}

export async function payLongTermDebt(input: {
  id: string
  amount: number
  note?: string
  actor?: string
}) {
  const debts = await readLongTermDebts()
  const entries = await readProfitFundEntries()
  const item = debts.find((row) => row.id === input.id)
  if (!item) throw new Error("Không tìm thấy nợ dài hạn")
  const amount = Math.max(0, Math.floor(input.amount || 0))
  const remaining = Math.max(0, item.principalAmount - item.paidAmount)
  const fundBalance = entries.reduce((sum, row) => sum + row.amount, 0)
  if (amount <= 0) throw new Error("Số tiền trả phải lớn hơn 0")
  if (amount > remaining) throw new Error("Số tiền trả vượt quá số còn phải trả")
  if (amount > fundBalance) throw new Error("Quỹ lãi hiện không đủ để trả khoản này")

  const { header, rows } = await readFromGoogleSheets(SHEETS.LONG_TERM_DEBTS, undefined, { force: true })
  const idxId = colIndex(header, "ID")
  const idxPaid = colIndex(header, "Đã Thanh Toán")
  const idxNote = colIndex(header, "Ghi Chú")
  const rowIndex = rows.findIndex((row) => String(row[idxId] || "") === input.id)
  if (rowIndex === -1) throw new Error("Không tìm thấy nợ dài hạn")
  const newPaid = toNumber(rows[rowIndex][idxPaid]) + amount
  const simulated = { ...item, paidAmount: newPaid }
  await batchUpdateRangeValues([
    { range: `'${SHEETS.LONG_TERM_DEBTS}'!E${rowIndex + 2}`, values: [[newPaid]] },
    { range: `'${SHEETS.LONG_TERM_DEBTS}'!I${rowIndex + 2}`, values: [[statusForLongTermDebt(simulated)]] },
    { range: `'${SHEETS.LONG_TERM_DEBTS}'!J${rowIndex + 2}`, values: [[`${String(rows[rowIndex][idxNote] || "")}${input.note ? ` | Trả quỹ lãi: ${input.note}` : ""}`.trim()]] },
    { range: `'${SHEETS.LONG_TERM_DEBTS}'!L${rowIndex + 2}`, values: [[nowIso()]] },
  ])
  await appendToGoogleSheets(SHEETS.PROFIT_FUND, buildProfitFundRow({
    date: todayYmd(),
    amount: -amount,
    type: "long_term_debt_payment",
    refType: "long_term_debt_payment",
    refId: input.id,
    counterparty: item.creditor,
    note: input.note || `Trả nợ dài hạn ${item.description}`,
    automatic: false,
    createdBy: input.actor || "manager",
  }))
}

export async function syncCashFlowFromSale(input: {
  orderId: string
  customer: string
  orderDate: string
  shipping?: string
  paymentSummary?: string
  payments?: Array<{ method?: string; amount?: number; loanAmount?: number }>
}) {
  await ensureCashFlowSheets()
  const accounts = await readAccounts()
  await syncSingleOrderIntoCashFlow(accounts, input)
}

export async function syncCashFlowForGhtkCode(code: string) {
  if (!code) return
  await ensureCashFlowSheets()
  const accounts = await readAccounts()
  const { header, rows } = await readFromGoogleSheets(SHEETS.BAN_HANG, undefined, { force: true })
  const idxId = colIndex(header, "ID Đơn Hàng")
  const idxCustomer = colIndex(header, "Tên Khách Hàng")
  const idxDate = colIndex(header, "Ngày Bán", "Ngày Xuất")
  const idxShip = colIndex(header, "Hình Thức Vận Chuyển")
  const idxPay = colIndex(header, "Hình Thức Thanh Toán")
  const byOrder = new Map<string, { customer: string; orderDate: string; shipping: string; paymentSummary: string }>()
  for (const row of rows) {
    const shipping = String(row[idxShip] || "")
    if (extractGhtkCode(shipping) !== code) continue
    const orderId = String(row[idxId] || "").trim()
    if (!orderId || byOrder.has(orderId)) continue
    byOrder.set(orderId, {
      customer: String(row[idxCustomer] || "Khách lẻ"),
      orderDate: toSheetDateVN(String(row[idxDate] || todayYmd())),
      shipping,
      paymentSummary: String(row[idxPay] || ""),
    })
  }
  for (const [orderId, item] of byOrder.entries()) {
    await syncSingleOrderIntoCashFlow(accounts, {
      orderId,
      customer: item.customer,
      orderDate: item.orderDate,
      shipping: item.shipping,
      paymentSummary: item.paymentSummary,
    })
  }
}
