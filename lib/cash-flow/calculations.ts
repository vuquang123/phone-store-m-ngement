import { CASH_FLOW_AS_OF, DEFAULT_SAFE_RESERVE, cashAccountsSample, inventoryItemsSample, payablesSample, receivablesSample } from "./sample-data"
import type {
  CashFlowAlert,
  CashFlowDashboardData,
  CashFlowOverview,
  CashFlowPlanRow,
  CashFlowScenarioInput,
  InventoryItem,
  Payable,
  PaymentSuggestion,
  Receivable,
} from "./types"

function toStartOfDay(input: string): number {
  return new Date(`${input}T00:00:00+07:00`).getTime()
}

function daysBetween(from: string, to: string): number {
  const diff = toStartOfDay(to) - toStartOfDay(from)
  return Math.floor(diff / 86400000)
}

function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((acc, item) => acc + selector(item), 0)
}

function remainingReceivable(item: Receivable): number {
  return Math.max(0, item.totalAmount - item.collectedAmount)
}

function remainingPayable(item: Payable): number {
  return Math.max(0, item.principalAmount - item.paidAmount)
}

function isInventoryCounted(item: InventoryItem): boolean {
  return item.status === "IN_STOCK" || item.status === "IN_STOCK_RETURNED"
}

function bucketDueAmount(payables: Payable[], startDay: number, endDay: number): number {
  return sum(payables, (item) => {
    const remaining = remainingPayable(item)
    if (remaining <= 0) return 0
    const distance = daysBetween(CASH_FLOW_AS_OF, item.dueDate)
    return distance >= startDay && distance <= endDay ? remaining : 0
  })
}

export function buildOverview(safeReserve = DEFAULT_SAFE_RESERVE): CashFlowOverview {
  const availableCash = sum(cashAccountsSample, (item) => item.availability === "AVAILABLE" ? item.balance : 0)
  const countedInventory = inventoryItemsSample.filter(isInventoryCounted)
  const inventoryValue = sum(countedInventory, (item) => item.costPrice)
  const inventoryExpectedSaleValue = sum(countedInventory, (item) => item.expectedSalePrice)
  const inventoryQuickSaleValue = sum(countedInventory, (item) => item.quickSalePrice)
  const totalReceivables = sum(receivablesSample, remainingReceivable)
  const totalPayables = sum(payablesSample, remainingPayable)
  const dueToday = bucketDueAmount(payablesSample, 0, 0)
  const dueIn3Days = bucketDueAmount(payablesSample, 1, 3)
  const dueIn7Days = bucketDueAmount(payablesSample, 4, 7)
  const totalShortTermAssets = availableCash + inventoryValue + totalReceivables
  const projectedCashAfterReceivables = availableCash + totalReceivables
  const shortageForUpcomingDues = Math.max(0, dueToday + dueIn3Days - projectedCashAfterReceivables)
  const projectedEndingBalance = totalShortTermAssets - totalPayables
  const spendableCash = Math.max(0, availableCash - safeReserve)

  const aging = countedInventory.reduce(
    (acc, item) => {
      const age = Math.max(0, daysBetween(item.stockedAt, CASH_FLOW_AS_OF))
      if (age > 15) acc.over15Days += 1
      if (age > 30) acc.over30Days += 1
      if (age > 60) acc.over60Days += 1
      return acc
    },
    { over15Days: 0, over30Days: 0, over60Days: 0 },
  )

  return {
    asOfDate: CASH_FLOW_AS_OF,
    cashOnHand: availableCash,
    codPending3Days: 0,
    codReconciledInCash: 0,
    codPendingOrders: 0,
    codReconciledOrders: 0,
    inventoryValue,
    inventoryExpectedSaleValue,
    inventoryQuickSaleValue,
    inventoryAging: aging,
    totalReceivables,
    totalPayables,
    dueToday,
    dueIn3Days,
    dueIn7Days,
    currentLiquidCash: availableCash,
    projectedCashAfterReceivables,
    totalShortTermAssets,
    shortageForUpcomingDues,
    projectedEndingBalance,
    safeReserve,
    spendableCash,
  }
}

