import { DateTime } from "luxon"
import type { CashFlowAiReport, CashFlowDashboardData, Payable, Receivable } from "../../lib/cash-flow/types"
import { getDefaultGeminiModel, getGeminiClient } from "../../lib/gemini"

const PROMPT_RULES = `Bạn là AI quản trị tài chính và vận hành nội bộ cho một cửa hàng kinh doanh điện thoại, thiết bị Apple.

Nhiệm vụ của bạn là phân tích dữ liệu được lấy từ Google Sheets, phát hiện vấn đề, lập báo cáo và đề xuất phương án xử lý giúp chủ cửa hàng quản lý dòng tiền, hàng hóa, công nợ, doanh thu, chi phí và nghĩa vụ thanh toán.

NGUYÊN TẮC BẮT BUỘC
1. Chỉ sử dụng dữ liệu được cung cấp trong yêu cầu hiện tại.
2. Không tự tạo số liệu, không suy đoán số tiền chưa có trong dữ liệu.
3. Không tự sửa số liệu do hệ thống cung cấp.
4. Các trường có tiền tố calculated_ hoặc nằm trong calculated_metrics đã được backend tính toán và phải được xem là nguồn dữ liệu chính xác.
5. Không tự cộng các số liệu lớn nếu backend đã cung cấp tổng.
6. Nếu phát hiện số liệu thiếu, không hợp lệ hoặc mâu thuẫn, phải ghi rõ trong data_issues.
7. Phải phân biệt rõ tiền mặt, tiền tài khoản, hàng tồn kho, công nợ phải thu, công nợ phải trả, khoản vay và lãi vay.
8. Không xem giá trị hàng tồn kho là tiền mặt có thể sử dụng ngay.
9. Không xem toàn bộ công nợ phải thu là tiền chắc chắn thu được.
10. Mọi đề xuất phải dựa trên ít nhất một số liệu cụ thể.
11. Không trực tiếp thực hiện bất kỳ hành động tài chính nào.
12. Trả lời hoàn toàn bằng tiếng Việt.
13. Đơn vị tiền mặc định là VND.
14. Chỉ trả về một JSON hợp lệ. Không thêm giải thích trước hoặc sau JSON.

Kết quả phải theo đúng schema sau:
{
"report_date":"YYYY-MM-DD",
"overall_status":"good | attention | warning | critical",
"health_score":0,
"executive_summary":"",
"key_metrics":{"liquid_cash":0,"inventory_cost":0,"receivables":0,"payables":0,"loan_principal":0,"estimated_net_position":0},
"cash_flow_analysis":{
"today":{"available":0,"incoming":0,"outgoing":0,"surplus_or_gap":0,"status":"surplus | balanced | deficit","explanation":""},
"next_3_days":{"available":0,"incoming":0,"outgoing":0,"surplus_or_gap":0,"status":"surplus | balanced | deficit","explanation":""},
"next_7_days":{"available":0,"incoming":0,"outgoing":0,"surplus_or_gap":0,"status":"surplus | balanced | deficit","explanation":""}
},
"alerts":[{"level":"info | warning | high | critical","category":"cash_flow | receivable | payable | inventory | loan | revenue | expense | data","title":"","evidence":"","financial_impact":0,"deadline":"","recommended_action":""}],
"priority_actions":{"within_24_hours":[],"within_3_days":[],"within_7_days":[]},
"receivable_actions":[{"reference_id":"","amount":0,"days_overdue":0,"priority":"low | medium | high | critical","recommended_action":""}],
"inventory_actions":[{"product_id":"","product_name":"","inventory_age_days":0,"cost":0,"current_price":0,"recommended_action":"keep | promote | reduce_price | bundle | stop_importing | review","suggested_price":0,"reason":"","risk":"low | medium | high"}],
"payment_plan":[{"reference_id":"","creditor_code":"","due_date":"","amount_due":0,"recommended_payment":0,"remaining_amount":0,"priority":1,"reason":""}],
"scenarios":{"safe":{"name":"","required_cash":0,"actions":[],"expected_result":"","risk":"low | medium | high","conditions":[],"do_not_use_when":[]},"balanced":{"name":"","required_cash":0,"actions":[],"expected_result":"","risk":"low | medium | high","conditions":[],"do_not_use_when":[]},"growth":{"name":"","required_cash":0,"actions":[],"expected_result":"","risk":"low | medium | high","conditions":[],"do_not_use_when":[]}},
"questions_for_owner":[],
"data_issues":[],
"disclaimer":"Báo cáo được tạo từ dữ liệu hệ thống cung cấp và chỉ mang tính hỗ trợ ra quyết định. Mọi giao dịch cần được chủ cửa hàng kiểm tra và phê duyệt."
}`

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T
  } catch {
    return null
  }
}

