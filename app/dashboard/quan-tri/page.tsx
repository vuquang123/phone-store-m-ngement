// app/dashboard/quan-tri/page.tsx
// "Tổng quan" của Quản trị dữ liệu: xem mỗi ngày tình hình kho, bán hàng và nợ phải trả.
// Số liệu tính trực tiếp từ dữ liệu hiện tại (API /api/quan-tri/tong-quan), không cần nhập tay.
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { QuanTriTabs } from "@/components/quan-tri/quan-tri-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ColorChip, TypeChip } from "@/components/quan-tri/value-chips"
import { Loader2, Plus, RefreshCw, Search } from "lucide-react"

/* ============================== kiểu dữ liệu ============================== */
type Item = {
  id: string; date: string; age: number; name: string; cat: string; type: string; cap: string; pin: string
  color: string; imei: string; serial: string; cond: string; cost: number; price: number | null; source: string
  key: string; flags: string[]
}
type Group = {
  key: string; cat: string; n: number; cost: number; price: number; profit: number
  avgAge: number; maxAge: number; sold30: number; cover: number | null
}
type PayState = "paid" | "overdue" | "today" | "soon" | "later" | "nodate"
type Payable = {
  id: string; creditor: string; type: string; typeLabel: string; description: string; principal: number; paid: number
  remaining: number; incurredAt: string; dueDate: string; daysLeft: number | null; state: PayState; hasInterest: boolean; note: string
}
type Receivable = { id: string; who: string; phone: string; content: string; remaining: number; dueDate: string; daysLeft: number | null }
type Account = { id: string; name: string; balance: number }
type SalesSum = { orders: number; revenue: number; profit: number }
type BranchSum = {
  id: string; name: string; today: SalesSum; d7: SalesSum; d30: SalesSum
  stock: number; stockCost: number; payableRemaining: number
}
type Overview = {
  asOf: string; generatedAt: string
  activeBranch?: string; byBranch?: BranchSum[]
  sales: { today: SalesSum; d7: SalesSum; d30: SalesSum }
  items: Item[]; groups: Group[]; payables: Payable[]; receivables: Receivable[]; accounts: Account[]
}

/* ============================== định dạng ============================== */
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("vi-VN"))
const tr = (n: number | null | undefined) => {
  if (n == null) return "—"
  const m = n / 1e6
  const a = Math.abs(m)
  return (a >= 100 ? m.toFixed(0) : a >= 10 ? m.toFixed(1) : m.toFixed(2)).replace(".", ",") + "tr"
}
const vnd = (n: number | null | undefined) => (n == null ? "—" : `${fmt(n)} đ`)
const dmy = (s: string) => {
  if (!s) return "—"
  const [y, m, d] = s.split("-")
  return `${+d}/${+m}/${y}`
}
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").toLowerCase()
const todayIso = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

const TAG = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ser: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  crit: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  neu: "bg-muted text-muted-foreground",
}
type Tone = keyof typeof TAG
const Tag = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => (
  <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold", TAG[tone])}>
    {children}
  </span>
)
const ageTone = (a: number): Tone => (a <= 14 ? "good" : a <= 30 ? "warn" : a <= 60 ? "ser" : "crit")
const AgeTag = ({ a }: { a: number }) => <Tag tone={ageTone(a)}>{a} ngày</Tag>
const lvl = (g: Group) => (g.n >= 4 ? "Nhiều" : g.n >= 2 ? "Vừa" : "Ít")
function speed(g: Group): [Tone, string] {
  if (g.sold30 === 0 && g.maxAge > 14) return ["crit", `Chưa bán được máy nào 30N, tồn ${g.maxAge} ngày`]
  if (g.sold30 === 0) return ["neu", "Chưa có đơn 30N (mới nhập)"]
  if ((g.cover ?? 0) > 45) return ["ser", "Bán chậm so với lượng tồn"]
  if (g.maxAge > 45) return ["ser", "Có máy tồn >45 ngày, nên đẩy giá"]
  if ((g.cover ?? 99) <= 10) return ["good", "Bán nhanh, sắp hết, cân nhắc nhập thêm"]
  return ["neu", "Ổn"]
}
const PAY_STATE: Record<PayState, [Tone, (p: Payable) => string]> = {
  overdue: ["crit", (p) => `Quá hạn ${Math.abs(p.daysLeft ?? 0)} ngày`],
  today: ["ser", () => "Đến hạn hôm nay"],
  soon: ["warn", (p) => `Còn ${p.daysLeft} ngày`],
  later: ["neu", (p) => `Còn ${p.daysLeft} ngày`],
  nodate: ["neu", () => "Chưa có hạn"],
  paid: ["good", () => "Đã trả xong"],
}
const PAY_ORDER: Record<PayState, number> = { overdue: 0, today: 1, soon: 2, later: 3, nodate: 4, paid: 5 }
const PAYABLE_TYPES = [
  ["inventory_payable", "Nợ đầu hàng"],
  ["external_debt", "Nợ ngoài"],
  ["loan", "Vay"],
  ["rent", "Tiền nhà"],
  ["salary", "Lương"],
  ["operating_cost", "Chi phí"],
  ["other", "Khác"],
] as const

