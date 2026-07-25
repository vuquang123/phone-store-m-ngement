export type MoneySourceType =
  | "cash"
  | "bank"
  | "ewallet"
  | "payment_gateway"
  | "pending_settlement"
  | "other"

export type AvailabilityStatus = "AVAILABLE" | "PENDING" | "LOCKED"

export type ReceivableStatus =
  | "NOT_DUE"
  | "DUE_TODAY"
  | "OVERDUE"
  | "PARTIALLY_COLLECTED"
  | "COLLECTED"
  | "HARD_TO_COLLECT"
  | "CANCELLED"

export type PayableType =
  | "external_debt"
  | "inventory_payable"
  | "supplier"
  | "loan"
  | "interest"
  | "rent"
  | "salary"
  | "operating_cost"
  | "other"

export type PayableStatus =
  | "NOT_DUE"
  | "DUE_TODAY"
  | "OVERDUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "EXTENDED"
  | "DEFERRED"

export type PriorityLevel = "critical" | "high" | "medium" | "low"

export interface CashAccount {
  id: string
  name: string
  type: MoneySourceType
  balance: number
  updatedAt: string
  availability: AvailabilityStatus
  note?: string
}

export interface InventoryItem {
  id: string
  code: string
  imei: string
  model: string
  capacity: string
  color: string
  condition: string
  costPrice: number
  expectedSalePrice: number
  quickSalePrice: number
  stockedAt: string
  status:
    | "IN_STOCK"
    | "SOLD"
    | "CUSTOMER_RETURNED"
    | "IN_STOCK_RETURNED"
    | "HOLDING"
    | "WARRANTY"
    | "LIQUIDATED"
  note?: string
}

export interface Receivable {
  id: string
  counterparty: string
  phone: string
  description: string
  totalAmount: number
  collectedAmount: number
  incurredAt: string
  dueDate: string
  collectability: "high" | "medium" | "low"
  status: ReceivableStatus
  note?: string
}

export interface Payable {
  id: string
  creditor: string
  type: PayableType
  description: string
  principalAmount: number
  paidAmount: number
  incurredAt: string
  dueDate: string
  priority: PriorityLevel
  status: PayableStatus
  hasInterest: boolean
  interestMode?: "daily_rate" | "monthly_rate" | "fixed_daily"
  interestValue?: number
  interestStartAt?: string
  note?: string
}

export interface CashFlowScenarioInput {
  sellThroughRate: number
  receivableCollectRate: number
  safeReserve: number
}

export interface CashFlowPlanRow {
  date: string
  openingBalance: number
  receivableInflow: number
  salesInflow: number
  otherInflow: number
  externalDebtOutflow: number
  inventoryOutflow: number
  loanOutflow: number
  interestOutflow: number
  operatingOutflow: number
  netCashFlow: number
  closingBalance: number
  isNegative: boolean
}

export interface CashFlowAlert {
  id: string
  level: "success" | "warning" | "danger" | "muted"
  title: string
  description: string
  amount?: number
  dueDate?: string
}

export interface PaymentSuggestion {
  id: string
  payableId: string
  creditor: string
  description: string
  priority: PriorityLevel
  reason: string
  suggestedDate: string
  suggestedAmount: number
  fundingSource: string
  hasEnoughCash: boolean
}

export interface CashFlowOverview {
  asOfDate: string
  cashOnHand: number
  codPending3Days: number
  codReconciledInCash: number
  codPendingOrders: number
  codReconciledOrders: number
  inventoryValue: number
  inventoryExpectedSaleValue: number
  inventoryQuickSaleValue: number
  inventoryAging: {
    over15Days: number
    over30Days: number
    over60Days: number
  }
  totalReceivables: number
  totalPayables: number
  dueToday: number
  dueIn3Days: number
  dueIn7Days: number
  currentLiquidCash: number
  projectedCashAfterReceivables: number
  totalShortTermAssets: number
  shortageForUpcomingDues: number
  projectedEndingBalance: number
  safeReserve: number
  spendableCash: number
}

export interface CashFlowDashboardData {
  overview: CashFlowOverview
  accounts: CashAccount[]
  inventoryItems: InventoryItem[]
  receivables: Receivable[]
  payables: Payable[]
  alerts: CashFlowAlert[]
  plan: CashFlowPlanRow[]
  paymentSuggestions: PaymentSuggestion[]
  scenarios: Array<{
    id: string
    name: string
    sellThroughRate: number
    receivableCollectRate: number
    safeReserve: number
    collectibleFromInventory: number
    collectibleFromReceivables: number
    totalOutflow: number
    endingBalance: number
    remainingInventoryValue: number
    remainingReceivables: number
    firstNegativeDate: string | null
    shortage: number
  }>
}

export interface CashFlowDailyReport {
  slug: string
  reportDate: string
  generatedAt: string
  title: string
  summary: string
  highlights: string[]
  warnings: string[]
  cashActions: string[]
  inventoryActions: string[]
  debtActions: string[]
  data: CashFlowDashboardData
}
