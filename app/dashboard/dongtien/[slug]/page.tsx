"use client"

import { type ComponentType, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Boxes, CalendarClock, Coins, Loader2, ShieldAlert, Wallet } from "lucide-react"
import { ProtectedRoute, getAuthHeaders } from "@/components/auth/protected-route"
import { OtpGate } from "@/components/dongtien/otp-gate"
import { useAuthMe } from "@/hooks/use-auth-me"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CashFlowDailyReport } from "@/lib/cash-flow/types"
import { clearOtpSession, readOtpSession, saveOtpSession } from "@/lib/cash-flow/otp-session"

const ALLOWED_EMAIL = "dung8ahxh@gmail.com"

const fmt = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} ₫`

type ApiResponse = { success: true; report: CashFlowDailyReport } | { error: string }

export default function CashFlowDailyReportPage() {
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || "")
  const router = useRouter()
  const { me, isLoading: authLoading } = useAuthMe()
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [report, setReport] = useState<CashFlowDailyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

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
    if (!otpVerified || !otpCode) {
      setIsLoading(false)
      return
    }

    const loadReport = async () => {
      try {
        setIsLoading(true)
        setError("")
        const res = await fetch(`/api/dongtien?reportSlug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
          headers: {
            ...getAuthHeaders(),
            "x-dongtien-otp": otpCode,
          },
        })
        if (res.status === 401) {
          clearOtpSession()
          setOtpCode("")
          setOtpVerified(false)
          return
        }
        const json = await res.json() as ApiResponse
        if (!res.ok || !("success" in json)) throw new Error("error" in json ? json.error : "Không tải được báo cáo")
        setReport(json.report)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được báo cáo")
      } finally {
        setIsLoading(false)
      }
    }

    loadReport()
  }, [authLoading, me, otpVerified, otpCode, router, slug])

  const onVerified = (otp: string) => {
    if (!me?.email) return
    saveOtpSession(me.email, otp)
    setOtpCode(otp)
    setOtpVerified(true)
  }

  const overview = report?.data.overview
  const highlights = useMemo(() => report?.highlights || [], [report])
  const aiReport = report?.aiReport || null

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
      ) : !report || !overview ? (
        <div className="mx-auto w-full max-w-[calc(100vw-2rem)] px-1 py-4">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Không mở được báo cáo dòng tiền</AlertTitle>
            <AlertDescription>{error || "Chưa có báo cáo cho ngày này. Báo cáo sẽ tự tạo sau 18:00 cùng ngày."}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/dashboard/dongtien">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại Dòng tiền
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[calc(100vw-2rem)] space-y-4 overflow-x-hidden px-1 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="px-2">
                  <Link href="/dashboard/dongtien">
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Dòng tiền
                  </Link>
                </Button>
                <Badge variant="outline">{report.slug}</Badge>
              </div>
              <h1 className="mt-2 text-2xl font-bold">{report.title}</h1>
              <p className="text-sm text-muted-foreground">
                Snapshot tạo lúc {new Date(report.generatedAt).toLocaleString("vi-VN")}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tổng quan cuối ngày</CardTitle>
              <CardDescription>{report.summary}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Tiền sẵn có" value={fmt(overview.cashOnHand)} icon={Wallet} note={`Có thể chi ${fmt(overview.spendableCash)}`} />
              <MetricCard title="COD chờ về" value={fmt(overview.codPending3Days)} icon={Coins} note={`${overview.codPendingOrders} đơn chưa đối soát`} />
              <MetricCard title="Phải trả 3 ngày" value={fmt(overview.dueToday + overview.dueIn3Days)} icon={CalendarClock} note={`Thiếu hụt ${fmt(overview.shortageForUpcomingDues)}`} />
              <MetricCard title="Hàng tồn giá nhập" value={fmt(overview.inventoryValue)} icon={Boxes} note={`${overview.inventoryAging.over30Days} máy tồn trên 30 ngày`} />
            </CardContent>
          </Card>

          {aiReport ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Tóm tắt điều hành bằng Gemini</CardTitle>
                  <CardDescription>
                    Trạng thái: {aiReport.overall_status} • Điểm sức khỏe: {aiReport.health_score}/100
                    {report.aiModel ? ` • Model: ${report.aiModel}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border p-4 text-sm leading-7">
                    {aiReport.executive_summary}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <MetricCard title="Tiền dùng ngay" value={fmt(aiReport.key_metrics.liquid_cash)} note="Theo báo cáo AI" icon={Wallet} />
                    <MetricCard title="Công nợ phải thu" value={fmt(aiReport.key_metrics.receivables)} note="Nguồn tiền dự kiến thu" icon={Coins} />
                    <MetricCard title="Công nợ phải trả" value={fmt(aiReport.key_metrics.payables)} note="Nghĩa vụ cần xử lý" icon={CalendarClock} />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-3">
                <AiCashFlowCard title="Hôm nay" block={aiReport.cash_flow_analysis.today} />
                <AiCashFlowCard title="3 ngày tới" block={aiReport.cash_flow_analysis.next_3_days} />
                <AiCashFlowCard title="7 ngày tới" block={aiReport.cash_flow_analysis.next_7_days} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <AiAlertCard items={aiReport.alerts} />
                <AiPriorityCard report={aiReport} />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <ReportListCard
                  title="Phương án an toàn"
                  items={[
                    aiReport.scenarios.safe.expected_result || "",
                    ...(aiReport.scenarios.safe.actions || []),
                  ].filter(Boolean)}
                />
                <ReportListCard
                  title="Phương án cân bằng"
                  items={[
                    aiReport.scenarios.balanced.expected_result || "",
                    ...(aiReport.scenarios.balanced.actions || []),
                  ].filter(Boolean)}
                />
                <ReportListCard
                  title="Phương án tăng trưởng"
                  items={[
                    aiReport.scenarios.growth.expected_result || "",
                    ...(aiReport.scenarios.growth.actions || []),
                  ].filter(Boolean)}
                />
              </div>
            </>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <ReportListCard title="Điểm nhấn" items={highlights} />
            <ReportListCard title="Cảnh báo" items={report.warnings} tone="warning" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ReportListCard title="Xử lý tiền" items={report.cashActions} />
            <ReportListCard title="Xử lý hàng" items={report.inventoryActions} />
            <ReportListCard title="Xử lý công nợ" items={report.debtActions} />
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

function AiCashFlowCard({
  title,
  block,
}: {
  title: string
  block: {
    available: number
    incoming: number
    outgoing: number
    surplus_or_gap: number
    status: string
    explanation: string
  }
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Trạng thái: {block.status}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Có thể dùng</p>
            <p className="mt-1 font-semibold">{fmt(block.available)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Chênh lệch</p>
            <p className="mt-1 font-semibold">{fmt(block.surplus_or_gap)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Thu vào</p>
            <p className="mt-1 font-semibold">{fmt(block.incoming)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Chi ra</p>
            <p className="mt-1 font-semibold">{fmt(block.outgoing)}</p>
          </div>
        </div>
        <div className="rounded-lg border p-3 text-sm leading-6">
          {block.explanation}
        </div>
      </CardContent>
    </Card>
  )
}

function AiAlertCard({
  items,
}: {
  items: Array<{
    level?: string
    category?: string
    title?: string
    evidence?: string
    financial_impact?: number
    deadline?: string
    recommended_action?: string
  }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cảnh báo ưu tiên</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.slice(0, 5).map((item, index) => (
          <div key={`ai-alert-${index}`} className="rounded-lg border p-3 text-sm leading-6">
            <p className="font-semibold">{item.title || "Cảnh báo"}</p>
            <p className="text-muted-foreground">{item.evidence || "Không có diễn giải"}</p>
            <p className="mt-1">Tác động: {fmt(Number(item.financial_impact || 0))}</p>
            {item.recommended_action ? <p className="mt-1">{item.recommended_action}</p> : null}
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">Chưa có cảnh báo.</p>
        )}
      </CardContent>
    </Card>
  )
}

function AiPriorityCard({
  report,
}: {
  report: NonNullable<CashFlowDailyReport["aiReport"]>
}) {
  const items = [
    ...(report.priority_actions.within_24_hours || []),
    ...(report.priority_actions.within_3_days || []),
    ...(report.priority_actions.within_7_days || []),
  ].slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hành động ưu tiên</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item, index) => (
          <div key={`priority-${index}`} className="rounded-lg border p-3 text-sm leading-6">
            <p className="font-semibold">{item.action || "Chưa có mô tả"}</p>
            <p className="text-muted-foreground">{item.reason || "Không có lý do chi tiết"}</p>
            <p className="mt-1">Số tiền liên quan: {fmt(Number(item.amount || 0))}</p>
            {item.expected_result ? <p className="mt-1">{item.expected_result}</p> : null}
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">Chưa có hành động ưu tiên.</p>
        )}
      </CardContent>
    </Card>
  )
}

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string
  value: string
  note: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function ReportListCard({
  title,
  items,
  tone = "default",
}: {
  title: string
  items: string[]
  tone?: "default" | "warning"
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-500/30" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tone === "warning" ? <AlertTriangle className="h-5 w-5 text-amber-400" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-lg border p-3 text-sm leading-6">
            {item}
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
        )}
      </CardContent>
    </Card>
  )
}