async function api(method: "GET" | "POST", body?: unknown) {
  const res = await fetch("/api/quan-tri/tong-quan", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `Lỗi ${res.status}`)
  return json
}

/* ============================== khung nhỏ ============================== */
function Card({ className, children, style }: { className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className={cn("rounded-xl border bg-card p-4", className)} style={style}>{children}</div>
}
function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone }) {
  return (
    <Card>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular-nums", tone === "crit" && "text-red-600 dark:text-red-400", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </Card>
  )
}
function Th<K extends string>({ k, sort, setSort, right, children }: { k: K; sort: { k: K; d: number }; setSort: (s: { k: K; d: number }) => void; right?: boolean; children: React.ReactNode }) {
  return (
    <th
      onClick={() => setSort({ k, d: sort.k === k ? -sort.d : -1 })}
      className={cn("cursor-pointer select-none whitespace-nowrap border-b px-2 py-2 text-xs font-semibold text-muted-foreground", right ? "text-right" : "text-left")}
    >
      {children}
      {sort.k === k ? (sort.d < 0 ? " ↓" : " ↑") : ""}
    </th>
  )
}
function sortBy<T>(list: T[], k: keyof T, d: number) {
  return [...list].sort((a, b) => {
    let x: any = a[k]
    let y: any = b[k]
    if (x == null) x = -1e15
    if (y == null) y = -1e15
    return (x > y ? 1 : x < y ? -1 : 0) * d
  })
}
const td = "border-b border-border/60 px-2 py-1.5 align-top tabular-nums"

/* ============================== trang ============================== */
export default function TongQuanPage() {
  return (
    <ProtectedRoute requiredRole="chu_shop" redirectTo="/dashboard/quan-tri/du-lieu">
      <TongQuan />
    </ProtectedRoute>
  )
}

function TongQuan() {
  const { toast } = useToast()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cat, setCat] = useState<"all" | "iPhone" | "iPad">("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await api("GET"))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mx-auto max-w-[1320px] space-y-4 p-2 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <QuanTriTabs />
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Tải lại
        </Button>
        {data ? <span className="text-xs text-muted-foreground">Số liệu ngày {dmy(data.asOf)}, cập nhật {new Date(data.generatedAt).toLocaleTimeString("vi-VN")}</span> : null}
      </div>

      {error ? <Card className="border-red-300 text-sm text-red-600">{error}</Card> : null}
      {!data && loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tính số liệu…</div>
      ) : null}

      {data ? (
        <>
          {data.byBranch?.length ? <BranchCompare rows={data.byBranch} active={data.activeBranch || "all"} /> : null}
          <SalesStrip s={data.sales} />
          <CashSection data={data} reload={load} toast={toast} />
          <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
            <div>
              <h2 className="text-lg font-semibold">Kho hàng</h2>
              <div className="text-xs text-muted-foreground">Máy đang có Trạng Thái “Còn hàng” (hoặc để trống) trong Kho_Hang · tốc độ bán lấy từ đơn 30 ngày gần nhất</div>
            </div>
            <div className="inline-flex rounded-lg border bg-card p-0.5">
              {(["all", "iPhone", "iPad"] as const).map((c) => (
                <button key={c} onClick={() => setCat(c)} className={cn("rounded-md px-3 py-1.5 text-sm", cat === c ? "bg-foreground text-background" : "text-muted-foreground")}>
                  {c === "all" ? "Tất cả" : c}
                </button>
              ))}
            </div>
          </div>
          <InventorySection data={data} cat={cat} />
        </>
      ) : null}
    </div>
  )
}