export function buildCashFlowPlan(): CashFlowPlanRow[] {
  const rows: CashFlowPlanRow[] = []
  let openingBalance = sum(cashAccountsSample, (item) => item.balance)

  for (let offset = 0; offset <= 7; offset++) {
    const current = new Date(`${CASH_FLOW_AS_OF}T00:00:00+07:00`)
    current.setDate(current.getDate() + offset)
    const date = current.toISOString().slice(0, 10)

    const receivableInflow = sum(receivablesSample, (item) =>
      item.dueDate === date ? remainingReceivable(item) : 0,
    )
    const externalDebtOutflow = sum(payablesSample, (item) =>
      item.dueDate === date && item.type === "external_debt" ? remainingPayable(item) : 0,
    )
    const inventoryOutflow = sum(payablesSample, (item) =>
      item.dueDate === date && item.type === "inventory_payable" ? remainingPayable(item) : 0,
    )
    const operatingOutflow = sum(payablesSample, (item) =>
      item.dueDate === date && (item.type === "rent" || item.type === "operating_cost") ? remainingPayable(item) : 0,
    )
    const interestOutflow = sum(payablesSample, (item) => {
      if (!item.hasInterest || !item.interestValue || !item.interestStartAt) return 0
      const interestStarted = daysBetween(item.interestStartAt, date) >= 0
      if (!interestStarted) return 0
      if (date !== CASH_FLOW_AS_OF && date !== item.dueDate) return 0
      return item.interestMode === "fixed_daily" ? item.interestValue : 0
    })
    const salesInflow = offset === 3 ? 50000000 : offset === 5 ? 35000000 : 0
    const otherInflow = 0
    const loanOutflow = 0
    const netCashFlow =
      receivableInflow + salesInflow + otherInflow -
      externalDebtOutflow - inventoryOutflow - loanOutflow - interestOutflow - operatingOutflow
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

function priorityRank(level: PaymentSuggestion["priority"]): number {
  switch (level) {
    case "critical":
      return 0
    case "high":
      return 1
    case "medium":
      return 2
    default:
      return 3
  }
}

export function buildPaymentSuggestions(spendableCash: number): PaymentSuggestion[] {
  let remainingCash = spendableCash
  return payablesSample
    .filter((item) => remainingPayable(item) > 0)
    .sort((a, b) => {
      const dayDiff = daysBetween(CASH_FLOW_AS_OF, a.dueDate) - daysBetween(CASH_FLOW_AS_OF, b.dueDate)
      if (dayDiff !== 0) return dayDiff
      return priorityRank(a.priority) - priorityRank(b.priority)
    })
    .map((item) => {
      const amount = remainingPayable(item)
      const enough = remainingCash >= amount
      const reasonParts = [
        daysBetween(CASH_FLOW_AS_OF, item.dueDate) < 0 ? "Đã quá hạn" : item.status === "DUE_TODAY" ? "Đến hạn hôm nay" : `Đến hạn ${item.dueDate}`,
        item.hasInterest ? "Có phát sinh lãi" : null,
        item.type === "inventory_payable" ? "Ảnh hưởng nguồn nhập hàng" : null,
        item.type === "rent" ? "Chi phí thiết yếu" : null,
      ].filter(Boolean)
      if (enough) remainingCash -= amount
      return {
        id: `suggest-${item.id}`,
        payableId: item.id,
        creditor: item.creditor,
        description: item.description,
        priority: item.priority,
        reason: reasonParts.join(" • "),
        suggestedDate: item.dueDate,
        suggestedAmount: amount,
        fundingSource: "Tài khoản ngân hàng chính",
        hasEnoughCash: enough,
      }
    })
}

export function buildAlerts(overview: CashFlowOverview, plan: CashFlowPlanRow[]): CashFlowAlert[] {
  const alerts: CashFlowAlert[] = []
  alerts.push({
    id: "alert-due-today",
    level: overview.currentLiquidCash >= overview.dueToday ? "success" : "danger",
    title: "Nợ đến hạn hôm nay",
    description: overview.currentLiquidCash >= overview.dueToday
      ? "Tiền mặt hiện tại đủ trả các khoản đến hạn hôm nay."
      : "Tiền mặt hiện tại chưa đủ cho các khoản đến hạn hôm nay.",
    amount: overview.dueToday,
    dueDate: CASH_FLOW_AS_OF,
  })
  alerts.push({
    id: "alert-due-3d",
    level: overview.projectedCashAfterReceivables >= overview.dueToday + overview.dueIn3Days ? "warning" : "danger",
    title: "Nghĩa vụ 3 ngày tới",
    description: overview.projectedCashAfterReceivables >= overview.dueToday + overview.dueIn3Days
      ? "Cần ưu tiên thu công nợ hoặc chốt thêm đơn để giữ vùng an toàn."
      : `Thiếu ${Math.max(0, overview.dueToday + overview.dueIn3Days - overview.projectedCashAfterReceivables).toLocaleString("vi-VN")} ₫ cho các khoản 3 ngày tới.`,
    amount: overview.dueIn3Days,
    dueDate: "2026-07-28",
  })
  if (overview.safeReserve > 0) {
    alerts.push({
      id: "alert-safe-reserve",
      level: overview.spendableCash > 0 ? "warning" : "danger",
      title: "Quỹ an toàn",
      description: `Đang giữ lại ${overview.safeReserve.toLocaleString("vi-VN")} ₫ làm quỹ an toàn.`,
      amount: overview.safeReserve,
    })
  }
  const firstNegative = plan.find((row) => row.isNegative)
  if (firstNegative) {
    alerts.push({
      id: "alert-negative",
      level: "danger",
      title: "Dòng tiền dự kiến âm",
      description: `Số dư âm lần đầu vào ngày ${firstNegative.date}.`,
      amount: Math.abs(firstNegative.closingBalance),
      dueDate: firstNegative.date,
    })
  } else {
    alerts.push({
      id: "alert-flow-ok",
      level: "success",
      title: "Dòng tiền 7 ngày",
      description: "Kế hoạch hiện tại chưa xuất hiện ngày nào âm tiền.",
    })
  }
  if (overview.inventoryAging.over30Days > 0) {
    alerts.push({
      id: "alert-aging-30",
      level: "warning",
      title: "Hàng tồn trên 30 ngày",
      description: `${overview.inventoryAging.over30Days} máy đang tồn trên 30 ngày, nên ưu tiên đẩy nhanh.`,
      amount: overview.inventoryAging.over30Days,
    })
  }
  return alerts
}

export function buildScenario(input: CashFlowScenarioInput) {
  const overview = buildOverview(input.safeReserve)
  const collectibleFromInventory = Math.round(overview.inventoryValue * input.sellThroughRate)
  const collectibleFromReceivables = Math.round(overview.totalReceivables * input.receivableCollectRate)
  const totalOutflow = overview.totalPayables
  const endingBalance = overview.cashOnHand + collectibleFromInventory + collectibleFromReceivables - totalOutflow
  const shortage = Math.max(0, input.safeReserve - endingBalance)
  const plan = buildCashFlowPlan()
  const simulatedRows = plan.map((row, idx) => {
    if (idx === 0) {
      return {
        ...row,
        closingBalance: row.openingBalance + row.netCashFlow + collectibleFromReceivables * 0.5,
      }
    }
    return row
  })
  const firstNegative = simulatedRows.find((row) => row.closingBalance < 0)
  return {
    collectibleFromInventory,
    collectibleFromReceivables,
    totalOutflow,
    endingBalance,
    remainingInventoryValue: overview.inventoryValue - collectibleFromInventory,
    remainingReceivables: overview.totalReceivables - collectibleFromReceivables,
    firstNegativeDate: firstNegative?.date || null,
    shortage,
  }
}

export function buildDashboardData(): CashFlowDashboardData {
  const overview = buildOverview()
  const plan = buildCashFlowPlan()
  const paymentSuggestions = buildPaymentSuggestions(overview.spendableCash)
  const alerts = buildAlerts(overview, plan)
  const scenarios = [
    { id: "scn-0", name: "Không bán được hàng", sellThroughRate: 0, receivableCollectRate: 0, safeReserve: overview.safeReserve },
    { id: "scn-25", name: "Bán 25% hàng tồn", sellThroughRate: 0.25, receivableCollectRate: 0.5, safeReserve: overview.safeReserve },
    { id: "scn-50", name: "Bán 50% hàng tồn", sellThroughRate: 0.5, receivableCollectRate: 0.5, safeReserve: overview.safeReserve },
    { id: "scn-75", name: "Bán 75% hàng tồn", sellThroughRate: 0.75, receivableCollectRate: 1, safeReserve: overview.safeReserve },
    { id: "scn-100", name: "Bán 100% hàng tồn", sellThroughRate: 1, receivableCollectRate: 1, safeReserve: overview.safeReserve },
  ].map((scenario) => ({
    ...scenario,
    ...buildScenario(scenario),
  }))

  return {
    overview,
    accounts: cashAccountsSample,
    transactions: [],
    inventoryItems: inventoryItemsSample,
    receivables: receivablesSample,
    payables: payablesSample,
    alerts,
    plan,
    paymentSuggestions,
    scenarios,
  }
}
