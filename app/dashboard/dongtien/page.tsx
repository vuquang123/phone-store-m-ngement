"use client"

import { type ComponentType, type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  CalendarClock,
  Coins,
  Landmark,
  Loader2,
  ShieldAlert,
  Wallet,
} from "lucide-react"
import {
  LineChart,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts"
import { ProtectedRoute, getAuthHeaders } from "@/components/auth/protected-route"
import { useAuthMe } from "@/hooks/use-auth-me"
import { useToast } from "@/hooks/use-toast"
import { OtpGate } from "@/components/dongtien/otp-gate"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import type { CashFlowDashboardData, DepositOrderSummary, LedgerTransaction, Receivable } from "@/lib/cash-flow/types"
import { clearOtpSession, readOtpSession, saveOtpSession } from "@/lib/cash-flow/otp-session"

const ALLOWED_EMAIL = "dung8ahxh@gmail.com"

const fmt = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} ₫`
const fmtShort = (value: number) => `${(value / 1000000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`
const pct = (value: number, total: number) => total <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / total) * 100)))

type ApiResponse = { success: true; data: CashFlowDashboardData } | { error: string }

type ReceivableDraft = {
  counterparty: string
  phone: string
  description: string
  totalAmount: string
  dueDate: string
  collectability: string
  note: string
  collectAmount: string
  collectAccountId: string
  collectNote: string
}

type PayableDraft = {
  creditor: string
  type: string
  description: string
  principalAmount: string
  dueDate: string
  priority: string
  note: string
  payAmount: string
  payAccountId: string
  payNote: string
}

type LongTermDebtDraft = {
  creditor: string
  description: string
  principalAmount: string
  dueDate: string
  priority: string
  note: string
  payAmount: string
  payNote: string
}

export default function DongTienPage() {
  const router = useRouter()
  const { me, isLoading: authLoading } = useAuthMe()
  const { toast } = useToast()
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [data, setData] = useState<CashFlowDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  const [accountDrafts, setAccountDrafts] = useState<Record<string, string>>({})
  const [accountForm, setAccountForm] = useState({ name: "", type: "cash", balance: "0", availability: "AVAILABLE", note: "" })
  const [receivableForm, setReceivableForm] = useState({ counterparty: "", phone: "", description: "", totalAmount: "", dueDate: "", collectability: "medium", note: "" })
  const [payableForm, setPayableForm] = useState({ creditor: "", type: "external_debt", description: "", principalAmount: "", dueDate: "", priority: "medium", note: "" })
  const [longTermDebtForm, setLongTermDebtForm] = useState({ creditor: "", description: "", principalAmount: "", dueDate: "", priority: "medium", note: "" })

  const handleOtpExpired = () => {
    clearOtpSession()
    setOtpCode("")
    setOtpVerified(false)
    setData(null)
  }

  const loadData = async (opts?: { forceSync?: boolean; otp?: string }) => {
    const otp = opts?.otp || otpCode
    if (!otp) return
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch(`/api/dongtien${opts?.forceSync ? "?forceSync=1" : ""}`, {
        cache: "no-store",
        headers: {
          ...getAuthHeaders(),
          "x-dongtien-otp": otp,
        },
      })
      if (res.status === 401) {
        handleOtpExpired()
        return
      }
      const json = await res.json() as ApiResponse
      if (!res.ok || !("success" in json)) throw new Error("error" in json ? json.error : "Không tải được dữ liệu")
      setData(json.data)
      setAccountDrafts(Object.fromEntries(json.data.accounts.map((item) => [item.id, String(item.balance)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu dòng tiền")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!me?.email) return
    const stored = readOtpSession(me.email)
    if (stored) {
      setOtpCode(stored)
      setOtpVerified(true)
    }
  }, [me?.email])

  useEffect(() => {
    if (authLoading) return
    if (!me) return
    if (me.role !== "quan_ly" || me.email !== ALLOWED_EMAIL) {
      router.replace("/dashboard")
      return
    }
    if (!otpVerified) {
      setIsLoading(false)
      return
    }
    loadData()
  }, [authLoading, me, otpVerified, router])

  const onVerified = (otp: string) => {
    if (!me?.email) return
    saveOtpSession(me.email, otp)
    setOtpCode(otp)
    setOtpVerified(true)
  }

  const submitAction = async (payload: Record<string, any>) => {
    try {
      setSubmitting(true)
      const res = await fetch("/api/dongtien", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
          "x-dongtien-otp": otpCode,
        },
        body: JSON.stringify(payload),
      })
      if (res.status === 401) {
        handleOtpExpired()
        return
      }
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || "Không lưu được dữ liệu")
      setData(json.data)
      setAccountDrafts(Object.fromEntries((json.data.accounts || []).map((item: any) => [item.id, String(item.balance)])))
      setAccountForm({ name: "", type: "cash", balance: "0", availability: "AVAILABLE", note: "" })
      setReceivableForm({ counterparty: "", phone: "", description: "", totalAmount: "", dueDate: "", collectability: "medium", note: "" })
      setPayableForm({ creditor: "", type: "external_debt", description: "", principalAmount: "", dueDate: "", priority: "medium", note: "" })
      setLongTermDebtForm({ creditor: "", description: "", principalAmount: "", dueDate: "", priority: "medium", note: "" })
      const actionLabels: Record<string, string> = {
        create_account: "Đã thêm nguồn tiền",
        update_account: "Đã cập nhật số dư",
        create_receivable: "Đã thêm công nợ phải thu",
        update_receivable: "Đã cập nhật công nợ phải thu",
        delete_receivable: "Đã xóa công nợ phải thu",
        collect_receivable: "Đã ghi nhận thu nợ",
        create_payable: "Đã thêm khoản phải trả",
        update_payable: "Đã cập nhật khoản phải trả",
        delete_payable: "Đã xóa khoản phải trả",
        pay_payable: "Đã ghi nhận trả nợ",
        create_long_term_debt: "Đã thêm nợ dài hạn",
        update_long_term_debt: "Đã cập nhật nợ dài hạn",
        delete_long_term_debt: "Đã xóa nợ dài hạn",
        pay_long_term_debt: "Đã ghi nhận trả nợ dài hạn từ quỹ lãi",
      }
      toast({
        title: "Thành công",
        description: actionLabels[String(payload.action || "")] || "Đã cập nhật dòng tiền",
        variant: "success" as any,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không lưu được dữ liệu"
      setError(message)
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const createReportNow = async () => {
    try {
      setCreatingReport(true)
      setError("")
      const slug = `bao-cao-${DateTime.now().setZone("Asia/Ho_Chi_Minh").setLocale("en").toFormat("ddLLLyyyy")}`
      const res = await fetch(`/api/dongtien?reportSlug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
        headers: {
          ...getAuthHeaders(),
          "x-dongtien-otp": otpCode,
        },
      })
      if (res.status === 401) {
        handleOtpExpired()
        return
      }
      const json = await res.json() as { success?: boolean; report?: { slug?: string }; error?: string }
      if (!res.ok || !json?.success || !json.report?.slug) {
        throw new Error(json?.error || "Không tạo được báo cáo dòng tiền")
      }
      toast({
        title: "Thành công",
        description: `Đã tạo báo cáo ${json.report.slug}`,
        variant: "success" as any,
      })
      router.push(`/dashboard/dongtien/${json.report.slug}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không tạo được báo cáo dòng tiền"
      setError(message)
      toast({
        title: "Lỗi",
        description: message,
        variant: "destructive",
      })
    } finally {
      setCreatingReport(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <ProtectedRoute requiredRole="quan_ly">
        <div className="flex min-h-[70vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRole="quan_ly">
      {!otpVerified ? (
        <OtpGate onVerified={onVerified} />
      ) : !data ? (
        <div className="mx-auto w-full max-w-[calc(100vw-2rem)] px-1 py-4">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Không thể mở module Dòng tiền</AlertTitle>
            <AlertDescription>{error || "Dữ liệu chưa sẵn sàng."}</AlertDescription>
          </Alert>
        </div>
      ) : (
        <CashFlowDashboard
          data={data}
          error={error}
          onReload={() => loadData({ forceSync: true })}
          submitting={submitting}
          creatingReport={creatingReport}
          accountDrafts={accountDrafts}
          setAccountDrafts={setAccountDrafts}
          accountForm={accountForm}
          setAccountForm={setAccountForm}
          receivableForm={receivableForm}
          setReceivableForm={setReceivableForm}
          payableForm={payableForm}
          setPayableForm={setPayableForm}
          longTermDebtForm={longTermDebtForm}
          setLongTermDebtForm={setLongTermDebtForm}
          onSubmitAction={submitAction}
          onCreateReportNow={createReportNow}
        />
      )}
    </ProtectedRoute>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  onViewDetail,
}: {
  title: string
  value: string
  description: string
  icon: ComponentType<{ className?: string }>
  onViewDetail?: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {onViewDetail ? (
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={onViewDetail}>
              Xem chi tiết
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function CashFlowDashboard({
  data,
  error,
  onReload,
  submitting,
  creatingReport,
  accountDrafts,
  setAccountDrafts,
  accountForm,
  setAccountForm,
  receivableForm,
  setReceivableForm,
  payableForm,
  setPayableForm,
  longTermDebtForm,
  setLongTermDebtForm,
  onSubmitAction,
  onCreateReportNow,
}: {
  data: CashFlowDashboardData
  error: string
  onReload: () => Promise<void>
  submitting: boolean
  creatingReport: boolean
  accountDrafts: Record<string, string>
  setAccountDrafts: Dispatch<SetStateAction<Record<string, string>>>
  accountForm: { name: string; type: string; balance: string; availability: string; note: string }
  setAccountForm: Dispatch<SetStateAction<{ name: string; type: string; balance: string; availability: string; note: string }>>
  receivableForm: { counterparty: string; phone: string; description: string; totalAmount: string; dueDate: string; collectability: string; note: string }
  setReceivableForm: Dispatch<SetStateAction<{ counterparty: string; phone: string; description: string; totalAmount: string; dueDate: string; collectability: string; note: string }>>
  payableForm: { creditor: string; type: string; description: string; principalAmount: string; dueDate: string; priority: string; note: string }
  setPayableForm: Dispatch<SetStateAction<{ creditor: string; type: string; description: string; principalAmount: string; dueDate: string; priority: string; note: string }>>
  longTermDebtForm: { creditor: string; description: string; principalAmount: string; dueDate: string; priority: string; note: string }
  setLongTermDebtForm: Dispatch<SetStateAction<{ creditor: string; description: string; principalAmount: string; dueDate: string; priority: string; note: string }>>
  onSubmitAction: (payload: Record<string, any>) => Promise<void>
  onCreateReportNow: () => Promise<void>
}) {
  const { overview, alerts, accounts, transactions, profitFundEntries, longTermDebts, depositOrders, inventoryItems, receivables, payables, plan, paymentSuggestions, scenarios } = data
  const countedInventory = inventoryItems.filter((item) => item.status === "IN_STOCK" || item.status === "IN_STOCK_RETURNED")
  const availableAccounts = useMemo(() => accounts.filter((item) => item.availability === "AVAILABLE"), [accounts])
  const bankAccount = useMemo(() => accounts.find((item) => item.type === "bank") || availableAccounts[0] || null, [accounts, availableAccounts])
  const pendingSettlementReceivables = useMemo(
    () => receivables.filter((item) => {
      const remaining = item.totalAmount - item.collectedAmount
      return remaining > 0 && (item.autoRefType === "order_card" || item.autoRefType === "order_installment")
    }),
    [receivables],
  )
  const businessReceivables = useMemo(
    () => receivables.filter((item) => item.autoRefType !== "order_card" && item.autoRefType !== "order_installment"),
    [receivables],
  )
  const visibleReceivables = useMemo(
    () => businessReceivables.filter((item) => item.totalAmount - item.collectedAmount > 0),
    [businessReceivables],
  )
  const businessReceivablesTotal = useMemo(
    () => visibleReceivables.reduce((sum, item) => sum + Math.max(0, item.totalAmount - item.collectedAmount), 0),
    [visibleReceivables],
  )
  const pendingCardReceivables = useMemo(
    () => pendingSettlementReceivables.filter((item) => item.autoRefType === "order_card"),
    [pendingSettlementReceivables],
  )
  const pendingInstallmentReceivables = useMemo(
    () => pendingSettlementReceivables.filter((item) => item.autoRefType === "order_installment"),
    [pendingSettlementReceivables],
  )
  const pendingCardTotal = useMemo(
    () => pendingCardReceivables.reduce((sum, item) => sum + Math.max(0, item.totalAmount - item.collectedAmount), 0),
    [pendingCardReceivables],
  )
  const pendingInstallmentTotal = useMemo(
    () => pendingInstallmentReceivables.reduce((sum, item) => sum + Math.max(0, item.totalAmount - item.collectedAmount), 0),
    [pendingInstallmentReceivables],
  )
  const due3Total = overview.overduePayables + overview.dueToday + overview.dueIn3Days
  const asOfDt = DateTime.fromISO(overview.asOfDate)
  const asOfLabel = asOfDt.isValid ? asOfDt.toFormat("dd/MM/yyyy") : overview.asOfDate
  const due3RangeLabel = asOfDt.isValid
    ? `${asOfDt.plus({ days: 1 }).toFormat("dd/MM")} đến ${asOfDt.plus({ days: 3 }).toFormat("dd/MM/yyyy")}`
    : "3 ngày tới"
  const visiblePayables = useMemo(() => payables.filter((item) => item.principalAmount - item.paidAmount > 0), [payables])
  const suggestionMap = useMemo(() => new Map(paymentSuggestions.map((item) => [item.payableId, item])), [paymentSuggestions])
  const [receivableDrafts, setReceivableDrafts] = useState<Record<string, ReceivableDraft>>({})
  const [payableDrafts, setPayableDrafts] = useState<Record<string, PayableDraft>>({})
  const [longTermDebtDrafts, setLongTermDebtDrafts] = useState<Record<string, LongTermDebtDraft>>({})
  const [selectedPayableId, setSelectedPayableId] = useState("")
  const [selectedLongTermDebtId, setSelectedLongTermDebtId] = useState("")
  const [detailView, setDetailView] = useState<"cash" | "inventory" | "deposit" | "receivable" | "payable" | null>(null)

  useEffect(() => {
    const defaultAccountId = availableAccounts[0]?.id || ""
    setReceivableDrafts(
      Object.fromEntries(receivables.map((item) => [
        item.id,
        {
          counterparty: item.counterparty,
          phone: item.phone,
          description: item.description,
          totalAmount: String(item.totalAmount || 0),
          dueDate: item.dueDate,
          collectability: item.collectability,
          note: item.note || "",
          collectAmount: String(Math.max(0, item.totalAmount - item.collectedAmount) || ""),
          collectAccountId: defaultAccountId,
          collectNote: "",
        },
      ])),
    )
  }, [receivables, availableAccounts])

  useEffect(() => {
    const defaultAccountId = availableAccounts[0]?.id || ""
    setPayableDrafts(
      Object.fromEntries(payables.map((item) => [
        item.id,
        {
          creditor: item.creditor,
          type: item.type,
          description: item.description,
          principalAmount: String(item.principalAmount || 0),
          dueDate: item.dueDate,
          priority: item.priority,
          note: item.note || "",
          payAmount: String(Math.max(0, item.principalAmount - item.paidAmount) || ""),
          payAccountId: defaultAccountId,
          payNote: "",
        },
      ])),
    )
  }, [payables, availableAccounts])

  useEffect(() => {
    setLongTermDebtDrafts(
      Object.fromEntries(longTermDebts.map((item) => [
        item.id,
        {
          creditor: item.creditor,
          description: item.description,
          principalAmount: String(item.principalAmount || 0),
          dueDate: item.dueDate,
          priority: item.priority,
          note: item.note || "",
          payAmount: String(Math.max(0, item.principalAmount - item.paidAmount) || ""),
          payNote: "",
        },
      ])),
    )
  }, [longTermDebts])

  useEffect(() => {
    if (!visiblePayables.length) {
      setSelectedPayableId("")
      return
    }
    if (!visiblePayables.some((item) => item.id === selectedPayableId)) {
      setSelectedPayableId(visiblePayables[0]?.id || "")
    }
  }, [visiblePayables, selectedPayableId])

  useEffect(() => {
    const visible = longTermDebts.filter((item) => item.principalAmount - item.paidAmount > 0)
    if (!visible.length) {
      setSelectedLongTermDebtId("")
      return
    }
    if (!visible.some((item) => item.id === selectedLongTermDebtId)) {
      setSelectedLongTermDebtId(visible[0]?.id || "")
    }
  }, [longTermDebts, selectedLongTermDebtId])

  const earliestNegativeRow = useMemo(() => plan.find((row) => row.isNegative) || null, [plan])
  const totalUpcomingInflows = useMemo(
    () => plan.reduce((sum, row) => sum + row.receivableInflow + row.salesInflow + row.otherInflow, 0),
    [plan],
  )
  const totalUpcomingOutflows = useMemo(
    () => plan.reduce((sum, row) => sum + row.externalDebtOutflow + row.inventoryOutflow + row.loanOutflow + row.interestOutflow + row.operatingOutflow, 0),
    [plan],
  )

  const cashTransactions = useMemo(
    () => transactions.filter((item) =>
      ["sale_cash", "sale_transfer", "sale_cod", "receivable_collection", "payable_payment"].includes(item.type),
    ),
    [transactions],
  )
  const receivableTransactions = useMemo(
    () => transactions.filter((item) => item.type === "receivable_collection"),
    [transactions],
  )
  const payableTransactions = useMemo(
    () => transactions.filter((item) => item.type === "payable_payment"),
    [transactions],
  )

  return (
    <div className="mx-auto w-full max-w-[calc(100vw-2rem)] space-y-4 overflow-x-hidden px-1 pb-4">
      {error ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Lưu ý</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => onCreateReportNow()} disabled={submitting || creatingReport}>
          {creatingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Tạo báo cáo ngay
        </Button>
        <Button variant="outline" onClick={() => onReload()} disabled={submitting || creatingReport}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Đồng bộ lại từ sheet
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tiền mặt và tài khoản" value={fmt(overview.cashOnHand)} description="Chỉ tính nguồn AVAILABLE" icon={Wallet} onViewDetail={() => setDetailView("cash")} />
        <StatCard title="Giá trị hàng tồn" value={fmt(overview.inventoryValue)} description={`Chưa gồm máy đang cọc • Bán nhanh ${fmt(overview.inventoryQuickSaleValue)}`} icon={Boxes} onViewDetail={() => setDetailView("inventory")} />
        <StatCard title="Máy đang đặt cọc" value={fmt(overview.activeDepositCollected)} description={`${overview.activeDepositOrders} đơn • Giá nhập giữ chỗ ${fmt(overview.activeDepositInventoryValue)}`} icon={Boxes} onViewDetail={() => setDetailView("deposit")} />
        <StatCard title="Công nợ phải thu" value={fmt(businessReceivablesTotal)} description={`Sau thu toàn bộ công nợ + COD chờ: ${fmt(overview.projectedCashAfterReceivables)}`} icon={ArrowDownCircle} onViewDetail={() => setDetailView("receivable")} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tổng nợ phải trả" value={fmt(overview.totalPayables)} description={`Tổng tài sản ngắn hạn: ${fmt(overview.totalShortTermAssets)}`} icon={ArrowUpCircle} onViewDetail={() => setDetailView("payable")} />
        <StatCard
          title="Phải trả hôm nay"
          value={fmt(overview.dueToday)}
          description={`Khoản đến hạn ngày ${asOfLabel}${overview.overduePayables > 0 ? ` • Quá hạn còn ${fmt(overview.overduePayables)}` : ""}`}
          icon={CalendarClock}
        />
        <StatCard title="Phải trả 3 ngày tới" value={fmt(overview.dueIn3Days)} description={`Các khoản từ ${due3RangeLabel}`} icon={AlertTriangle} />
        <StatCard title="COD chờ đối soát" value={fmt(overview.codPending3Days)} description={`${overview.codPendingOrders} đơn GHTK chưa đối soát`} icon={Landmark} />
      </div>

      <Dialog open={detailView !== null} onOpenChange={(open) => !open ? setDetailView(null) : null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {detailView === "cash" ? "Chi tiết tiền mặt và tài khoản" : null}
              {detailView === "inventory" ? "Chi tiết giá trị hàng tồn" : null}
              {detailView === "deposit" ? "Chi tiết máy đang đặt cọc" : null}
              {detailView === "receivable" ? "Chi tiết công nợ phải thu" : null}
              {detailView === "payable" ? "Chi tiết nợ phải trả" : null}
            </DialogTitle>
            <DialogDescription>
              {detailView === "cash" ? "Xem nhanh nguồn tiền khả dụng và lịch sử giao dịch thu chi gần nhất." : null}
              {detailView === "inventory" ? "Danh sách máy đang góp vào giá trị hàng tồn hiện tại, không gồm máy đang ở Dat_Coc." : null}
              {detailView === "deposit" ? "Máy đang nằm trong Dat_Coc, chưa được xem là đã bán hẳn vì có thể hoàn cọc hoặc thanh toán đủ sau." : null}
              {detailView === "receivable" ? "Các khoản còn phải thu và lịch sử ghi nhận thu nợ." : null}
              {detailView === "payable" ? "Các khoản còn phải trả và lịch sử ghi nhận chi trả." : null}
            </DialogDescription>
          </DialogHeader>

          {detailView === "cash" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-xl border p-3">
                    <p className="font-medium">{account.name}</p>
                    <p className="mt-1 text-lg font-semibold">{fmt(account.balance)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{account.type} • {account.availability}</p>
                  </div>
                ))}
                {overview.activeDepositCollected > 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="font-medium">Tiền cọc đang giữ</p>
                    <p className="mt-1 text-lg font-semibold">{fmt(overview.activeDepositCollected)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Theo dõi riêng — chỉ vào tổng khi bạn tự cộng vào nguồn tiền</p>
                  </div>
                ) : null}
              </div>
              <TransactionList transactions={cashTransactions} emptyText="Chưa có lịch sử thu chi." />
            </div>
          ) : null}

          {detailView === "inventory" ? (
            <div className="space-y-3">
              {countedInventory.length ? countedInventory.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{item.model || "Chưa rõ tên máy"}</p>
                    <p className="text-sm text-muted-foreground">{[item.color, item.capacity, item.imei || item.code].filter(Boolean).join(" • ")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.condition || "Không có ghi chú tình trạng"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Giá nhập: {fmt(item.costPrice)}</p>
                    <p className="text-sm text-muted-foreground">Bán nhanh: {fmt(item.quickSalePrice)}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Không có hàng tồn đang tham gia tính giá trị.</div>
              )}
            </div>
          ) : null}

          {detailView === "deposit" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Đã nhận cọc</p>
                  <p className="mt-2 text-2xl font-bold">{fmt(overview.activeDepositCollected)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Còn phải thu nếu chốt bán</p>
                  <p className="mt-2 text-2xl font-bold">{fmt(overview.activeDepositRemaining)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Giá nhập máy đang cọc</p>
                  <p className="mt-2 text-2xl font-bold">{fmt(overview.activeDepositInventoryValue)}</p>
                </div>
              </div>
              <div className="space-y-3">
                {depositOrders.length ? depositOrders.map((order) => (
                  <DepositOrderCard key={order.id} order={order} />
                )) : (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Hiện không có đơn đặt cọc nào đang mở.</div>
                )}
              </div>
            </div>
          ) : null}

          {detailView === "receivable" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {visibleReceivables.length ? visibleReceivables.map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{item.counterparty}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Hẹn thu: {item.dueDate} • Đã thu: {fmt(item.collectedAmount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">Còn lại: {fmt(item.totalAmount - item.collectedAmount)}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Không còn khoản phải thu nào chưa thu đủ.</div>
                )}
              </div>
              <TransactionList transactions={receivableTransactions} emptyText="Chưa có lịch sử thu nợ." />
            </div>
          ) : null}

          {detailView === "payable" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {visiblePayables.length ? visiblePayables.map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{item.creditor}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Đến hạn: {item.dueDate} • Đã trả: {fmt(item.paidAmount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">Còn phải trả: {fmt(item.principalAmount - item.paidAmount)}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Không còn khoản phải trả nào chưa tất toán.</div>
                )}
              </div>
              <TransactionList transactions={payableTransactions} emptyText="Chưa có lịch sử chi trả." />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Số dư dự kiến cuối kỳ" value={fmt(overview.projectedEndingBalance)} description={`COD đã đối soát (cộng thủ công khi tiền về): ${fmt(overview.codReconciledInCash)}`} icon={Coins} />
        <StatCard title="Lãi tích lũy từ 16/07" value={fmt(overview.realizedProfitSinceStart)} description="Tự đồng bộ từ cột Lãi của Ban_Hang" icon={Coins} />
        <StatCard title="Quỹ lãi còn lại" value={fmt(overview.profitFundBalance)} description="Dùng riêng để trả nợ dài hạn" icon={Wallet} />
        <StatCard title="Nợ dài hạn còn lại" value={fmt(overview.longTermDebtRemaining)} description={`Tổng nợ dài hạn ${fmt(overview.longTermDebtTotal)}`} icon={CalendarClock} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="order-2 xl:order-1">
          <CardHeader>
            <CardTitle>Nhịp dòng tiền 7 ngày</CardTitle>
            <CardDescription>Ưu tiên nhìn nhanh trạng thái thu vào, chi ra và ngày bắt đầu thiếu hụt nếu có.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tổng thu dự kiến</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-400">{fmt(totalUpcomingInflows)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Gồm công nợ, bán hàng và các khoản thu khác trong 7 ngày tới.</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tổng chi dự kiến</p>
                <p className="mt-2 text-2xl font-semibold text-red-400">{fmt(totalUpcomingOutflows)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Gồm nợ ngoài, nợ hàng, chi phí vận hành và lãi phải trả.</p>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 ${earliestNegativeRow ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{earliestNegativeRow ? "Mốc thiếu hụt đầu tiên" : "Trạng thái 7 ngày tới"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {earliestNegativeRow
                      ? "Nếu không có thêm thu vào hoặc giãn lịch trả, đây là ngày số dư bắt đầu âm."
                      : "Hiện mô phỏng chưa xuất hiện ngày âm trong 7 ngày tới."}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className={`text-2xl font-semibold ${earliestNegativeRow ? "text-red-400" : "text-emerald-400"}`}>
                    {earliestNegativeRow ? earliestNegativeRow.date : "Ổn định"}
                  </p>
                  {earliestNegativeRow ? (
                    <p className="text-xs text-muted-foreground">Âm {fmt(Math.abs(earliestNegativeRow.closingBalance))}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {plan.slice(0, 4).map((row) => (
                <div key={row.date} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{row.date.slice(5)}</p>
                    <p className="text-[11px] text-muted-foreground">Đầu kỳ {fmtShort(row.openingBalance)}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${row.isNegative ? "bg-red-500" : row.netCashFlow >= 0 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.max(12, Math.min(100, Math.round((Math.abs(row.netCashFlow) / Math.max(1, totalUpcomingOutflows || totalUpcomingInflows || 1)) * 100)))}%` }}
                    />
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${row.netCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(row.netCashFlow)}</p>
                    <p className="text-[11px] text-muted-foreground">Cuối {fmtShort(row.closingBalance)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="order-1 xl:order-2">
          <CardHeader>
            <CardTitle>Thanh khoản và quỹ an toàn</CardTitle>
            <CardDescription>
              Tiền có thể chi sau khi trừ quỹ an toàn {fmt(overview.safeReserve)}. COD GHTK chỉ hiển thị để tính phương án — bạn tự cộng vào nguồn tiền khi GHTK báo tiền về.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Tiền có thể chi</span>
                <span className="font-semibold">{fmt(overview.spendableCash)}</span>
              </div>
              <Progress value={pct(overview.spendableCash, overview.cashOnHand)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-xs text-emerald-100/80">COD đã đối soát</p>
                <p className="mt-1 text-lg font-semibold text-emerald-100">{fmt(overview.codReconciledInCash)}</p>
                <p className="mt-1 text-xs text-emerald-100/70">{overview.codReconciledOrders} đơn GHTK báo đã đối soát • cộng thủ công khi tiền về</p>
              </div>
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
                <p className="text-xs text-sky-100/80">COD có thể thu trong 3 ngày</p>
                <p className="mt-1 text-lg font-semibold text-sky-100">{fmt(overview.codPending3Days)}</p>
                <p className="mt-1 text-xs text-sky-100/70">{overview.codPendingOrders} đơn GHTK chưa đối soát • chỉ dùng để tính phương án</p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-100">Đơn cọc đang mở</p>
                  <p className="mt-1 text-xs text-amber-100/75">
                    Máy trong `Dat_Coc` chưa được xem là đã bán hẳn. Chỉ khi thanh toán đủ và đi vào `Ban_Hang` mới tính là bán.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300/30 bg-transparent text-amber-50 hover:bg-amber-50/10 hover:text-amber-50"
                  onClick={() => setDetailView("deposit")}
                >
                  Xem máy cọc
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-amber-300/20 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Đã nhận cọc</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-50">{fmt(overview.activeDepositCollected)}</p>
                  <p className="mt-1 text-xs text-amber-100/70">{overview.activeDepositOrders} đơn đang giữ chỗ</p>
                </div>
                <div className="rounded-xl border border-amber-300/20 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Còn phải thu nếu chốt bán</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-50">{fmt(overview.activeDepositRemaining)}</p>
                  <p className="mt-1 text-xs text-amber-100/70">Không cộng vào doanh thu bán cho tới khi thanh toán đủ</p>
                </div>
                <div className="rounded-xl border border-amber-300/20 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Giá nhập máy đang giữ chỗ</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-50">{fmt(overview.activeDepositInventoryValue)}</p>
                  <p className="mt-1 text-xs text-amber-100/70">Đang theo dõi riêng, không gộp vào card hàng tồn</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-violet-100">Pending thẻ và trả góp</p>
                  <p className="mt-1 text-xs text-violet-100/75">
                    Khi tiền thực nhận về tài khoản, bấm `Đã nhận` để cộng vào nguồn tiền `Tiền tài khoản`.
                  </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs text-violet-100/75">Tổng pending</p>
                  <p className="text-xl font-semibold text-violet-100 sm:text-2xl">{fmt(pendingCardTotal + pendingInstallmentTotal)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <PendingSettlementBlock
                  title="Thẻ"
                  total={pendingCardTotal}
                  items={pendingCardReceivables}
                  submitting={submitting}
                  bankAccountName={bankAccount?.name || "Tiền tài khoản"}
                  onConfirm={(item) => onSubmitAction({
                    action: "collect_receivable",
                    id: item.id,
                    amount: Math.max(0, item.totalAmount - item.collectedAmount),
                    accountId: item.accountId || bankAccount?.id || "",
                    note: `Đã nhận tiền thẻ ${item.description}`,
                  })}
                />
                <PendingSettlementBlock
                  title="Trả góp"
                  total={pendingInstallmentTotal}
                  items={pendingInstallmentReceivables}
                  submitting={submitting}
                  bankAccountName={bankAccount?.name || "Tiền tài khoản"}
                  onConfirm={(item) => onSubmitAction({
                    action: "collect_receivable",
                    id: item.id,
                    amount: Math.max(0, item.totalAmount - item.collectedAmount),
                    accountId: item.accountId || bankAccount?.id || "",
                    note: `Đã nhận tiền trả góp ${item.description}`,
                  })}
                />
              </div>
            </div>
            <div className={`rounded-xl border p-4 ${overview.shortageForUpcomingDues > 0 ? "border-amber-500/20 bg-amber-500/10" : "border-emerald-500/20 bg-emerald-500/10"}`}>
              <p className={`text-sm font-medium ${overview.shortageForUpcomingDues > 0 ? "text-amber-200" : "text-emerald-200"}`}>
                {due3Total > 0 ? "Thiếu hụt cho quá hạn + 3 ngày tới" : "Trạng thái 3 ngày tới"}
              </p>
              <p className={`mt-2 text-2xl font-bold ${overview.shortageForUpcomingDues > 0 ? "text-amber-100" : "text-emerald-100"}`}>
                {due3Total > 0 ? fmt(overview.shortageForUpcomingDues) : "Ổn định"}
              </p>
              <p className={`mt-1 text-xs ${overview.shortageForUpcomingDues > 0 ? "text-amber-100/80" : "text-emerald-100/80"}`}>
                {due3Total <= 0
                  ? "Hiện chưa có khoản phải trả nào trong 3 ngày tới."
                  : overview.shortageForUpcomingDues > 0
                    ? "Hệ thống đã cộng cả công nợ sắp thu và COD GHTK chưa đối soát; nếu vẫn thiếu thì nên đẩy hàng tồn hoặc giãn nợ."
                    : "Dòng tiền 3 ngày tới đang đủ sau khi tính cả công nợ và COD GHTK chờ đối soát."}
              </p>
            </div>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Hàng tồn trên 30 ngày</p>
                <p className="mt-1 text-lg font-semibold">{overview.inventoryAging.over30Days} máy</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Hàng tồn trên 60 ngày</p>
                <p className="mt-1 text-lg font-semibold">{overview.inventoryAging.over60Days} máy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            variant={alert.level === "danger" ? "destructive" : "default"}
            className={
              alert.level === "warning"
                ? "border-amber-500/30 bg-amber-500/10"
                : alert.level === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : ""
            }
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription>
              {alert.description}
              {typeof alert.amount === "number" && alert.amount > 0 ? ` (${fmt(alert.amount)})` : ""}
            </AlertDescription>
          </Alert>
        ))}
      </div>

      <Tabs defaultValue="tong-quan" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="tong-quan">Tổng quan</TabsTrigger>
          <TabsTrigger value="nguon-tien">Nguồn tiền</TabsTrigger>
          <TabsTrigger value="quy-lai">Quỹ lãi</TabsTrigger>
          <TabsTrigger value="cong-no">Phải thu</TabsTrigger>
          <TabsTrigger value="phai-tra">Phải trả</TabsTrigger>
          <TabsTrigger value="no-dai-han">Nợ dài hạn</TabsTrigger>
          <TabsTrigger value="ke-hoach">Kế hoạch</TabsTrigger>
          <TabsTrigger value="mo-phong">Mô phỏng</TabsTrigger>
        </TabsList>

        <TabsContent value="tong-quan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cân đối tài sản và nghĩa vụ</CardTitle>
              <CardDescription>
                Số liệu thời gian thực tính đến ngày {asOfLabel}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Tài sản ngắn hạn</p>
                <p className="mt-2 text-xl font-bold">{fmt(overview.totalShortTermAssets)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tiền {fmtShort(overview.cashOnHand)} + hàng tồn {fmtShort(overview.inventoryValue)} + phải thu {fmtShort(overview.totalReceivables)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Tổng nghĩa vụ</p>
                <p className="mt-2 text-xl font-bold">{fmt(overview.totalPayables)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Bao gồm nợ ngoài, nợ hàng và mặt bằng</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Dự kiến sau thu nợ</p>
                <p className="mt-2 text-xl font-bold">{fmt(overview.projectedCashAfterReceivables)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Đã cộng công nợ và COD GHTK chưa đối soát, chưa tính hàng tồn</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Số dư cuối cùng</p>
                <p className={`mt-2 text-xl font-bold ${overview.projectedEndingBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(overview.projectedEndingBalance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tài sản ngắn hạn {fmtShort(overview.totalShortTermAssets)} − nghĩa vụ {fmtShort(overview.totalPayables)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ảnh chụp nhanh tồn kho đang tham gia mô phỏng</CardTitle>
              <CardDescription>
                Không tính trùng IMEI đã bán, nhưng có tính máy thu lại với trạng thái `IN_STOCK_RETURNED`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {countedInventory.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{item.model}</p>
                    <p className="text-xs text-muted-foreground">{item.imei} • {item.capacity} • {item.color}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{fmt(item.costPrice)}</p>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nguon-tien" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nguồn tiền khả dụng</CardTitle>
              <CardDescription>Chỉ các nguồn `AVAILABLE` mới được cộng vào dòng tiền thực tế.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-5">
                <div className="md:col-span-2">
                  <Label>Tên nguồn</Label>
                  <Input value={accountForm.name} onChange={(e) => setAccountForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Tiền mặt / Tài khoản ngân hàng..." />
                </div>
                <div>
                  <Label>Loại</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={accountForm.type} onChange={(e) => setAccountForm((prev) => ({ ...prev, type: e.target.value }))}>
                    <option value="cash">Tiền mặt</option>
                    <option value="bank">Ngân hàng</option>
                    <option value="ewallet">Ví điện tử</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <Label>Số dư</Label>
                  <Input value={accountForm.balance} onChange={(e) => setAccountForm((prev) => ({ ...prev, balance: e.target.value.replace(/[^\d]/g, "") }))} />
                </div>
                <div>
                  <Label>Khả dụng</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={accountForm.availability} onChange={(e) => setAccountForm((prev) => ({ ...prev, availability: e.target.value }))}>
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="LOCKED">LOCKED</option>
                  </select>
                </div>
                <div className="md:col-span-4">
                  <Label>Ghi chú</Label>
                  <Input value={accountForm.note} onChange={(e) => setAccountForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Ghi chú nguồn tiền..." />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={submitting || !accountForm.name.trim()}
                    onClick={() => onSubmitAction({
                      action: "create_account",
                      name: accountForm.name,
                      type: accountForm.type,
                      balance: Number(accountForm.balance || 0),
                      availability: accountForm.availability,
                      note: accountForm.note,
                    })}
                  >
                    Thêm nguồn tiền
                  </Button>
                </div>
              </div>
              {accounts.map((account) => {
                const isCashFundAccount = account.id === "acc_cash" || account.name.trim().toLowerCase() === "tiền mặt"
                return (
                  <div key={account.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isCashFundAccount ? "Tự động đồng bộ từ Quỹ tiền mặt" : account.note || "Không có ghi chú"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 lg:items-end">
                        <Badge variant={account.availability === "AVAILABLE" ? "default" : "secondary"}>{account.availability}</Badge>
                        {isCashFundAccount ? (
                          <p className="text-lg font-semibold tabular-nums">{fmt(account.balance)}</p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              className="w-36 text-right"
                              value={accountDrafts[account.id] ?? String(account.balance)}
                              onChange={(e) => setAccountDrafts((prev) => ({ ...prev, [account.id]: e.target.value.replace(/[^\d]/g, "") }))}
                            />
                            <Button
                              size="sm"
                              disabled={submitting}
                              onClick={() => onSubmitAction({
                                action: "update_account",
                                id: account.id,
                                balance: Number(accountDrafts[account.id] || 0),
                              })}
                            >
                              Lưu
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quy-lai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quỹ lãi tích lũy</CardTitle>
              <CardDescription>
                Theo dõi từ ngày 16/07/2026. Mỗi khi đơn bán được ghi vào tab `Ban_Hang`, cột `Lãi` sẽ tự đồng bộ vào đây.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Tổng lãi đã ghi nhận</p>
                  <p className="mt-2 text-2xl font-bold">{fmt(overview.realizedProfitSinceStart)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Đã dùng trả nợ dài hạn</p>
                  <p className="mt-2 text-2xl font-bold">{fmt(Math.max(0, overview.realizedProfitSinceStart - overview.profitFundBalance))}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Quỹ lãi còn lại</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-400">{fmt(overview.profitFundBalance)}</p>
                </div>
              </div>
              <TransactionList
                transactions={profitFundEntries.map((item) => ({
                  id: item.id,
                  type: item.type,
                  amount: item.amount,
                  occurredAt: item.date,
                  accountId: "",
                  accountName: "Quỹ lãi",
                  refType: item.refType,
                  refId: item.refId,
                  counterparty: item.counterparty,
                  source: item.type === "sale_profit" ? "Ban_Hang" : "DongTien",
                  note: item.note,
                  automatic: item.automatic,
                  createdBy: item.createdBy,
                  createdAt: item.createdAt,
                }))}
                emptyText="Chưa có dòng lãi nào được đồng bộ."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cong-no" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Công nợ phải thu</CardTitle>
              <CardDescription>Tổng còn phải thu hiện tại: {fmt(businessReceivablesTotal)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label>Đối tượng</Label>
                  <Input value={receivableForm.counterparty} onChange={(e) => setReceivableForm((prev) => ({ ...prev, counterparty: e.target.value }))} />
                </div>
                <div>
                  <Label>SĐT</Label>
                  <Input value={receivableForm.phone} onChange={(e) => setReceivableForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="xl:col-span-2">
                  <Label>Nội dung</Label>
                  <Input value={receivableForm.description} onChange={(e) => setReceivableForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Số tiền</Label>
                  <Input value={receivableForm.totalAmount} onChange={(e) => setReceivableForm((prev) => ({ ...prev, totalAmount: e.target.value.replace(/[^\d]/g, "") }))} />
                </div>
                <div>
                  <Label>Ngày hẹn thu</Label>
                  <Input type="date" value={receivableForm.dueDate} onChange={(e) => setReceivableForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Khả năng thu</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={receivableForm.collectability} onChange={(e) => setReceivableForm((prev) => ({ ...prev, collectability: e.target.value }))}>
                    <option value="high">Cao</option>
                    <option value="medium">Trung bình</option>
                    <option value="low">Thấp</option>
                  </select>
                </div>
                <div>
                  <Label>Ghi chú</Label>
                  <Input value={receivableForm.note} onChange={(e) => setReceivableForm((prev) => ({ ...prev, note: e.target.value }))} />
                </div>
                <div className="xl:col-span-4">
                  <Button
                    disabled={submitting || !receivableForm.counterparty.trim() || !receivableForm.dueDate}
                    onClick={() => onSubmitAction({
                      action: "create_receivable",
                      counterparty: receivableForm.counterparty,
                      phone: receivableForm.phone,
                      description: receivableForm.description,
                      totalAmount: Number(receivableForm.totalAmount || 0),
                      dueDate: receivableForm.dueDate,
                      collectability: receivableForm.collectability,
                      note: receivableForm.note,
                    })}
                  >
                    Thêm công nợ phải thu
                  </Button>
                </div>
              </div>
              {visibleReceivables.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-medium">{item.counterparty} • {item.phone}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Hẹn thu: {item.dueDate} • Đã thu: {fmt(item.collectedAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{fmt(item.totalAmount - item.collectedAmount)}</p>
                      <Badge variant="outline">{item.collectability === "high" ? "Khả năng thu cao" : item.collectability === "medium" ? "Khả năng thu trung bình" : "Khả năng thu thấp"}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-lg border border-dashed p-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <Label>Đối tượng</Label>
                      <Input
                        value={receivableDrafts[item.id]?.counterparty || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], counterparty: e.target.value },
                        }))}
                      />
                    </div>
                    <div>
                      <Label>SĐT</Label>
                      <Input
                        value={receivableDrafts[item.id]?.phone || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], phone: e.target.value },
                        }))}
                      />
                    </div>
                    <div className="xl:col-span-2">
                      <Label>Nội dung</Label>
                      <Input
                        value={receivableDrafts[item.id]?.description || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], description: e.target.value },
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Tổng phải thu</Label>
                      <Input
                        value={receivableDrafts[item.id]?.totalAmount || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], totalAmount: e.target.value.replace(/[^\d]/g, "") },
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Ngày hẹn thu</Label>
                      <Input
                        type="date"
                        value={receivableDrafts[item.id]?.dueDate || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], dueDate: e.target.value },
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Khả năng thu</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={receivableDrafts[item.id]?.collectability || "medium"}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], collectability: e.target.value },
                        }))}
                      >
                        <option value="high">Cao</option>
                        <option value="medium">Trung bình</option>
                        <option value="low">Thấp</option>
                      </select>
                    </div>
                    <div>
                      <Label>Ghi chú</Label>
                      <Input
                        value={receivableDrafts[item.id]?.note || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], note: e.target.value },
                        }))}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => onSubmitAction({
                          action: "update_receivable",
                          id: item.id,
                          counterparty: receivableDrafts[item.id]?.counterparty || "",
                          phone: receivableDrafts[item.id]?.phone || "",
                          description: receivableDrafts[item.id]?.description || "",
                          totalAmount: Number(receivableDrafts[item.id]?.totalAmount || 0),
                          dueDate: receivableDrafts[item.id]?.dueDate || "",
                          collectability: receivableDrafts[item.id]?.collectability || "medium",
                          note: receivableDrafts[item.id]?.note || "",
                        })}
                      >
                        Lưu chỉnh sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={submitting}
                        onClick={() => {
                          if (!window.confirm(`Xóa công nợ của ${item.counterparty}?`)) return
                          onSubmitAction({ action: "delete_receivable", id: item.id })
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 rounded-lg bg-muted/30 p-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <Label>Số tiền thu</Label>
                      <Input
                        value={receivableDrafts[item.id]?.collectAmount || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], collectAmount: e.target.value.replace(/[^\d]/g, "") },
                        }))}
                      />
                    </div>
                    <div>
                      <Label>Nhận vào tài khoản</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={receivableDrafts[item.id]?.collectAccountId || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], collectAccountId: e.target.value },
                        }))}
                      >
                        <option value="">Chọn tài khoản</option>
                        {availableAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} • {fmt(account.balance)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="xl:col-span-2">
                      <Label>Ghi chú thu nợ</Label>
                      <Input
                        value={receivableDrafts[item.id]?.collectNote || ""}
                        onChange={(e) => setReceivableDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], collectNote: e.target.value },
                        }))}
                        placeholder="VD: khách chuyển khoản đợt 1"
                      />
                    </div>
                    <div className="xl:col-span-4">
                      <Button
                        size="sm"
                        disabled={submitting || !receivableDrafts[item.id]?.collectAccountId || !Number(receivableDrafts[item.id]?.collectAmount || 0)}
                        onClick={() => onSubmitAction({
                          action: "collect_receivable",
                          id: item.id,
                          amount: Number(receivableDrafts[item.id]?.collectAmount || 0),
                          accountId: receivableDrafts[item.id]?.collectAccountId || "",
                          note: receivableDrafts[item.id]?.collectNote || "",
                        })}
                      >
                        Ghi nhận thu nợ
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {!visibleReceivables.length ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Hiện không còn khoản phải thu nào chưa thu đủ.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="no-dai-han" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nợ dài hạn</CardTitle>
              <CardDescription>Quỹ lãi sẽ được ưu tiên dùng để trả các khoản nợ dài hạn này, tách riêng khỏi dòng tiền ngắn hạn.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
                <div>
                  <Label>Chủ nợ</Label>
                  <Input value={longTermDebtForm.creditor} onChange={(e) => setLongTermDebtForm((prev) => ({ ...prev, creditor: e.target.value }))} />
                </div>
                <div>
                  <Label>Ưu tiên</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={longTermDebtForm.priority} onChange={(e) => setLongTermDebtForm((prev) => ({ ...prev, priority: e.target.value }))}>
                    <option value="critical">critical</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Nội dung</Label>
                  <Input value={longTermDebtForm.description} onChange={(e) => setLongTermDebtForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Số tiền gốc</Label>
                  <Input value={longTermDebtForm.principalAmount} onChange={(e) => setLongTermDebtForm((prev) => ({ ...prev, principalAmount: e.target.value.replace(/[^\d]/g, "") }))} />
                </div>
                <div>
                  <Label>Hạn thanh toán</Label>
                  <Input type="date" value={longTermDebtForm.dueDate} onChange={(e) => setLongTermDebtForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Ghi chú</Label>
                  <Input value={longTermDebtForm.note} onChange={(e) => setLongTermDebtForm((prev) => ({ ...prev, note: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Button
                    disabled={submitting || !longTermDebtForm.creditor.trim() || !longTermDebtForm.dueDate}
                    onClick={() => onSubmitAction({
                      action: "create_long_term_debt",
                      creditor: longTermDebtForm.creditor,
                      description: longTermDebtForm.description,
                      principalAmount: Number(longTermDebtForm.principalAmount || 0),
                      dueDate: longTermDebtForm.dueDate,
                      priority: longTermDebtForm.priority,
                      note: longTermDebtForm.note,
                    })}
                  >
                    Thêm nợ dài hạn
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {!longTermDebts.filter((item) => item.principalAmount - item.paidAmount > 0).length ? (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    Hiện không còn khoản nợ dài hạn nào đang mở.
                  </div>
                ) : null}
                {longTermDebts.filter((item) => item.principalAmount - item.paidAmount > 0).map((item) => {
                  const remaining = item.principalAmount - item.paidAmount
                  const isSelected = selectedLongTermDebtId === item.id
                  const enoughProfitFund = overview.profitFundBalance >= remaining
                  return (
                    <div
                      key={item.id}
                      className={`rounded-[28px] border p-6 transition-colors ${
                        enoughProfitFund ? "border-emerald-700/60 bg-emerald-950/20" : "border-amber-700/60 bg-amber-950/20"
                      } ${isSelected ? "ring-1 ring-primary/40" : ""}`}
                    >
                      <button type="button" className="w-full text-left" onClick={() => setSelectedLongTermDebtId((prev) => prev === item.id ? "" : item.id)}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <p className="text-2xl font-bold">{item.creditor}</p>
                            <p className="text-xl text-muted-foreground">{item.description}</p>
                            <p className="text-lg font-semibold">Hạn {item.dueDate}</p>
                            <p className="text-sm text-muted-foreground">Quỹ lãi hiện có: {fmt(overview.profitFundBalance)}</p>
                          </div>
                          <div className="flex flex-col items-start gap-3 lg:items-end">
                            <Badge className={enoughProfitFund ? "bg-white text-black hover:bg-white/90" : "bg-amber-500 text-black hover:bg-amber-400"}>
                              {enoughProfitFund ? "Quỹ lãi đủ trả" : "Quỹ lãi chưa đủ"}
                            </Badge>
                            <p className="text-3xl font-bold">{fmt(remaining)}</p>
                            <p className="text-sm text-muted-foreground">Đã trả: {fmt(item.paidAmount)}</p>
                          </div>
                        </div>
                      </button>
                      {isSelected ? (
                        <div className="mt-5 space-y-4 rounded-2xl border border-dashed p-5">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <Label>Chủ nợ</Label>
                              <Input value={longTermDebtDrafts[item.id]?.creditor || ""} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], creditor: e.target.value } }))} />
                            </div>
                            <div>
                              <Label>Ưu tiên</Label>
                              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={longTermDebtDrafts[item.id]?.priority || "medium"} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], priority: e.target.value } }))}>
                                <option value="critical">critical</option>
                                <option value="high">high</option>
                                <option value="medium">medium</option>
                                <option value="low">low</option>
                              </select>
                            </div>
                            <div className="xl:col-span-2">
                              <Label>Nội dung</Label>
                              <Input value={longTermDebtDrafts[item.id]?.description || ""} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], description: e.target.value } }))} />
                            </div>
                            <div>
                              <Label>Số tiền gốc</Label>
                              <Input value={longTermDebtDrafts[item.id]?.principalAmount || ""} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], principalAmount: e.target.value.replace(/[^\d]/g, "") } }))} />
                            </div>
                            <div>
                              <Label>Hạn thanh toán</Label>
                              <Input type="date" value={longTermDebtDrafts[item.id]?.dueDate || ""} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], dueDate: e.target.value } }))} />
                            </div>
                            <div className="xl:col-span-2">
                              <Label>Ghi chú</Label>
                              <Input value={longTermDebtDrafts[item.id]?.note || ""} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], note: e.target.value } }))} />
                            </div>
                            <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
                              <Button
                                size="sm"
                                disabled={submitting}
                                onClick={() => onSubmitAction({
                                  action: "update_long_term_debt",
                                  id: item.id,
                                  creditor: longTermDebtDrafts[item.id]?.creditor || "",
                                  description: longTermDebtDrafts[item.id]?.description || "",
                                  principalAmount: Number(longTermDebtDrafts[item.id]?.principalAmount || 0),
                                  dueDate: longTermDebtDrafts[item.id]?.dueDate || "",
                                  priority: longTermDebtDrafts[item.id]?.priority || "medium",
                                  note: longTermDebtDrafts[item.id]?.note || "",
                                })}
                              >
                                Lưu chỉnh sửa
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={submitting}
                                onClick={() => {
                                  if (!window.confirm(`Xóa nợ dài hạn của ${item.creditor}?`)) return
                                  onSubmitAction({ action: "delete_long_term_debt", id: item.id })
                                }}
                              >
                                Xóa
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-3 rounded-2xl bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <Label>Số tiền trả từ quỹ lãi</Label>
                              <Input value={longTermDebtDrafts[item.id]?.payAmount || ""} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], payAmount: e.target.value.replace(/[^\d]/g, "") } }))} />
                            </div>
                            <div className="xl:col-span-2">
                              <Label>Ghi chú thanh toán</Label>
                              <Input value={longTermDebtDrafts[item.id]?.payNote || ""} onChange={(e) => setLongTermDebtDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], payNote: e.target.value } }))} placeholder="VD: trả bằng quỹ lãi tuần này" />
                            </div>
                            <div className="xl:col-span-4">
                              <Button
                                size="sm"
                                disabled={submitting || !Number(longTermDebtDrafts[item.id]?.payAmount || 0)}
                                onClick={() => onSubmitAction({
                                  action: "pay_long_term_debt",
                                  id: item.id,
                                  amount: Number(longTermDebtDrafts[item.id]?.payAmount || 0),
                                  note: longTermDebtDrafts[item.id]?.payNote || "",
                                })}
                              >
                                Trả nợ bằng quỹ lãi
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phai-tra" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nợ phải trả và đề xuất chi trả</CardTitle>
              <CardDescription>Ưu tiên quá hạn, đến hạn hôm nay, khoản có lãi và nợ hàng ảnh hưởng đầu vào.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
                <div>
                  <Label>Chủ nợ</Label>
                  <Input value={payableForm.creditor} onChange={(e) => setPayableForm((prev) => ({ ...prev, creditor: e.target.value }))} />
                </div>
                <div>
                  <Label>Loại nợ</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={payableForm.type} onChange={(e) => setPayableForm((prev) => ({ ...prev, type: e.target.value }))}>
                    <option value="external_debt">Nợ ngoài</option>
                    <option value="inventory_payable">Nợ hàng</option>
                    <option value="supplier">Nhà cung cấp</option>
                    <option value="rent">Mặt bằng</option>
                    <option value="salary">Lương</option>
                    <option value="operating_cost">Chi phí vận hành</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label>Nội dung</Label>
                  <Input value={payableForm.description} onChange={(e) => setPayableForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Số tiền gốc</Label>
                  <Input value={payableForm.principalAmount} onChange={(e) => setPayableForm((prev) => ({ ...prev, principalAmount: e.target.value.replace(/[^\d]/g, "") }))} />
                </div>
                <div>
                  <Label>Hạn thanh toán</Label>
                  <Input type="date" value={payableForm.dueDate} onChange={(e) => setPayableForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Ưu tiên</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={payableForm.priority} onChange={(e) => setPayableForm((prev) => ({ ...prev, priority: e.target.value }))}>
                    <option value="critical">critical</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </div>
                <div>
                  <Label>Ghi chú</Label>
                  <Input value={payableForm.note} onChange={(e) => setPayableForm((prev) => ({ ...prev, note: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Button
                    disabled={submitting || !payableForm.creditor.trim() || !payableForm.dueDate}
                    onClick={() => onSubmitAction({
                      action: "create_payable",
                      creditor: payableForm.creditor,
                      type: payableForm.type,
                      description: payableForm.description,
                      principalAmount: Number(payableForm.principalAmount || 0),
                      dueDate: payableForm.dueDate,
                      priority: payableForm.priority,
                      note: payableForm.note,
                    })}
                  >
                    Thêm khoản phải trả
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {visiblePayables.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    Hiện không còn khoản phải trả nào đang mở.
                  </div>
                ) : null}
                {visiblePayables.map((item) => {
                  const remaining = item.principalAmount - item.paidAmount
                  const suggestion = suggestionMap.get(item.id)
                  const isSelected = selectedPayableId === item.id
                  const hasEnoughCash = suggestion?.hasEnoughCash ?? overview.spendableCash >= remaining
                  return (
                    <div
                      key={item.id}
                      className={`rounded-[28px] border p-6 transition-colors ${
                        hasEnoughCash
                          ? "border-emerald-700/60 bg-emerald-950/20"
                          : "border-red-800/60 bg-red-950/20"
                      } ${isSelected ? "ring-1 ring-primary/40" : ""}`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedPayableId((prev) => prev === item.id ? "" : item.id)}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div>
                              <p className="text-2xl font-bold">{item.creditor}</p>
                              <p className="text-xl text-muted-foreground">{item.description}</p>
                            </div>
                            <p className="text-lg font-semibold">
                              Đến hạn {item.dueDate}
                              {suggestion?.reason ? ` • ${suggestion.reason}` : ""}
                            </p>
                            <p className="text-2xl font-bold">
                              Đề xuất trả: {fmt(suggestion?.suggestedAmount ?? remaining)}
                              <span className="ml-4 text-xl">
                                Ngày: {suggestion?.suggestedDate ?? item.dueDate}
                              </span>
                              <span className="ml-4 text-xl">
                                Nguồn: {suggestion?.fundingSource ?? (availableAccounts[0]?.name || "Chưa có")}
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-col items-start gap-3 lg:items-end">
                            <Badge className={hasEnoughCash ? "bg-white text-black hover:bg-white/90" : "bg-red-600 text-white hover:bg-red-600/90"}>
                              {hasEnoughCash ? "Đủ tiền" : "Thiếu tiền"}
                            </Badge>
                            <p className="text-3xl font-bold">{fmt(remaining)}</p>
                            <p className="text-sm text-muted-foreground">Đã trả: {fmt(item.paidAmount)}</p>
                          </div>
                        </div>
                      </button>
                      {isSelected ? (
                        <div className="mt-5 space-y-4 rounded-2xl border border-dashed p-5">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <Label>Chủ nợ</Label>
                              <Input
                                value={payableDrafts[item.id]?.creditor || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], creditor: e.target.value },
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Loại nợ</Label>
                              <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={payableDrafts[item.id]?.type || "other"}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], type: e.target.value },
                                }))}
                              >
                                <option value="external_debt">Nợ ngoài</option>
                                <option value="inventory_payable">Nợ hàng</option>
                                <option value="supplier">Nhà cung cấp</option>
                                <option value="loan">Khoản vay</option>
                                <option value="interest">Tiền lãi</option>
                                <option value="rent">Mặt bằng</option>
                                <option value="salary">Lương</option>
                                <option value="operating_cost">Chi phí vận hành</option>
                                <option value="other">Khác</option>
                              </select>
                            </div>
                            <div className="xl:col-span-2">
                              <Label>Nội dung</Label>
                              <Input
                                value={payableDrafts[item.id]?.description || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], description: e.target.value },
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Số tiền gốc</Label>
                              <Input
                                value={payableDrafts[item.id]?.principalAmount || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], principalAmount: e.target.value.replace(/[^\d]/g, "") },
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Hạn thanh toán</Label>
                              <Input
                                type="date"
                                value={payableDrafts[item.id]?.dueDate || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], dueDate: e.target.value },
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Ưu tiên</Label>
                              <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={payableDrafts[item.id]?.priority || "medium"}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], priority: e.target.value },
                                }))}
                              >
                                <option value="critical">critical</option>
                                <option value="high">high</option>
                                <option value="medium">medium</option>
                                <option value="low">low</option>
                              </select>
                            </div>
                            <div>
                              <Label>Ghi chú</Label>
                              <Input
                                value={payableDrafts[item.id]?.note || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], note: e.target.value },
                                }))}
                              />
                            </div>
                            <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
                              <Button
                                size="sm"
                                disabled={submitting}
                                onClick={() => onSubmitAction({
                                  action: "update_payable",
                                  id: item.id,
                                  creditor: payableDrafts[item.id]?.creditor || "",
                                  type: payableDrafts[item.id]?.type || "other",
                                  description: payableDrafts[item.id]?.description || "",
                                  principalAmount: Number(payableDrafts[item.id]?.principalAmount || 0),
                                  dueDate: payableDrafts[item.id]?.dueDate || "",
                                  priority: payableDrafts[item.id]?.priority || "medium",
                                  note: payableDrafts[item.id]?.note || "",
                                })}
                              >
                                Lưu chỉnh sửa
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={submitting}
                                onClick={() => {
                                  if (!window.confirm(`Xóa khoản phải trả cho ${item.creditor}?`)) return
                                  onSubmitAction({ action: "delete_payable", id: item.id })
                                }}
                              >
                                Xóa
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-3 rounded-2xl bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <Label>Số tiền trả</Label>
                              <Input
                                value={payableDrafts[item.id]?.payAmount || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], payAmount: e.target.value.replace(/[^\d]/g, "") },
                                }))}
                              />
                            </div>
                            <div>
                              <Label>Chi từ tài khoản</Label>
                              <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={payableDrafts[item.id]?.payAccountId || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], payAccountId: e.target.value },
                                }))}
                              >
                                <option value="">Chọn tài khoản</option>
                                {availableAccounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.name} • {fmt(account.balance)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="xl:col-span-2">
                              <Label>Ghi chú thanh toán</Label>
                              <Input
                                value={payableDrafts[item.id]?.payNote || ""}
                                onChange={(e) => setPayableDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], payNote: e.target.value },
                                }))}
                                placeholder="VD: trả đợt 1"
                              />
                            </div>
                            <div className="xl:col-span-4">
                              <Button
                                size="sm"
                                disabled={submitting || !payableDrafts[item.id]?.payAccountId || !Number(payableDrafts[item.id]?.payAmount || 0)}
                                onClick={() => onSubmitAction({
                                  action: "pay_payable",
                                  id: item.id,
                                  amount: Number(payableDrafts[item.id]?.payAmount || 0),
                                  accountId: payableDrafts[item.id]?.payAccountId || "",
                                  note: payableDrafts[item.id]?.payNote || "",
                                })}
                              >
                                Ghi nhận trả nợ
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ke-hoach" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kế hoạch dòng tiền theo ngày</CardTitle>
              <CardDescription>Tiền cuối kỳ của ngày trước là tiền đầu kỳ của ngày sau.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={plan}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} />
                    <YAxis tickFormatter={fmtShort} />
                    <Tooltip formatter={(value: number) => fmt(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="openingBalance" name="Đầu kỳ" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="closingBalance" name="Cuối kỳ" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {plan.map((row) => (
                  <div key={row.date} className={`rounded-xl border p-4 ${row.isNegative ? "border-red-500/30 bg-red-500/10" : ""}`}>
                    <div className="grid gap-2 md:grid-cols-6">
                      <div>
                        <p className="text-xs text-muted-foreground">Ngày</p>
                        <p className="font-medium">{row.date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Đầu kỳ</p>
                        <p>{fmt(row.openingBalance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Thu vào</p>
                        <p>{fmt(row.receivableInflow + row.salesInflow + row.otherInflow)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Chi ra</p>
                        <p>{fmt(row.externalDebtOutflow + row.inventoryOutflow + row.operatingOutflow + row.interestOutflow)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Dòng tiền ròng</p>
                        <p className={row.netCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(row.netCashFlow)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cuối kỳ</p>
                        <p className={row.closingBalance >= 0 ? "font-semibold" : "font-semibold text-red-400"}>{fmt(row.closingBalance)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mo-phong" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {scenarios.map((scenario) => (
              <Card key={scenario.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{scenario.name}</span>
                    <Badge variant={scenario.endingBalance >= scenario.safeReserve ? "default" : "destructive"}>
                      {scenario.endingBalance >= scenario.safeReserve ? "An toàn" : "Thiếu"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Bán {Math.round(scenario.sellThroughRate * 100)}% hàng tồn • Thu {Math.round(scenario.receivableCollectRate * 100)}% công nợ
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Thu từ hàng tồn (giá bán nhanh)</p>
                    <p className="mt-1 font-semibold">{fmt(scenario.collectibleFromInventory)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Thu từ công nợ</p>
                    <p className="mt-1 font-semibold">{fmt(scenario.collectibleFromReceivables)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Số dư cuối cùng</p>
                    <p className={`mt-1 font-semibold ${scenario.endingBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(scenario.endingBalance)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Thiếu hụt so với quỹ an toàn</p>
                    <p className="mt-1 font-semibold">{fmt(scenario.shortage)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Hàng tồn còn lại</p>
                    <p className="mt-1 font-semibold">{fmt(scenario.remainingInventoryValue)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Công nợ còn lại</p>
                    <p className="mt-1 font-semibold">{fmt(scenario.remainingReceivables)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TransactionList({ transactions, emptyText }: { transactions: LedgerTransaction[]; emptyText: string }) {
  if (!transactions.length) {
    return <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{emptyText}</div>
  }

  return (
    <div className="space-y-3">
      {transactions.map((item) => {
        const isOutflow = item.type === "payable_payment"
        return (
          <div key={item.id} className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">{item.counterparty || item.note || item.type}</p>
              <p className="text-sm text-muted-foreground">{item.note || "Không có ghi chú"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.occurredAt} • {item.accountName} • {item.source}
              </p>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${isOutflow ? "text-red-400" : "text-emerald-400"}`}>
                {isOutflow ? "-" : "+"}{fmt(item.amount)}
              </p>
              <p className="text-xs text-muted-foreground">{item.type}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PendingSettlementBlock({
  title,
  total,
  items,
  submitting,
  bankAccountName,
  onConfirm,
}: {
  title: string
  total: number
  items: Receivable[]
  submitting: boolean
  bankAccountName: string
  onConfirm: (item: Receivable) => void
}) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-black/10 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">Sẽ cộng vào {bankAccountName} khi xác nhận đã nhận tiền.</p>
        </div>
        <p className="shrink-0 text-xl font-semibold text-violet-100 sm:text-2xl">{fmt(total)}</p>
      </div>
      <div className="mt-3 space-y-3">
        {!items.length ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Hiện không có khoản pending nào.</div>
        ) : items.map((item) => {
          const remaining = Math.max(0, item.totalAmount - item.collectedAmount)
          const shortDescription = item.description
            .replace(/^Thẻ từ đơn\s*/i, "")
            .replace(/^Trả góp từ đơn\s*/i, "")
            .trim()
          return (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-violet-400/30 bg-violet-500/10 text-violet-100">
                      {title}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">{shortDescription || item.description}</span>
                  </div>
                  <p className="mt-3 text-lg font-semibold">{item.autoRefId?.split("::")[0] || item.description}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.counterparty || "Khách lẻ"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border px-2 py-1">Dự kiến về {item.dueDate}</span>
                    <span className="rounded-full border px-2 py-1">Cộng vào {bankAccountName}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-3 lg:items-end">
                  <div className="text-left lg:text-right">
                    <p className="text-2xl font-semibold text-violet-100">{fmt(remaining)}</p>
                    <p className="text-xs text-muted-foreground">{title} pending</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={submitting || !remaining || (!item.accountId && !bankAccountName)}
                    className="w-full bg-white text-black hover:bg-white/90 lg:w-auto"
                    onClick={() => onConfirm(item)}
                  >
                    Đã nhận
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DepositOrderCard({ order }: { order: DepositOrderSummary }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{order.id}</Badge>
            <Badge className="bg-orange-500/15 text-orange-200 hover:bg-orange-500/15">{order.status || "Đặt cọc"}</Badge>
          </div>
          <p className="mt-3 text-lg font-semibold">{order.customer || "Khách lẻ"}</p>
          <p className="text-sm text-muted-foreground">{order.phone || "Không có số điện thoại"}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-2 py-1">Ngày cọc {order.depositDate}</span>
            {order.dueDate ? <span className="rounded-full border px-2 py-1">Hạn trả đủ {order.dueDate}</span> : null}
          </div>
          {order.note ? <p className="mt-3 text-sm text-muted-foreground">{order.note}</p> : null}
        </div>
        <div className="grid gap-2 text-left lg:min-w-[220px] lg:text-right">
          <div>
            <p className="text-xs text-muted-foreground">Đã nhận cọc</p>
            <p className="text-xl font-semibold text-emerald-400">{fmt(order.depositAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Còn lại nếu chốt bán</p>
            <p className="text-xl font-semibold">{fmt(order.remainingAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Giá nhập đang giữ chỗ</p>
            <p className="text-sm font-semibold">{fmt(order.inventoryValue)}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {order.products.length ? order.products.map((product, index) => (
          <div key={`${order.id}-${product.imei || product.serial || index}`} className="rounded-xl border bg-white/[0.02] p-3">
            <p className="font-medium">{product.model || "Chưa rõ tên máy"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[product.color, product.capacity].filter(Boolean).join(" • ") || "Không có màu / dung lượng"}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{product.imei || product.serial || "Không có IMEI/Serial"}</p>
            {product.condition ? <p className="mt-2 text-xs text-muted-foreground">{product.condition}</p> : null}
          </div>
        )) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Không có danh sách máy trong đơn cọc này.</div>
        )}
      </div>
    </div>
  )
}