/* ============================== chi nhánh ============================== */
function BranchCompare({ rows, active }: { rows: BranchSum[]; active: string }) {
  const total = rows.reduce(
    (a, r) => ({
      today: a.today + r.today.revenue,
      d30: a.d30 + r.d30.revenue,
      p30: a.p30 + r.d30.profit,
      o30: a.o30 + r.d30.orders,
      stock: a.stock + r.stock,
      cost: a.cost + r.stockCost,
      debt: a.debt + r.payableRemaining,
    }),
    { today: 0, d30: 0, p30: 0, o30: 0, stock: 0, cost: 0, debt: 0 },
  )
  return (
    <Card className="overflow-x-auto p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 className="text-sm font-semibold">So sánh chi nhánh</h2>
        <span className="text-xs text-muted-foreground">
          {active === "all" ? "Các số liệu bên dưới là tổng của cả 2 chi nhánh" : `Các số liệu bên dưới chỉ của ${rows.find((r) => r.id === active)?.name || "chi nhánh đang chọn"}`}
        </span>
      </div>
      <table className="mt-2 w-full min-w-[640px] text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-2 text-left font-medium">Chi nhánh</th>
            <th className="px-3 py-2 text-right font-medium">Doanh thu hôm nay</th>
            <th className="px-3 py-2 text-right font-medium">Đơn 30 ngày</th>
            <th className="px-3 py-2 text-right font-medium">Doanh thu 30 ngày</th>
            <th className="px-3 py-2 text-right font-medium">Lãi 30 ngày</th>
            <th className="px-3 py-2 text-right font-medium">Máy tồn</th>
            <th className="px-3 py-2 text-right font-medium">Vốn tồn kho</th>
            <th className="px-4 py-2 text-right font-medium">Còn nợ đầu hàng</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.id} className={cn("border-b", active === r.id && "bg-muted/50 font-medium")}>
              <td className="px-4 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right">{tr(r.today.revenue)}</td>
              <td className="px-3 py-2 text-right">{r.d30.orders}</td>
              <td className="px-3 py-2 text-right">{tr(r.d30.revenue)}</td>
              <td className="px-3 py-2 text-right">{tr(r.d30.profit)}</td>
              <td className="px-3 py-2 text-right">{r.stock}</td>
              <td className="px-3 py-2 text-right">{tr(r.stockCost)}</td>
              <td className="px-4 py-2 text-right">{tr(r.payableRemaining)}</td>
            </tr>
          ))}
          <tr className={cn("font-semibold", active === "all" && "bg-muted/50")}>
            <td className="px-4 py-2">Tổng</td>
            <td className="px-3 py-2 text-right">{tr(total.today)}</td>
            <td className="px-3 py-2 text-right">{total.o30}</td>
            <td className="px-3 py-2 text-right">{tr(total.d30)}</td>
            <td className="px-3 py-2 text-right">{tr(total.p30)}</td>
            <td className="px-3 py-2 text-right">{total.stock}</td>
            <td className="px-3 py-2 text-right">{tr(total.cost)}</td>
            <td className="px-4 py-2 text-right">{tr(total.debt)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  )
}

