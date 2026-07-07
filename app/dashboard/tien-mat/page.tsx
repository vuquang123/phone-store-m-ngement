// app/dashboard/tien-mat/page.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { RefreshButton } from "@/components/ui/refresh-button"
import { useToast } from "@/hooks/use-toast"
import { useAuthMe } from "@/hooks/use-auth-me"
import { ArrowDownCircle, ArrowUpCircle, Wallet, Loader2, ImagePlus, X } from "lucide-react"

type CashType = "thu" | "chi"
type FilterType = "all" | "day" | "month" | "year"

interface CashEntry {
  id: string
  loai: CashType
  so_tien: number
  so_du_sau: number
  nguon: string
  ma_tham_chieu: string
  ly_do: string
  nhan_vien: string
  ghi_chu: string
  created_at: string
}

interface CashResponse {
  success: boolean
  balance: number
  summary: { totalThu: number; totalChi: number; count: number }
  entries: CashEntry[]
}

const fmt = (n: number) => Number(n || 0).toLocaleString("vi-VN") + "₫"

const NGUON_LABEL: Record<string, string> = {
  ban_hang: "Bán hàng",
  thu_cong: "Thủ công",
  hoan_tra: "Hoàn trả",
  dat_coc: "Đặt cọc",
  khach_offline: "Khách offline",
  khach_online: "Khách online",
}
const nguonLabel = (s: string) => NGUON_LABEL[s] || s || "—"

const formatDate = (iso: string) => {
  const t = Date.parse(iso)
  if (!t) return iso || "—"
  return new Date(t).toLocaleString("vi-VN")
}