function extractJsonObject(raw: string) {
  const trimmed = String(raw || "").trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()
  const first = trimmed.indexOf("{")
  const last = trimmed.lastIndexOf("}")
  if (first !== -1 && last !== -1 && last > first) return trimmed.slice(first, last + 1)
  return trimmed
}

function remainingReceivable(item: Receivable) {
  return Math.max(0, Number(item.totalAmount || 0) - Number(item.collectedAmount || 0))
}

function remainingPayable(item: Payable) {
  return Math.max(0, Number(item.principalAmount || 0) - Number(item.paidAmount || 0))
}

function daysDiff(baseDate: string, targetDate: string) {
  const base = DateTime.fromISO(baseDate, { zone: "Asia/Ho_Chi_Minh" }).startOf("day")
  const target = DateTime.fromISO(targetDate, { zone: "Asia/Ho_Chi_Minh" }).startOf("day")
  if (!base.isValid || !target.isValid) return 0
  return Math.floor(target.diff(base, "days").days)
}

function buildAiInput(data: CashFlowDashboardData, reportDate: string) {
  const loanPrincipal = data.payables
    .filter((item) => item.type === "loan")
    .reduce((sum, item) => sum + remainingPayable(item), 0)
  const overdueReceivables = data.receivables
    .filter((item) => remainingReceivable(item) > 0 && daysDiff(reportDate, item.dueDate) < 0)
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      counterparty: item.counterparty,
      remaining_amount: remainingReceivable(item),
      due_date: item.dueDate,
      status: item.status,
      days_overdue: Math.abs(Math.min(0, daysDiff(reportDate, item.dueDate))),
    }))

  const payables = data.payables
    .filter((item) => remainingPayable(item) > 0)
    .slice(0, 15)
    .map((item) => ({
      id: item.id,
      creditor: item.creditor,
      type: item.type,
      description: item.description,
      due_date: item.dueDate,
      status: item.status,
      remaining_amount: remainingPayable(item),
      has_interest: item.hasInterest,
      interest_value: item.interestValue || 0,
    }))

  const inventory = data.inventoryItems
    .filter((item) => item.status === "IN_STOCK" || item.status === "IN_STOCK_RETURNED")
    .slice(0, 20)
    .map((item) => ({
      id: item.id,
      product_name: `${item.model} ${item.capacity}`.trim(),
      imei: item.imei,
      cost_price: item.costPrice,
      expected_sale_price: item.expectedSalePrice,
      quick_sale_price: item.quickSalePrice,
      stocked_at: item.stockedAt,
      inventory_age_days: Math.max(0, daysDiff(item.stockedAt, reportDate)),
      color: item.color,
      condition: item.condition,
    }))

  return {
    report_date: reportDate,
    calculated_metrics: {
      liquid_cash: data.overview.cashOnHand,
      spendable_cash: data.overview.spendableCash,
      inventory_cost: data.overview.inventoryValue,
      inventory_expected_sale_value: data.overview.inventoryExpectedSaleValue,
      inventory_quick_sale_value: data.overview.inventoryQuickSaleValue,
      receivables: data.overview.totalReceivables,
      payables: data.overview.totalPayables,
      loan_principal: loanPrincipal,
      estimated_net_position: data.overview.projectedEndingBalance,
      due_today: data.overview.dueToday,
      due_next_3_days: data.overview.dueIn3Days,
      due_next_7_days: data.overview.dueIn7Days,
      cod_pending_3_days: data.overview.codPending3Days,
      cod_reconciled_in_cash: data.overview.codReconciledInCash,
      shortage_for_upcoming_dues: data.overview.shortageForUpcomingDues,
      projected_cash_after_receivables: data.overview.projectedCashAfterReceivables,
      inventory_aging_over30: data.overview.inventoryAging.over30Days,
      inventory_aging_over60: data.overview.inventoryAging.over60Days,
    },
    accounts: data.accounts.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      balance: item.balance,
      availability: item.availability,
    })),
    alerts: data.alerts,
    receivables_summary: {
      total_items: data.receivables.length,
      overdue_items: overdueReceivables.length,
      overdue_details: overdueReceivables,
      top_open_items: data.receivables
        .filter((item) => remainingReceivable(item) > 0)
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          counterparty: item.counterparty,
          remaining_amount: remainingReceivable(item),
          due_date: item.dueDate,
          status: item.status,
          collectability: item.collectability,
        })),
    },
    payables_summary: {
      total_items: payables.length,
      open_items: payables,
    },
    inventory_summary: {
      total_items: inventory.length,
      items: inventory,
    },
    payment_suggestions: data.paymentSuggestions.slice(0, 8),
    scenarios: data.scenarios,
  }
}

