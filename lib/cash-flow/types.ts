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
  accountId?: string
  autoRefType?: string
  autoRefId?: string
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

export interface LedgerTransaction {
  id: string
  type: string
  amount: number
  occurredAt: string
  accountId: string
  accountName: string
  refType: string
  refId: string
  counterparty: string
  source: string
  note: string
  automatic: boolean
  createdBy: string
  createdAt: string
}

export interface ProfitFundEntry {
  id: string
  date: string
  amount: number
  type: "sale_profit" | "long_term_debt_payment"
  refType: string
  refId: string
  orderId?: string
  counterparty: string
  note: string
  automatic: boolean
  createdBy: string
  createdAt: string
}

export interface DepositOrderProduct {
  model: string
  capacity: string
  color: string
  imei: string
  serial: string
  condition: string
  costPrice: number
  salePrice: number
}

export interface DepositOrderSummary {
  id: string
  customer: string
  phone: string
  status: string
  depositDate: string
  dueDate: string
  depositAmount: number
  remainingAmount: number
  inventoryValue: number
  saleValue: number
  note: string
  products: DepositOrderProduct[]
}

export interface LongTermDebt {
  id: string
  creditor: string
  description: string
  principalAmount: number
  paidAmount: number
  incurredAt: string
  dueDate: string
  priority: PriorityLevel
  status: "OPEN" | "PARTIALLY_PAID" | "PAID"
  note?: string
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
  realizedProfitSinceStart: number
  profitFundBalance: number
  longTermDebtTotal: number
  longTermDebtPaid: number
  longTermDebtRemaining: number
  activeDepositOrders: number
  activeDepositCollected: number
  activeDepositInventoryValue: number
  activeDepositRemaining: number
}

export interface CashFlowDashboardData {
  overview: CashFlowOverview
  accounts: CashAccount[]
  transactions: LedgerTransaction[]
  profitFundEntries: ProfitFundEntry[]
  longTermDebts: LongTermDebt[]
  depositOrders: DepositOrderSummary[]
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
  aiModel?: string
  aiError?: string
  aiReport?: CashFlowAiReport | null
  data: CashFlowDashboardData
}

export interface CashFlowAiReportAction {
  priority?: number
  action?: string
  reason?: string
  amount?: number
  expected_result?: string
  requires_approval?: boolean
}

export interface CashFlowAiReportAlert {
  level?: "info" | "warning" | "high" | "critical"
  category?: "cash_flow" | "receivable" | "payable" | "inventory" | "loan" | "revenue" | "expense" | "data"
  title?: string
  evidence?: string
  financial_impact?: number
  deadline?: string
  recommended_action?: string
}

export interface CashFlowAiScenario {
  name?: string
  required_cash?: number
  actions?: string[]
  expected_result?: string
  risk?: "low" | "medium" | "high"
  conditions?: string[]
  do_not_use_when?: string[]
}

export interface CashFlowAiReport {
  report_date: string
  overall_status: "good" | "attention" | "warning" | "critical"
  health_score: number
  executive_summary: string
  key_metrics: {
    liquid_cash: number
    inventory_cost: number
    receivables: number
    payables: number
    loan_principal: number
    estimated_net_position: number
  }
  cash_flow_analysis: {
    today: {
      available: number
      incoming: number
      outgoing: number
      surplus_or_gap: number
      status: "surplus" | "balanced" | "deficit"
      explanation: string
    }
    next_3_days: {
      available: number
      incoming: number
      outgoing: number
      surplus_or_gap: number
      status: "surplus" | "balanced" | "deficit"
      explanation: string
    }
    next_7_days: {
      available: number
      incoming: number
      outgoing: number
      surplus_or_gap: number
      status: "surplus" | "balanced" | "deficit"
      explanation: string
    }
  }
  alerts: CashFlowAiReportAlert[]
  priority_actions: {
    within_24_hours: CashFlowAiReportAction[]
    within_3_days: CashFlowAiReportAction[]
    within_7_days: CashFlowAiReportAction[]
  }
  receivable_actions: Array<{
    reference_id?: string
    amount?: number
    days_overdue?: number
    priority?: "low" | "medium" | "high" | "critical"
    recommended_action?: string
  }>
  inventory_actions: Array<{
    product_id?: string
    product_name?: string
    inventory_age_days?: number
    cost?: number
    current_price?: number
    recommended_action?: "keep" | "promote" | "reduce_price" | "bundle" | "stop_importing" | "review"
    suggested_price?: number
    reason?: string
    risk?: "low" | "medium" | "high"
  }>
  payment_plan: Array<{
    reference_id?: string
    creditor_code?: string
    due_date?: string
    amount_due?: number
    recommended_payment?: number
    remaining_amount?: number
    priority?: number
    reason?: string
  }>
  scenarios: {
    safe: CashFlowAiScenario
    balanced: CashFlowAiScenario
    growth: CashFlowAiScenario
  }
  questions_for_owner: string[]
  data_issues: string[]
  disclaimer: string
}