const pad = (n: number) => String(n).padStart(2, "0")
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toYM = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export default function TienMatPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { me } = useAuthMe()
  const isManager = me?.role === "quan_ly" // Chỉ Quản lý mới xem Tổng thu/chi + biểu đồ
  const fileRef = useRef<HTMLInputElement | null>(null)

  const { data, isLoading, isFetching, refetch } = useQuery<CashResponse>({
    queryKey: ["tien-mat"],
    queryFn: async () => {
      const res = await fetch("/api/tien-mat", { cache: "no-store" })
      if (!res.ok) throw new Error("Không tải được quỹ tiền mặt")
      return res.json()
    },
    staleTime: 30_000,
  })

  // ===== Bộ lọc theo ngày / tháng / năm =====
  const now = new Date()
  const [filterType, setFilterType] = useState<FilterType>("month")
  const [filterDay, setFilterDay] = useState(toYMD(now))
  const [filterMonth, setFilterMonth] = useState(toYM(now))
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()))

  const allEntries = data?.entries ?? []

  const inPeriod = (iso: string) => {
    if (filterType === "all") return true
    const d = new Date(iso)
    if (isNaN(d.getTime())) return false
    if (filterType === "day") return toYMD(d) === filterDay
    if (filterType === "month") return toYM(d) === filterMonth
    if (filterType === "year") return String(d.getFullYear()) === filterYear
    return true
  }

  const filtered = useMemo(
    () => allEntries.filter((e) => inPeriod(e.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEntries, filterType, filterDay, filterMonth, filterYear],
  )

  const periodThu = filtered.reduce((s, e) => s + (e.loai === "thu" ? e.so_tien : 0), 0)
  const periodChi = filtered.reduce((s, e) => s + (e.loai === "chi" ? e.so_tien : 0), 0)

  // ===== Phân trang bảng lịch sử =====
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Reset/clamp trang khi đổi bộ lọc hoặc khi danh sách thu nhỏ
  useEffect(() => {
    setPage(1)
  }, [filterType, filterDay, filterMonth, filterYear])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const pagedEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ===== Dữ liệu biểu đồ: gom theo tháng (năm/tất cả) hoặc theo ngày (tháng/ngày) =====
  const chartData = useMemo(() => {
    const byMonth = filterType === "year" || filterType === "all"
    const map = new Map<string, { label: string; key: string; thu: number; chi: number }>()
    for (const e of filtered) {
      const d = new Date(e.created_at)
      if (isNaN(d.getTime())) continue
      const key = byMonth ? toYM(d) : toYMD(d)
      const label = byMonth ? `Th${d.getMonth() + 1}` : pad(d.getDate())
      const cur = map.get(key) || { label, key, thu: 0, chi: 0 }
      if (e.loai === "thu") cur.thu += e.so_tien
      else cur.chi += e.so_tien
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [filtered, filterType])

  // ===== Dialog thu/chi =====
  const [open, setOpen] = useState(false)
  const [dialogLoai, setDialogLoai] = useState<CashType>("thu")
  const [soTienRaw, setSoTienRaw] = useState("")
  const [lyDo, setLyDo] = useState("")
  const [ghiChu, setGhiChu] = useState("")
  const [imagePreview, setImagePreview] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  const openDialog = (loai: CashType) => {
    setDialogLoai(loai)
    setSoTienRaw("")
    setLyDo("")
    setGhiChu("")
    setImagePreview("")
    if (fileRef.current) fileRef.current.value = ""
    setOpen(true)
  }

  const onPickImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Lỗi", description: "Vui lòng chọn tệp hình ảnh", variant: "destructive" })
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImagePreview(String(reader.result || ""))
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    const so_tien = Number(soTienRaw.replace(/[^\d]/g, ""))
    if (!Number.isFinite(so_tien) || so_tien <= 0) {
      toast({ title: "Lỗi", description: "Số tiền phải lớn hơn 0", variant: "destructive" })
      return
    }
    if (!imagePreview) {
      toast({ title: "Lỗi", description: "Vui lòng đính kèm hình ảnh", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/tien-mat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loai: dialogLoai,
          so_tien,
          ly_do: lyDo,
          ghi_chu: ghiChu,
          image_base64: imagePreview || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || "Ghi quỹ thất bại")
      toast({
        title: dialogLoai === "thu" ? "Đã nhập quỹ" : "Đã xuất quỹ",
        description: `Số dư hiện tại: ${fmt(json.balance)}`,
      })
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["tien-mat"] })
    } catch (e: any) {
      toast({ title: "Lỗi", description: e?.message || "Có lỗi xảy ra", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const balance = data?.balance ?? 0
  const soTienDisplay = soTienRaw ? Number(soTienRaw.replace(/[^\d]/g, "")).toLocaleString("vi-VN") : ""

  const FILTER_TABS: { key: FilterType; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "day", label: "Ngày" },
    { key: "month", label: "Tháng" },
    { key: "year", label: "Năm" },
  ]

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quỹ tiền mặt</h1>
            <p className="text-muted-foreground">Theo dõi và ghi nhận thu/chi tiền mặt của cửa hàng</p>
          </div>
          <RefreshButton onRefresh={() => { refetch() }} loading={isFetching} label />
        </div>

        {/* Bộ lọc theo kỳ */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            {FILTER_TABS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={filterType === t.key ? "default" : "ghost"}
                className="h-8"
                onClick={() => setFilterType(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          {filterType === "day" && (
            <Input type="date" value={filterDay} onChange={(e) => setFilterDay(e.target.value)} className="w-auto h-9" />
          )}
          {filterType === "month" && (
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-auto h-9" />
          )}
          {filterType === "year" && (
            <Input
              type="number"
              min={2020}
              max={2100}
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-28 h-9"
            />
          )}
        </div>

        {/* Card tổng quan — Số dư luôn hiện; Tổng thu/chi chỉ Quản lý */}
        <div className={`grid gap-4 ${isManager ? "sm:grid-cols-3" : ""}`}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Số dư hiện tại
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-green-600">{fmt(balance)}</div>
            </CardContent>
          </Card>
          {isManager && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4" /> Tổng thu {filterType !== "all" ? "(trong kỳ)" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{fmt(periodThu)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <ArrowDownCircle className="h-4 w-4" /> Tổng chi {filterType !== "all" ? "(trong kỳ)" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{fmt(periodChi)}</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Biểu đồ thu/chi — chỉ Quản lý */}
        {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Biểu đồ thu / chi</CardTitle>
            <CardDescription>
              {filterType === "year" || filterType === "all" ? "Theo tháng" : "Theo ngày"} — cột xanh: thu, cột đỏ: chi
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Không có dữ liệu trong kỳ</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      width={70}
                      tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}tr` : v.toLocaleString("vi-VN"))}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted-foreground))", fillOpacity: 0.12 }}
                      formatter={(v: any, name: any) => [fmt(Number(v)), name === "thu" ? "Thu" : "Chi"]}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
                      }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ padding: "2px 0" }}
                    />
                    <Legend formatter={(v) => (v === "thu" ? "Thu" : "Chi")} />
                    <Bar dataKey="thu" name="thu" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="chi" name="chi" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* 2 nút thu/chi */}
        <div className="flex flex-wrap gap-3">
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => openDialog("thu")}>
            <ArrowUpCircle className="mr-2 h-4 w-4" /> Nhập quỹ
          </Button>
          <Button variant="destructive" onClick={() => openDialog("chi")}>
            <ArrowDownCircle className="mr-2 h-4 w-4" /> Xuất quỹ
          </Button>
        </div>

        {/* Lịch sử */}
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử giao dịch</CardTitle>
            <CardDescription>
              {filtered.length} giao dịch {filterType !== "all" ? "trong kỳ" : ""} (mới nhất trước)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Chưa có giao dịch nào</div>
            ) : (
              <ResponsiveTable
                data={pagedEntries}
                rowKey={(e) => e.id}
                minWidth="min-w-[780px]"
                columns={[
                  { key: "time", header: "Thời gian", className: "whitespace-nowrap text-sm", cell: (e) => formatDate(e.created_at) },
                  { key: "loai", header: "Loại", cell: (e) => e.loai === "thu" ? <Badge className="bg-green-600 hover:bg-green-600">Thu</Badge> : <Badge variant="destructive">Chi</Badge> },
                  { key: "sotien", header: "Số tiền", className: "text-right", cell: (e) => <span className={`font-medium ${e.loai === "thu" ? "text-green-600" : "text-red-600"}`}>{e.loai === "thu" ? "+" : "-"}{fmt(e.so_tien)}</span> },
                  { key: "sodu", header: "Số dư sau", className: "text-right", cell: (e) => fmt(e.so_du_sau) },
                  { key: "nguon", header: "Nguồn", className: "text-sm", cell: (e) => <>{nguonLabel(e.nguon)}{e.ma_tham_chieu && <span className="block font-mono text-xs text-muted-foreground">{e.ma_tham_chieu}</span>}</> },
                  { key: "lydo", header: "Lý do", className: "text-sm", cell: (e) => <>{e.ly_do || "—"}{e.ghi_chu?.includes("📎") && <span title="Có ảnh đính kèm"> 📎</span>}</> },
                  { key: "nv", header: "Nhân viên", className: "text-sm", cell: (e) => e.nhan_vien || "—" },
                ]}
                renderCard={(e) => (
                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(e.created_at)}</span>
                      {e.loai === "thu" ? <Badge className="bg-green-600 hover:bg-green-600">Thu</Badge> : <Badge variant="destructive">Chi</Badge>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-base font-semibold ${e.loai === "thu" ? "text-green-600" : "text-red-600"}`}>{e.loai === "thu" ? "+" : "-"}{fmt(e.so_tien)}</span>
                      <span className="text-xs text-muted-foreground">Dư: {fmt(e.so_du_sau)}</span>
                    </div>
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      <div>Nguồn: <span className="text-foreground">{nguonLabel(e.nguon)}</span>{e.ma_tham_chieu ? <span className="ml-1 font-mono text-xs">({e.ma_tham_chieu})</span> : null}</div>
                      {e.ly_do ? <div>Lý do: <span className="text-foreground">{e.ly_do}</span>{e.ghi_chu?.includes("📎") ? " 📎" : ""}</div> : null}
                      {e.nhan_vien ? <div>NV: <span className="text-foreground">{e.nhan_vien}</span></div> : null}
                    </div>
                  </div>
                )}
              />
            )}

            {filtered.length > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length} giao dịch
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Trước
                  </Button>
                  <span className="text-sm tabular-nums">
                    Trang {page}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog thu/chi dùng chung */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogLoai === "thu" ? "Nhập quỹ tiền mặt" : "Xuất quỹ tiền mặt"}</DialogTitle>
              <DialogDescription>
                {dialogLoai === "thu"
                  ? "Ghi nhận một khoản tiền mặt vào quỹ."
                  : "Ghi nhận một khoản chi tiền mặt từ quỹ."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="so_tien">Số tiền</Label>
                <Input
                  id="so_tien"
                  inputMode="numeric"
                  placeholder="0"
                  value={soTienDisplay}
                  onChange={(e) => setSoTienRaw(e.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ly_do">Lý do</Label>
                <Input
                  id="ly_do"
                  placeholder={dialogLoai === "thu" ? "VD: Tiền khách trả nợ" : "VD: Trả tiền ship"}
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ghi_chu">Ghi chú</Label>
                <Input
                  id="ghi_chu"
                  placeholder="Ghi chú thêm (không bắt buộc)"
                  value={ghiChu}
                  onChange={(e) => setGhiChu(e.target.value)}
                />
              </div>

              {/* Đính kèm ảnh */}
              <div className="space-y-2">
                <Label>
                  Hình ảnh đính kèm <span className="text-destructive">*</span>
                </Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                />
                {imagePreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Ảnh đính kèm" className="h-28 rounded-md border object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview("")
                        if (fileRef.current) fileRef.current.value = ""
                      }}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow"
                      aria-label="Xoá ảnh"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                    <ImagePlus className="h-4 w-4" /> Chọn ảnh
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Ảnh sẽ được gửi lên nhóm Telegram quỹ để minh bạch.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Huỷ
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className={dialogLoai === "thu" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                variant={dialogLoai === "chi" ? "destructive" : "default"}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dialogLoai === "thu" ? "Nhập quỹ" : "Xuất quỹ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