function normalizeAiReport(report: CashFlowAiReport, reportDate: string): CashFlowAiReport {
  return {
    report_date: report.report_date || reportDate,
    overall_status: report.overall_status || "attention",
    health_score: Math.max(0, Math.min(100, Number(report.health_score || 0))),
    executive_summary: String(report.executive_summary || ""),
    key_metrics: {
      liquid_cash: Number(report.key_metrics?.liquid_cash || 0),
      inventory_cost: Number(report.key_metrics?.inventory_cost || 0),
      receivables: Number(report.key_metrics?.receivables || 0),
      payables: Number(report.key_metrics?.payables || 0),
      loan_principal: Number(report.key_metrics?.loan_principal || 0),
      estimated_net_position: Number(report.key_metrics?.estimated_net_position || 0),
    },
    cash_flow_analysis: {
      today: {
        available: Number(report.cash_flow_analysis?.today?.available || 0),
        incoming: Number(report.cash_flow_analysis?.today?.incoming || 0),
        outgoing: Number(report.cash_flow_analysis?.today?.outgoing || 0),
        surplus_or_gap: Number(report.cash_flow_analysis?.today?.surplus_or_gap || 0),
        status: report.cash_flow_analysis?.today?.status || "balanced",
        explanation: String(report.cash_flow_analysis?.today?.explanation || ""),
      },
      next_3_days: {
        available: Number(report.cash_flow_analysis?.next_3_days?.available || 0),
        incoming: Number(report.cash_flow_analysis?.next_3_days?.incoming || 0),
        outgoing: Number(report.cash_flow_analysis?.next_3_days?.outgoing || 0),
        surplus_or_gap: Number(report.cash_flow_analysis?.next_3_days?.surplus_or_gap || 0),
        status: report.cash_flow_analysis?.next_3_days?.status || "balanced",
        explanation: String(report.cash_flow_analysis?.next_3_days?.explanation || ""),
      },
      next_7_days: {
        available: Number(report.cash_flow_analysis?.next_7_days?.available || 0),
        incoming: Number(report.cash_flow_analysis?.next_7_days?.incoming || 0),
        outgoing: Number(report.cash_flow_analysis?.next_7_days?.outgoing || 0),
        surplus_or_gap: Number(report.cash_flow_analysis?.next_7_days?.surplus_or_gap || 0),
        status: report.cash_flow_analysis?.next_7_days?.status || "balanced",
        explanation: String(report.cash_flow_analysis?.next_7_days?.explanation || ""),
      },
    },
    alerts: Array.isArray(report.alerts) ? report.alerts : [],
    priority_actions: {
      within_24_hours: Array.isArray(report.priority_actions?.within_24_hours) ? report.priority_actions.within_24_hours : [],
      within_3_days: Array.isArray(report.priority_actions?.within_3_days) ? report.priority_actions.within_3_days : [],
      within_7_days: Array.isArray(report.priority_actions?.within_7_days) ? report.priority_actions.within_7_days : [],
    },
    receivable_actions: Array.isArray(report.receivable_actions) ? report.receivable_actions : [],
    inventory_actions: Array.isArray(report.inventory_actions) ? report.inventory_actions : [],
    payment_plan: Array.isArray(report.payment_plan) ? report.payment_plan : [],
    scenarios: {
      safe: report.scenarios?.safe || {},
      balanced: report.scenarios?.balanced || {},
      growth: report.scenarios?.growth || {},
    },
    questions_for_owner: Array.isArray(report.questions_for_owner) ? report.questions_for_owner : [],
    data_issues: Array.isArray(report.data_issues) ? report.data_issues : [],
    disclaimer: String(report.disclaimer || "Báo cáo được tạo từ dữ liệu hệ thống cung cấp và chỉ mang tính hỗ trợ ra quyết định. Mọi giao dịch cần được chủ cửa hàng kiểm tra và phê duyệt."),
  }
}

export async function generateCashFlowAiReport(data: CashFlowDashboardData, reportDate: string): Promise<{
  report: CashFlowAiReport | null
  model: string
  error?: string
}> {
  const model = getDefaultGeminiModel()
  const ai = getGeminiClient()
  const input = buildAiInput(data, reportDate)

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: `${PROMPT_RULES}\n\nDỮ LIỆU ĐẦU VÀO:\n${JSON.stringify(input)}` },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "text/plain",
      },
    })

    const raw = String(response.text || "").trim()
    const jsonText = extractJsonObject(raw)
    const parsed = safeJsonParse<CashFlowAiReport>(jsonText)

    if (!parsed) {
      return {
        report: null,
        model,
        error: "Gemini trả về nội dung không parse được thành JSON.",
      }
    }

    return {
      report: normalizeAiReport(parsed, reportDate),
      model,
    }
  } catch (error) {
    return {
      report: null,
      model,
      error: error instanceof Error ? error.message : "Không thể tạo báo cáo Gemini",
    }
  }
}