/* ============================== bán hàng ============================== */
function SalesStrip({ s }: { s: Overview["sales"] }) {
  const rows: [string, SalesSum][] = [["Hôm nay", s.today], ["7 ngày qua", s.d7], ["30 ngày qua", s.d30]]
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {rows.map(([l, v]) => (
        <Card key={l} className="p-3 sm:p-4">
          <div className="text-xs text-muted-foreground"><span className="hidden sm:inline">Bán hàng · </span>{l}</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{v.orders}</span>
            <span className="text-sm text-muted-foreground">đơn</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Doanh thu <b className="text-foreground">{tr(v.revenue)}</b> · Lãi <b className="text-foreground">{tr(v.profit)}</b>
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ============================== dòng tiền & nợ ============================== */
type FormState = { id?: string; creditor: string; type: string; description: string; amount: string; dueDate: string; note: string }
const emptyForm = (): FormState => ({ creditor: "", type: "inventory_payable", description: "", amount: "", dueDate: todayIso(), note: "" })
const digits = (s: string) => Number(String(s).replace(/[^\d]/g, "")) || 0
const moneyInput = (s: string) => {
  const n = digits(s)
  return n ? n.toLocaleString("vi-VN") : ""
}

function CashSection({ data, reload, toast }: { data: Overview; reload: () => Promise<void>; toast: ReturnType<typeof useToast>["toast"] }) {
  const [showPaid, setShowPaid] = useState(false)
  const [onlyStock, setOnlyStock] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [payFor, setPayFor] = useState<Payable | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payAcc, setPayAcc] = useState("")
  const [payNote, setPayNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [allRecv, setAllRecv] = useState(false)

  const open = data.payables.filter((p) => p.state !== "paid")
  const sum = (l: Payable[]) => l.reduce((a, p) => a + p.remaining, 0)
  const overdue = open.filter((p) => p.state === "overdue")
  const week = open.filter((p) => p.state === "today" || p.state === "soon")
  const stockDebt = open.filter((p) => p.type === "inventory_payable" || p.type === "supplier")
  const recvTotal = data.receivables.reduce((a, r) => a + r.remaining, 0)
  const cash = data.accounts.reduce((a, x) => a + x.balance, 0)

  const byCreditor = useMemo(() => {
    const m = new Map<string, { name: string; remaining: number; n: number; next: string; overdue: number }>()
    for (const p of open) {
      const x = m.get(p.creditor) || { name: p.creditor, remaining: 0, n: 0, next: "", overdue: 0 }
      x.remaining += p.remaining
      x.n++
      if (p.dueDate && (!x.next || p.dueDate < x.next)) x.next = p.dueDate
      if (p.state === "overdue") x.overdue += p.remaining
      m.set(p.creditor, x)
    }
    return [...m.values()].sort((a, b) => b.remaining - a.remaining)
  }, [open])
  const maxCred = byCreditor[0]?.remaining || 1

  const list = data.payables
    .filter((p) => showPaid || p.state !== "paid")
    .filter((p) => !onlyStock || p.type === "inventory_payable" || p.type === "supplier")
    .sort((a, b) => PAY_ORDER[a.state] - PAY_ORDER[b.state] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || b.remaining - a.remaining)

  async function saveForm() {
    if (!form) return
    setBusy(true)
    try {
      const payload = {
        creditor: form.creditor,
        description: form.description,
        principalAmount: digits(form.amount),
        dueDate: form.dueDate,
        note: form.note,
      }
      if (form.id) await api("POST", { action: "update_payable", id: form.id, ...payload })
      else await api("POST", { action: "add_payable", type: form.type, ...payload })
      toast({ title: form.id ? "Đã cập nhật khoản nợ" : "Đã thêm khoản nợ" })
      setForm(null)
      await reload()
    } catch (e: any) {
      toast({ title: "Chưa lưu được", description: e.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function savePay() {
    if (!payFor) return
    setBusy(true)
    try {
      await api("POST", { action: "pay_payable", id: payFor.id, amount: digits(payAmount), accountId: payAcc, note: payNote })
      toast({ title: "Đã ghi trả nợ", description: `${payFor.creditor}: ${vnd(digits(payAmount))}` })
      setPayFor(null)
      await reload()
    } catch (e: any) {
      toast({ title: "Chưa ghi được", description: e.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Dòng tiền và công nợ</h2>
          <div className="text-xs text-muted-foreground">Các khoản đang nợ đầu hàng, hạn trả dự kiến và số còn phải trả</div>
        </div>
        <Button size="sm" onClick={() => setForm(emptyForm())}><Plus className="mr-1 h-4 w-4" /> Thêm khoản nợ</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Tổng còn phải trả" value={tr(sum(open))} sub={`${open.length} khoản · ${byCreditor.length} chủ nợ · nợ đầu hàng ${tr(sum(stockDebt))}`} />
        <Kpi label="Quá hạn" value={tr(sum(overdue))} tone={overdue.length ? "crit" : undefined} sub={overdue.length ? `${overdue.length} khoản đã qua ngày hẹn trả` : "Không có khoản quá hạn"} />
        <Kpi label="Phải trả trong 7 ngày" value={tr(sum(week))} tone={week.length ? "warn" : undefined} sub={`${week.length} khoản (kể cả hôm nay)`} />
        <Kpi label="Khách còn nợ mình" value={tr(recvTotal)} sub={`${data.receivables.length} khoản chưa thu`} />
        <Kpi label="Tiền trong các nguồn" value={tr(cash)} sub={data.accounts.filter((a) => a.balance).map((a) => `${a.name} ${tr(a.balance)}`).join(" · ") || "Chưa có nguồn tiền"} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_3fr]">
        <Card>
          <h3 className="text-sm font-semibold">Nợ theo chủ nợ</h3>
          <div className="text-xs text-muted-foreground">Số còn phải trả · ngày hẹn gần nhất</div>
          <div className="mt-3 space-y-1">
            {byCreditor.length === 0 ? <div className="text-sm text-muted-foreground">Không còn khoản nợ nào.</div> : null}
            {byCreditor.map((c) => (
              <div key={c.name} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 rounded px-1 py-0.5 hover:bg-muted" title={`${c.name}: ${vnd(c.remaining)} · ${c.n} khoản${c.overdue ? ` · quá hạn ${vnd(c.overdue)}` : ""}`}>
                <div className="truncate text-[12.5px]">{c.name}</div>
                <div className="h-3.5">
                  <div className={cn("h-3.5 rounded-r", c.overdue ? "bg-red-500" : "bg-blue-600")} style={{ width: `${Math.max(1, (100 * c.remaining) / maxCred)}%` }} />
                </div>
                <div className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                  {tr(c.remaining)} · {c.next ? dmy(c.next) : "—"}
                </div>
              </div>
            ))}
          </div>
          {byCreditor.some((c) => c.overdue) ? <div className="mt-2 text-xs text-muted-foreground"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-500" />có khoản quá hạn</div> : null}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Khách còn nợ (lớn nhất)</h3>
            {data.receivables.length > 8 ? (
              <button className="text-xs text-blue-600 hover:underline" onClick={() => setAllRecv((v) => !v)}>{allRecv ? "Thu gọn" : `Xem cả ${data.receivables.length} khoản`}</button>
            ) : null}
          </div>
          <div className={cn("mt-2 overflow-auto", allRecv && "max-h-[360px]")}>
            <table className="w-full text-[13px]">
              <thead><tr>
                <th className="border-b px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">Khách</th>
                <th className="border-b px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">Nội dung</th>
                <th className="border-b px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">Hẹn trả</th>
                <th className="border-b px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground">Còn nợ</th>
              </tr></thead>
              <tbody>
                {[...data.receivables].sort((a, b) => b.remaining - a.remaining).slice(0, allRecv ? undefined : 8).map((r) => (
                  <tr key={r.id} className="hover:bg-muted/60">
                    <td className={td}>{r.who}{r.phone ? <div className="text-xs text-muted-foreground">{r.phone}</div> : null}</td>
                    <td className={cn(td, "max-w-[260px] truncate")} title={r.content}>{r.content || "—"}</td>
                    <td className={td}>{r.dueDate ? <>{dmy(r.dueDate)}{r.daysLeft != null && r.daysLeft < 0 ? <span className="ml-1 text-xs text-red-600">quá {-r.daysLeft} ngày</span> : null}</> : "—"}</td>
                    <td className={cn(td, "text-right font-medium")}>{fmt(r.remaining)}</td>
                  </tr>
                ))}
                {data.receivables.length === 0 ? <tr><td className={td} colSpan={4}>Không có khoản nào.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Danh sách khoản nợ phải trả</h3>
            <div className="text-xs text-muted-foreground">Sắp theo hạn trả: quá hạn lên đầu · bấm “Trả” để ghi một lần trả (trừ tiền ở nguồn đã chọn)</div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> Chỉ nợ đầu hàng</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} /> Hiện cả khoản đã trả</label>
          </div>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr>
              {["Chủ nợ", "Nội dung", "Ngày nợ", "Hạn trả", "Tình trạng", "Đã trả / Gốc", "Còn lại", ""].map((h, i) => (
                <th key={i} className={cn("whitespace-nowrap border-b px-2 py-2 text-xs font-semibold text-muted-foreground", i >= 5 && i <= 6 ? "text-right" : "text-left")}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {list.map((p) => {
                const [tone, label] = PAY_STATE[p.state]
                const pct = p.principal ? Math.min(100, (100 * p.paid) / p.principal) : 0
                return (
                  <tr key={p.id} className="hover:bg-muted/60">
                    <td className={cn(td, "font-medium")}>{p.creditor}<div className="text-xs font-normal text-muted-foreground">{p.typeLabel}{p.hasInterest ? " · có tính lãi" : ""}</div></td>
                    <td className={cn(td, "max-w-[260px]")}>{p.description || "—"}{p.note ? <div className="truncate text-xs text-muted-foreground" title={p.note}>{p.note}</div> : null}</td>
                    <td className={td}>{dmy(p.incurredAt)}</td>
                    <td className={cn(td, "whitespace-nowrap")}>{dmy(p.dueDate)}</td>
                    <td className={td}><Tag tone={tone}>{label(p)}</Tag></td>
                    <td className={cn(td, "text-right whitespace-nowrap")}>
                      <div className="whitespace-nowrap text-xs text-muted-foreground">{tr(p.paid)} / {tr(p.principal)}</div>
                      <div className="ml-auto mt-1 h-1.5 w-24 rounded bg-muted"><div className="h-1.5 rounded bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-right font-semibold", p.state === "overdue" && "text-red-600 dark:text-red-400")}>{fmt(p.remaining)}</td>
                    <td className={cn(td, "whitespace-nowrap text-right")}>
                      {p.state !== "paid" ? (
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setPayFor(p); setPayAmount(moneyInput(String(p.remaining))); setPayAcc(data.accounts.find((a) => a.balance >= p.remaining)?.id || data.accounts[0]?.id || ""); setPayNote("") }}>Trả</Button>
                      ) : null}
                      <Button size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={() => setForm({ id: p.id, creditor: p.creditor, type: p.type, description: p.description, amount: moneyInput(String(p.principal)), dueDate: p.dueDate || todayIso(), note: p.note })}>Sửa</Button>
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 ? <tr><td className={td} colSpan={8}>Không có khoản nợ nào{showPaid ? "" : " đang mở"}.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Thêm / sửa khoản nợ */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Sửa khoản nợ" : "Thêm khoản nợ"}</DialogTitle>
            <DialogDescription>Ghi số tiền mình đang nợ và ngày dự kiến trả.</DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs font-medium sm:col-span-1">Đầu hàng / chủ nợ
                <Input className="mt-1" value={form.creditor} onChange={(e) => setForm({ ...form, creditor: e.target.value })} placeholder="VD: A Đào Thành" autoFocus />
              </label>
              <label className="col-span-2 text-xs font-medium sm:col-span-1">Loại
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} disabled={!!form.id}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYABLE_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="col-span-2 text-xs font-medium">Nội dung (lô máy, ghi chú ngắn)
                <Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="VD: x8 16 Plus Lock" />
              </label>
              <label className="text-xs font-medium">Số tiền nợ (gốc)
                <Input className="mt-1 text-right tabular-nums" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: moneyInput(e.target.value) })} placeholder="0" />
              </label>
              <label className="text-xs font-medium">Ngày trả dự kiến
                <Input className="mt-1" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </label>
              <label className="col-span-2 text-xs font-medium">Ghi chú
                <Input className="mt-1" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Huỷ</Button>
            <Button onClick={saveForm} disabled={busy}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ghi trả nợ */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trả nợ: {payFor?.creditor}</DialogTitle>
            <DialogDescription>Còn phải trả {vnd(payFor?.remaining)}. Số tiền trả sẽ được trừ khỏi nguồn tiền bạn chọn.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="text-xs font-medium">Số tiền trả lần này
              <Input className="mt-1 text-right tabular-nums" inputMode="numeric" value={payAmount} onChange={(e) => setPayAmount(moneyInput(e.target.value))} />
            </label>
            <label className="text-xs font-medium">Trả từ nguồn tiền
              <Select value={payAcc} onValueChange={setPayAcc}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Chọn nguồn tiền" /></SelectTrigger>
                <SelectContent>{data.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · còn {tr(a.balance)}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="text-xs font-medium">Ghi chú
              <Input className="mt-1" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="VD: chuyển khoản VCB" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Huỷ</Button>
            <Button onClick={savePay} disabled={busy || !digits(payAmount) || !payAcc}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Ghi trả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ============================== kho ============================== */
type GKey = "key" | "n" | "lvl" | "cost" | "price" | "profit" | "avgAge" | "maxAge" | "sold30" | "cover"
type IKey = "id" | "date" | "age" | "name" | "cap" | "type" | "color" | "pin" | "cond" | "cost" | "price" | "m"
const AGE_BUCKETS: [string, number, number, string][] = [
  ["0–7 ngày", 0, 7, "bg-blue-200 dark:bg-blue-900"],
  ["8–14", 8, 14, "bg-blue-300 dark:bg-blue-800"],
  ["15–30", 15, 30, "bg-blue-500 dark:bg-blue-600"],
  ["31–60", 31, 60, "bg-blue-700 dark:bg-blue-400"],
  [">60 ngày", 61, 1e9, "bg-blue-900 dark:bg-blue-200"],
]

function InventorySection({ data, cat }: { data: Overview; cat: "all" | "iPhone" | "iPad" }) {
  const [gs, setGs] = useState<{ k: GKey; d: number }>({ k: "cost", d: -1 })
  const [is, setIs] = useState<{ k: IKey; d: number }>({ k: "age", d: -1 })
  const [q, setQ] = useState("")
  const G = data.groups.filter((g) => cat === "all" || g.cat === cat)
  const I = data.items.filter((i) => cat === "all" || i.cat === cat)

  const n = I.length
  const cost = I.reduce((a, i) => a + i.cost, 0)
  const priced = I.filter((i) => i.price)
  const pp = priced.reduce((a, i) => a + (i.price || 0), 0)
  const pc = priced.reduce((a, i) => a + i.cost, 0)
  const avg = n ? Math.round(I.reduce((a, i) => a + i.age, 0) / n) : 0
  const old = I.filter((i) => i.age > 30)
  const ip = I.filter((i) => i.cat === "iPhone").length

  const bars = [...G].sort((a, b) => b.cost - a.cost)
  const mx = bars[0]?.cost || 1
  const buckets = AGE_BUCKETS.map(([l, lo, hi, c]) => {
    const list = I.filter((i) => i.age >= lo && i.age <= hi)
    const top: Record<string, number> = {}
    list.forEach((i) => (top[i.key] = (top[i.key] || 0) + 1))
    return { l, c, n: list.length, cost: list.reduce((a, i) => a + i.cost, 0), top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 4) }
  })
  const am = Math.max(1, ...buckets.map((b) => b.n))

  const alerts = useMemo(() => {
    const by: Record<string, string[]> = {}
    for (const i of I)
      for (const f of i.flags) {
        const k = f.startsWith("Đã có đơn") ? "Đã có đơn bán nhưng vẫn nằm trong kho" : f
        const extra = f.startsWith("Đã có đơn") ? ` (${f.replace("Đã có đơn bán ", "").replace(" nhưng vẫn nằm trong kho", "")})` : ""
        ;(by[k] = by[k] || []).push((i.id || i.imei || i.serial || "?") + extra)
      }
    return Object.entries(by)
  }, [I])

  const GG = sortBy(G.map((g) => ({ ...g, lvl: lvl(g), coverS: g.cover ?? 1e9 })), (gs.k === "cover" ? "coverS" : gs.k) as any, gs.d)
  const ql = fold(q.trim())
  const II = sortBy(
    I.map((i) => ({ ...i, m: i.price ? i.price - i.cost : null })).filter((i) => !ql || fold([i.id, i.name, i.color, i.imei, i.serial, i.cond, i.cap, i.type].join(" ")).includes(ql)),
    is.k as any,
    is.d,
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Tổng máy tồn" value={n} sub={`${ip} iPhone · ${n - ip} iPad/khác · ${G.length} mã`} />
        <Kpi label="Vốn tồn kho (giá nhập)" value={tr(cost)} sub={vnd(cost)} />
        <Kpi label="Giá trị bán dự kiến" value={tr(pp)} sub={priced.length < n ? `${n - priced.length} máy chưa có giá bán` : "theo cột Giá Bán"} />
        <Kpi label="Lãi dự kiến" value={tr(pp - pc)} sub={pp ? `biên ${((100 * (pp - pc)) / pp).toFixed(1).replace(".", ",")}% trên giá bán` : "—"} />
        <Kpi label="Tuổi kho trung bình" value={`${avg} ngày`} sub={n ? `máy lâu nhất ${Math.max(...I.map((i) => i.age))} ngày` : "—"} />
        <Kpi label="Tồn trên 30 ngày" value={`${old.length} máy`} tone={old.length ? "warn" : undefined} sub={`đọng ${tr(old.reduce((a, i) => a + i.cost, 0))} vốn`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
        <Card>
          <h3 className="text-sm font-semibold">Vốn tồn theo mã</h3>
          <div className="text-xs text-muted-foreground">Tổng giá nhập của máy còn trong kho · số máy và số tiền ở cột phải</div>
          <div className="mt-3 space-y-0.5">
            {bars.map((g) => (
              <div key={g.key} className="grid grid-cols-[minmax(0,190px)_1fr_auto] items-center gap-2 rounded px-1 py-0.5 hover:bg-muted" title={`${g.key}\n${g.n} máy · vốn ${vnd(g.cost)}\nGiá bán DK ${vnd(g.price)} · lãi ${tr(g.profit)}\nTuổi TB ${g.avgAge} ngày · lâu nhất ${g.maxAge} ngày\nBán 30 ngày qua: ${g.sold30} máy`}>
                <div className="truncate text-[12.5px]">{g.key}</div>
                <div className="h-3.5"><div className="h-3.5 rounded-r bg-blue-600" style={{ width: `${Math.max(0.6, (100 * g.cost) / mx)}%` }} /></div>
                <div className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">{g.n} máy · {tr(g.cost)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold">Tuổi tồn kho</h3>
          <div className="text-xs text-muted-foreground">Số máy theo số ngày nằm kho (tính từ Ngày Nhập)</div>
          <div className="mt-4 flex h-[200px] items-end gap-3 border-b px-1">
            {buckets.map((b) => (
              <div key={b.l} className="flex h-full flex-1 flex-col items-center justify-end" title={`${b.l} · ${b.n} máy · vốn ${tr(b.cost)}\n${b.top.map(([k, v]) => `${k}: ${v}`).join("\n")}`}>
                <div className="mb-1 text-sm font-semibold">{b.n}</div>
                <div className={cn("w-full max-w-16 rounded-t", b.c)} style={{ height: Math.max(2, (150 * b.n) / am) }} />
              </div>
            ))}
          </div>
          <div className="flex gap-3 px-1 pt-1.5">
            {buckets.map((b) => <div key={b.l} className="flex-1 text-center text-xs text-muted-foreground">{b.l}</div>)}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {buckets.map((b, i) => <span key={b.l}>{i ? " · " : ""}{b.l}: <b className="text-foreground">{tr(b.cost)}</b></span>)}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold">Cần kiểm tra lại</h3>
        {alerts.length ? (
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed">
            {alerts.map(([k, v]) => <li key={k}><b>{k}</b>: {v.length} máy: {v.join(", ")}</li>)}
          </ul>
        ) : <div className="mt-2 text-sm text-muted-foreground">Không có gì cần kiểm tra.</div>}
        <div className="mt-2 text-xs text-muted-foreground">Sửa các dòng này ở tab “Sửa dữ liệu” (tìm theo ID máy).</div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Tồn kho theo mã</h3>
        <div className="text-xs text-muted-foreground">Bấm tiêu đề cột để sắp xếp · “Đủ bán” = số máy tồn ÷ tốc độ bán 30 ngày qua</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr>
              <Th k="key" sort={gs} setSort={setGs}>Mã (dòng · dung lượng · loại)</Th>
              <Th k="n" sort={gs} setSort={setGs} right>SL</Th>
              <Th k="lvl" sort={gs} setSort={setGs}>Mức tồn</Th>
              <Th k="cost" sort={gs} setSort={setGs} right>Vốn tồn</Th>
              <Th k="price" sort={gs} setSort={setGs} right>Giá bán DK</Th>
              <Th k="profit" sort={gs} setSort={setGs} right>Lãi DK</Th>
              <Th k="avgAge" sort={gs} setSort={setGs} right>Tuổi TB</Th>
              <Th k="maxAge" sort={gs} setSort={setGs} right>Lâu nhất</Th>
              <Th k="sold30" sort={gs} setSort={setGs} right>Bán 30N</Th>
              <Th k="cover" sort={gs} setSort={setGs} right>Đủ bán</Th>
              <th className="border-b px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Nhận xét</th>
            </tr></thead>
            <tbody>
              {GG.map((g) => {
                const [tone, txt] = speed(g)
                const l = lvl(g)
                return (
                  <tr key={g.key} className="hover:bg-muted/60">
                    <td className={td}>{g.key}</td>
                    <td className={cn(td, "text-right font-semibold")}>{g.n}</td>
                    <td className={td}><Tag tone={l === "Nhiều" ? "ser" : l === "Vừa" ? "neu" : "good"}>{l}</Tag></td>
                    <td className={cn(td, "text-right whitespace-nowrap")}>{fmt(g.cost)}</td>
                    <td className={cn(td, "text-right whitespace-nowrap")}>{fmt(g.price)}</td>
                    <td className={cn(td, "text-right whitespace-nowrap")}>{fmt(g.profit)}</td>
                    <td className={cn(td, "text-right whitespace-nowrap")}>{g.avgAge} ng</td>
                    <td className={cn(td, "text-right whitespace-nowrap")}><AgeTag a={g.maxAge} /></td>
                    <td className={cn(td, "text-right whitespace-nowrap")}>{g.sold30}</td>
                    <td className={cn(td, "text-right whitespace-nowrap")}>{g.cover == null ? "—" : `~${g.cover} ng`}</td>
                    <td className={td}><Tag tone={tone}>{txt}</Tag></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Chi tiết từng máy</h3>
            <div className="text-xs text-muted-foreground">{II.length} máy · bấm tiêu đề cột để sắp xếp</div>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ID, tên máy, màu, IMEI…" />
          </div>
        </div>
        <div className="mt-2 max-h-[640px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-card"><tr>
              <Th k="id" sort={is} setSort={setIs}>ID</Th>
              <Th k="date" sort={is} setSort={setIs}>Ngày nhập</Th>
              <Th k="age" sort={is} setSort={setIs} right>Ngày tồn</Th>
              <Th k="name" sort={is} setSort={setIs}>Sản phẩm</Th>
              <Th k="cap" sort={is} setSort={setIs}>DL</Th>
              <Th k="type" sort={is} setSort={setIs}>Loại</Th>
              <Th k="color" sort={is} setSort={setIs}>Màu</Th>
              <Th k="pin" sort={is} setSort={setIs}>Pin</Th>
              <Th k="cond" sort={is} setSort={setIs}>Tình trạng</Th>
              <Th k="cost" sort={is} setSort={setIs} right>Giá nhập</Th>
              <Th k="price" sort={is} setSort={setIs} right>Giá bán</Th>
              <Th k="m" sort={is} setSort={setIs} right>Lãi</Th>
            </tr></thead>
            <tbody>
              {II.map((i, ix) => (
                <tr key={`${i.id}-${ix}`} className="hover:bg-muted/60">
                  <td className={cn(td, "font-semibold")}>{i.id || "—"}</td>
                  <td className={cn(td, "whitespace-nowrap")}>{dmy(i.date)}</td>
                  <td className={cn(td, "text-right whitespace-nowrap")}><AgeTag a={i.age} /></td>
                  <td className={td}>{i.name}{i.flags.length ? <div className="text-xs text-red-600 dark:text-red-400">⚠ {i.flags.join("; ")}</div> : null}</td>
                  <td className={td}>{i.cap}</td>
                  <td className={td}><TypeChip value={i.type} /></td>
                  <td className={cn(td, "whitespace-nowrap")}><ColorChip value={i.color} /></td>
                  <td className={td}>{i.pin}</td>
                  <td className={cn(td, "max-w-[220px]")}>{i.cond}</td>
                  <td className={cn(td, "text-right whitespace-nowrap")}>{fmt(i.cost)}</td>
                  <td className={cn(td, "text-right whitespace-nowrap")}>{fmt(i.price)}</td>
                  <td className={cn(td, "text-right", i.m != null && i.m < 0 && "font-semibold text-red-600")}>{fmt(i.m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="text-xs text-muted-foreground">Giá bán DK = cột Giá Bán, chưa trừ giảm giá/phụ kiện. Tổng hợp tính cả các dòng ở mục “Cần kiểm tra”.</div>
    </div>
  )
}
