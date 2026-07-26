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
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
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
import type { CashFlowDashboardData, LedgerTransaction } from "@/lib/cash-flow/types"

const ALLOWED_EMAIL = "dung8ahxh@gmail.com"
const OTP_STORAGE_KEY = "dongtien_otp_verified_v1"

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

function readOtpSession(email?: string) {
  if (typeof window === "undefined" || !email) return false
  try {
    const raw = localStorage.getItem(OTP_STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { email: string; otp: string; verifiedAt: string }
    return parsed.email === email && parsed.otp === "216917"
  } catch {
    return false
  }
}

export default function DongTienPage() {
  const router = useRouter()
  const { me, isLoading: authLoading } = useAuthMe()
  const { toast } = useToast()
  const [otpVerified, setOtpVerified] = useState(false)
  const [data, setData] = useState<CashFlowDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [creatingReport, setCreatingReport] = useState(false)
  const [accountDrafts, setAccountDrafts] = useState<Record<string, string>>({})
  const [accountForm, setAccountForm] = useState({ name: "", type: "cash", balance: "0", availability: "AVAILABLE", note: "" })
  const [receivableForm, setReceivableForm] = useState({ counterparty: "", phone: "", description: "", totalAmount: "", dueDate: "", collectability: "medium", note: "" })
  const [payableForm, setPayableForm] = useState({ creditor: "", type: "external_debt", description: "", principalAmount: "", dueDate: "", priority: "medium", note: "" })

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError("")
      const res = await fetch("/api/dongtien", {
        cache: "no-store",
        headers: {
          ...getAuthHeaders(),
          "x-dongtien-otp": "216917",
        },
      })
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
    setOtpVerified(readOtpSession(me.email))
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
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify({
      email: me.email,
      otp,
      verifiedAt: new Date().toISOString(),
    }))
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
          "x-dongtien-otp": "216917",
        },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || "Không lưu được dữ liệu")
      setData(json.data)
      setAccountDrafts(Object.fromEntries((json.data.accounts || []).map((item: any) => [item.id, String(item.balance)])))
      setAccountForm({ name: "", type: "cash", balance: "0", availability: "AVAILABLE", note: "" })
      setReceivableForm({ counterparty: "", phone: "", description: "", totalAmount: "", dueDate: "", collectability: "medium", note: "" })
      setPayableForm({ creditor: "", type: "external_debt", description: "", principalAmount: "", dueDate: "", priority: "medium", note: "" })
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
          "x-dongtien-otp": "216917",
        },
      })
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
          onReload={loadData}
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
  onSubmitAction: (payload: Record<string, any>) => Promise<void>
  onCreateReportNow: () => Promise<void>
}) {
  const { overview, alerts, accounts, transactions, inventoryItems, receivables, payables, plan, paymentSuggestions, scenarios } = data
  const countedInventory = inventoryItems.filter((item) => item.status === "IN_STOCK" || item.status === "IN_STOCK_RETURNED")
  const availableAccounts = useMemo(() => accounts.filter((item) => item.availability === "AVAILABLE"), [accounts])
  const visibleReceivables = useMemo(() => receivables.filter((item) => item.totalAmount - item.collectedAmount > 0), [receivables])
  const due3Total = overview.dueToday + overview.dueIn3Days
  const visiblePayables = useMemo(() => payables.filter((item) => item.principalAmount - item.paidAmount > 0), [payables])
  const suggestionMap = useMemo(() => new Map(paymentSuggestions.map((item) => [item.payableId, item])), [paymentSuggestions])
  const [receivableDrafts, setReceivableDrafts] = useState<Record<string, ReceivableDraft>>({})
  const [payableDrafts, setPayableDrafts] = useState<Record<string, PayableDraft>>({})
  const [selectedPayableId, setSelectedPayableId] = useState("")
  const [detailView, setDetailView] = useState<"cash" | "inventory" | "receivable" | "payable" | null>(null)

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
    if (!visiblePayables.length) {
      setSelectedPayableId("")
      return
    }
    if (!visiblePayables.some((item) => item.id === selectedPayableId)) {
      setSelectedPayableId(visiblePayables[0]?.id || "")
    }
  }, [visiblePayables, selectedPayableId])

  const flowChartData = useMemo(() => (
    plan.map((row) => ({
      date: row.date.slice(5),
      "Thu công nợ": row.receivableInflow,
      "Thu bán hàng": row.salesInflow,
      "Chi nghĩa vụ": row.externalDebtOutflow + row.inventoryOutflow + row.operatingOutflow + row.interestOutflow,
      "Cuối ngày": row.closingBalance,
    }))
  ), [plan])

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
        <StatCard title="Giá trị hàng tồn" value={fmt(overview.inventoryValue)} description={`Bán nhanh có thể thu ${fmt(overview.inventoryQuickSaleValue)}`} icon={Boxes} onViewDetail={() => setDetailView("inventory")} />
        <StatCard title="Công nợ phải thu" value={fmt(overview.totalReceivables)} description={`Sau thu nợ + COD chờ về: ${fmt(overview.projectedCashAfterReceivables)}`} icon={ArrowDownCircle} onViewDetail={() => setDetailView("receivable")} />
        <StatCard title="Tổng nợ phải trả" value={fmt(overview.totalPayables)} description={`Tổng tài sản ngắn hạn: ${fmt(overview.totalShortTermAssets)}`} icon={ArrowUpCircle} onViewDetail={() => setDetailView("payable")} />
      </div>

      <Dialog open={detailView !== null} onOpenChange={(open) => !open ? setDetailView(null) : null}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {detailView === "cash" ? "Chi tiết tiền mặt và tài khoản" : null}
              {detailView === "inventory" ? "Chi tiết giá trị hàng tồn" : null}
              {detailView === "receivable" ? "Chi tiết công nợ phải thu" : null}
              {detailView === "payable" ? "Chi tiết nợ phải trả" : null}
            </DialogTitle>
            <DialogDescription>
              {detailView === "cash" ? "Xem nhanh nguồn tiền khả dụng và lịch sử giao dịch thu chi gần nhất." : null}
              {detailView === "inventory" ? "Danh sách máy đang góp vào giá trị hàng tồn hiện tại." : null}
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
        <StatCard title="Phải trả hôm nay" value={fmt(overview.dueToday)} description="Khoản đến hạn ngày 25/07/2026" icon={CalendarClock} />
        <StatCard title="Phải trả 3 ngày tới" value={fmt(overview.dueIn3Days)} description="Các khoản từ 26/07 đến 28/07/2026" icon={AlertTriangle} />
        <StatCard title="COD chờ 3 ngày" value={fmt(overview.codPending3Days)} description={`${overview.codPendingOrders} đơn GHTK chưa đối soát`} icon={Landmark} />
        <StatCard title="Số dư dự kiến cuối kỳ" value={fmt(overview.projectedEndingBalance)} description={`COD đã đối soát trong tài khoản: ${fmt(overview.codReconciledInCash)}`} icon={Coins} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Biểu đồ dòng tiền 7 ngày</CardTitle>
            <CardDescription>So sánh thu công nợ, thu bán hàng, chi nghĩa vụ và số dư cuối ngày.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={fmtShort} />
                <Tooltip formatter={(value: number) => fmt(value)} />
                <Legend />
                <Bar dataKey="Thu công nợ" fill="#16a34a" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Thu bán hàng" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Chi nghĩa vụ" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thanh khoản và quỹ an toàn</CardTitle>
            <CardDescription>
              Tiền có thể chi sau khi trừ quỹ an toàn {fmt(overview.safeReserve)}. COD GHTK đã đối soát đã nằm trong số dư hiện có.
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
                <p className="mt-1 text-xs text-emerald-100/70">{overview.codReconciledOrders} đơn đã vào tiền tài khoản</p>
              </div>
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
                <p className="text-xs text-sky-100/80">COD có thể thu trong 3 ngày</p>
                <p className="mt-1 text-lg font-semibold text-sky-100">{fmt(overview.codPending3Days)}</p>
                <p className="mt-1 text-xs text-sky-100/70">{overview.codPendingOrders} đơn GHTK chưa đối soát</p>
              </div>
            </div>
            <div className={`rounded-xl border p-4 ${overview.shortageForUpcomingDues > 0 ? "border-amber-500/20 bg-amber-500/10" : "border-emerald-500/20 bg-emerald-500/10"}`}>
              <p className={`text-sm font-medium ${overview.shortageForUpcomingDues > 0 ? "text-amber-200" : "text-emerald-200"}`}>
                {due3Total > 0 ? "Thiếu hụt cho các khoản 3 ngày tới" : "Trạng thái 3 ngày tới"}
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
          <TabsTrigger value="cong-no">Phải thu</TabsTrigger>
          <TabsTrigger value="phai-tra">Phải trả</TabsTrigger>
          <TabsTrigger value="ke-hoach">Kế hoạch</TabsTrigger>
          <TabsTrigger value="mo-phong">Mô phỏng</TabsTrigger>
        </TabsList>

        <TabsContent value="tong-quan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Đối chiếu bộ số liệu mẫu</CardTitle>
              <CardDescription>
                Hệ thống hiện đang khớp với số liệu mẫu bạn yêu cầu cho ngày 25/07/2026.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Tài sản ngắn hạn</p>
                <p className="mt-2 text-xl font-bold">{fmt(overview.totalShortTermAssets)}</p>
                <p className="mt-1 text-xs text-muted-foreground">257.120.000 + 430.000.000 + 92.100.000</p>
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
                <p className="mt-2 text-xl font-bold text-emerald-400">{fmt(overview.projectedEndingBalance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">779.220.000 - 626.400.000</p>
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
              {accounts.map((account) => (
                <div key={account.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.note || "Không có ghi chú"}</p>
                    </div>
                    <div className="flex flex-col gap-2 lg:items-end">
                      <Badge variant={account.availability === "AVAILABLE" ? "default" : "secondary"}>{account.availability}</Badge>
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
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cong-no" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Công nợ phải thu</CardTitle>
              <CardDescription>Tổng còn phải thu hiện tại: {fmt(overview.totalReceivables)}</CardDescription>
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
                    <p className="text-xs text-muted-foreground">Thu từ hàng tồn</p>
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
