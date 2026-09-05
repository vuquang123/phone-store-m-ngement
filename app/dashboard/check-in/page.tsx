// app/dashboard/check-in/page.tsx
"use client"

import { Fragment, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { RefreshButton } from "@/components/ui/refresh-button"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ImagePlus, X, Send, Copy } from "lucide-react"
import {
  SERIES_KEYS,
  SERIES_LABELS,
  type SeriesCounts,
  type SeriesKey,
  type WebStock,
} from "@/lib/check-in-shared"

interface CheckinRow {
  id: string
  thoi_gian: string
  nhan_vien: string
  ca: string
  trang_thai: string
  ly_do: string
  tong_web: number
  tong_thuc_te: number
  so_anh: number
  tien_mat: number
}

// Người dùng chỉ nhập số ĐẾM THỰC TẾ theo từng dòng máy; cột Website lấy tự động từ Kho_Hang.
type CountState = Record<SeriesKey, string>

const EMPTY: CountState = { s17: "", s16: "", s15: "", ipad: "", khac: "" }
const EMPTY_WEB: SeriesCounts & { total: number } = { s17: 0, s16: 0, s15: 0, ipad: 0, khac: 0, total: 0 }
const MAX_IMAGES = 6

const n = (v: string) => Number(v || 0) || 0

const statusBadge = (tt: string) =>
  /khớp/i.test(tt) && !/không/i.test(tt) ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">Khớp</Badge>
  ) : (
    <Badge variant="destructive">Không khớp</Badge>
  )

export default function CheckInPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const { data: history, isLoading: loadingHistory, isFetching: fetchingHistory, refetch: refetchHistory } =
    useQuery<CheckinRow[]>({
      queryKey: ["check-in-history"],
      queryFn: async () => {
        const res = await fetch("/api/check-in", { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        return Array.isArray(json?.data) ? json.data : []
      },
      staleTime: 30_000,
    })

  const {
    data: webStock,
    isLoading: loadingStock,
    isFetching: fetchingStock,
    refetch: refetchStock,
  } = useQuery<WebStock | null>({
    queryKey: ["check-in-web-stock"],
    queryFn: async () => {
      const res = await fetch("/api/check-in/ton-kho?refresh=1", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.message || "Không đọc được tồn kho website")
      return json.data as WebStock
    },
    staleTime: 60_000,
  })

  const webKhoNgoai = webStock?.khoNgoai ?? EMPTY_WEB
  const webKhoTrong = webStock?.khoTrong ?? EMPTY_WEB

  const [ca, setCa] = useState("1")
  const [khoNgoai, setKhoNgoai] = useState<CountState>({ ...EMPTY })
  const [khoTrong, setKhoTrong] = useState<CountState>({ ...EMPTY })
  const [trangThai, setTrangThai] = useState<"khop" | "khong_khop">("khop")
  const [lyDo, setLyDo] = useState("")
  const [tienMatRaw, setTienMatRaw] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const tienMatDisplay = tienMatRaw ? Number(tienMatRaw).toLocaleString("vi-VN") : ""

  const lineTotal = (k: CountState) => SERIES_KEYS.reduce((sum, key) => sum + n(k[key]), 0)

  const copyFromWeb = (
    web: SeriesCounts,
    setState: React.Dispatch<React.SetStateAction<CountState>>,
  ) => setState(SERIES_KEYS.reduce((acc, k) => ({ ...acc, [k]: String(web[k]) }), {} as CountState))

  const onPickImages = (files: FileList | null) => {
    if (!files || !files.length) return
    const room = MAX_IMAGES - images.length
    if (room <= 0) {
      toast({ title: "Tối đa 6 ảnh", variant: "destructive" })
      return
    }
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room)
    picked.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, String(reader.result || "")]))
      reader.readAsDataURL(file)
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  const resetForm = () => {
    setCa("1")
    setKhoNgoai({ ...EMPTY })
    setKhoTrong({ ...EMPTY })
    setTrangThai("khop")
    setLyDo("")
    setTienMatRaw("")
    setImages([])
  }

  const handleSubmit = async () => {
    if (trangThai === "khong_khop" && !lyDo.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập lý do khi không khớp", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      // Tổng thực tế = cộng dồn các dòng máy; tổng website lấy thẳng từ Kho_Hang.
      const pickSeries = <T,>(get: (key: SeriesKey) => T) =>
        SERIES_KEYS.reduce((acc, key) => ({ ...acc, [key]: get(key) }), {} as Record<SeriesKey, T>)

      const toNums = (k: CountState, web: SeriesCounts & { total: number }) => ({
        website: web.total,
        thucTe: lineTotal(k),
        ...pickSeries((key) => n(k[key])),
        web: pickSeries((key) => web[key]),
      })
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ca,
          khoNgoai: toNums(khoNgoai, webKhoNgoai),
          khoTrong: toNums(khoTrong, webKhoTrong),
          trangThai,
          lyDo: trangThai === "khong_khop" ? lyDo : undefined,
          tienMat: Number(tienMatRaw || 0) || 0,
          images,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.message || "Gửi check-in thất bại")
      toast({ title: "Đã gửi báo cáo check-in" })
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["check-in-history"] })
      queryClient.invalidateQueries({ queryKey: ["check-in-web-stock"] })
    } catch (e: any) {
      toast({ title: "Lỗi", description: e?.message || "Có lỗi xảy ra", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const renderKhoCard = (
    title: string,
    state: CountState,
    setState: React.Dispatch<React.SetStateAction<CountState>>,
    web: SeriesCounts & { total: number },
  ) => {
    const tongThucTe = lineTotal(state)
    const lech = tongThucTe - web.total
    const chuaDem = SERIES_KEYS.every((k) => state[k] === "")
    const slug = title.toLowerCase().replace(/[^a-z]+/g, "-")
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => copyFromWeb(web, setState)}
            disabled={loadingStock}
          >
            <Copy className="h-3 w-3" />
            Chép từ website
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[1fr_64px_84px] items-center gap-x-2 gap-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Dòng máy</span>
            <span className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Website</span>
            <span className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Thực tế</span>

            {SERIES_KEYS.map((key) => {
              const thucTe = n(state[key])
              const lechDong = state[key] !== "" && thucTe !== web[key]
              return (
                <Fragment key={key}>
                  <Label htmlFor={`${slug}-${key}`} className="text-xs font-normal text-muted-foreground">
                    {SERIES_LABELS[key]}
                  </Label>
                  <div
                    className={`flex h-9 items-center justify-center rounded-md border bg-muted/40 text-sm tabular-nums ${
                      lechDong ? "border-amber-400 text-amber-600 dark:text-amber-400" : ""
                    }`}
                    title="Số máy đang tồn trên website (tự động)"
                  >
                    {loadingStock ? <Loader2 className="h-3 w-3 animate-spin" /> : web[key]}
                  </div>
                  <Input
                    id={`${slug}-${key}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    className={`h-9 text-center tabular-nums ${lechDong ? "border-amber-400" : ""}`}
                    value={state[key]}
                    onChange={(e) => setState((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </Fragment>
              )
            })}

            <span className="text-xs font-semibold">Tổng</span>
            <div className="flex h-9 items-center justify-center rounded-md border border-transparent text-sm font-semibold tabular-nums">
              {loadingStock ? "—" : web.total}
            </div>
            <div className="flex h-9 items-center justify-center rounded-md border border-transparent text-sm font-semibold tabular-nums">
              {tongThucTe}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {chuaDem ? (
              "Chưa đếm thực tế"
            ) : lech === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">Khớp với website</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                Lệch {lech > 0 ? `+${lech}` : lech} máy so với website
              </span>
            )}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Check-in đầu ca</h1>
        </div>

        {/* Ca + Tiền mặt đầu ca */}
        <div className="flex flex-wrap gap-4">
          <div className="w-[160px] space-y-2">
            <Label>Ca làm việc</Label>
            <Select value={ca} onValueChange={setCa}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Ca 1</SelectItem>
                <SelectItem value="2">Ca 2</SelectItem>
                <SelectItem value="3">Ca 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[200px] space-y-2">
            <Label>Tiền mặt đầu ca</Label>
            <Input
              inputMode="numeric"
              placeholder="0"
              value={tienMatDisplay}
              onChange={(e) => setTienMatRaw(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>

        {/* 2 kho */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Cột <span className="font-medium text-foreground">Website</span> lấy tự động từ kho hàng trên web
            {webStock?.capturedAt ? ` (lúc ${webStock.capturedAt})` : ""}. Đếm máy thực tế rồi điền vào cột{" "}
            <span className="font-medium text-foreground">Thực tế</span>.
          </p>
          <RefreshButton onRefresh={() => { refetchStock() }} loading={fetchingStock} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {renderKhoCard("KHO NGOÀI", khoNgoai, setKhoNgoai, webKhoNgoai)}
          {renderKhoCard("KHO TRONG", khoTrong, setKhoTrong, webKhoTrong)}
        </div>

        {/* Trạng thái */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trạng thái</CardTitle>
            <CardDescription>Đối chiếu số liệu thực tế với website</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup
              value={trangThai}
              onValueChange={(v) => setTrangThai(v as "khop" | "khong_khop")}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="khop" id="tt-khop" />
                <Label htmlFor="tt-khop" className="cursor-pointer font-normal">Khớp</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="khong_khop" id="tt-khong" />
                <Label htmlFor="tt-khong" className="cursor-pointer font-normal">Không khớp</Label>
              </div>
            </RadioGroup>
            {trangThai === "khong_khop" && (
              <div className="space-y-1">
                <Label htmlFor="lydo">Lý do <span className="text-red-500">*</span></Label>
                <Textarea
                  id="lydo"
                  placeholder="Nêu rõ lý do lệch số liệu..."
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ảnh đính kèm */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ảnh đính kèm</CardTitle>
            <CardDescription>Tối đa {MAX_IMAGES} ảnh (ảnh kho, màn hình website...)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPickImages(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Ảnh ${i + 1}`} className="h-20 w-20 rounded-md border object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white shadow"
                    aria-label="Xoá ảnh"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:bg-accent"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">Thêm ảnh</span>
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Gửi check-in
          </Button>
        </div>

        {/* Lịch sử check-in */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Lịch sử check-in</CardTitle>
              <CardDescription>Các lần check-in gần nhất (mới nhất trước)</CardDescription>
            </div>
            <RefreshButton onRefresh={() => { refetchHistory() }} loading={fetchingHistory} />
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải...
              </div>
            ) : !history || history.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Chưa có lịch sử check-in</div>
            ) : (
              <ResponsiveTable
                data={history}
                rowKey={(h) => h.id}
                minWidth="min-w-[720px]"
                columns={[
                  { key: "time", header: "Thời gian", className: "whitespace-nowrap text-sm", cell: (h) => h.thoi_gian },
                  { key: "nv", header: "Nhân viên", className: "text-sm", cell: (h) => h.nhan_vien || "—" },
                  { key: "ca", header: "Ca", className: "text-center text-sm", cell: (h) => h.ca },
                  { key: "tt", header: "Trạng thái", cell: (h) => statusBadge(h.trang_thai) },
                  { key: "ttweb", header: "Thực tế / Web", className: "text-center text-sm tabular-nums", cell: (h) => `${h.tong_thuc_te}/${h.tong_web}` },
                  { key: "tienmat", header: "Tiền mặt", className: "text-right text-sm tabular-nums", cell: (h) => `${Number(h.tien_mat || 0).toLocaleString("vi-VN")}₫` },
                  { key: "anh", header: "Ảnh", className: "text-center text-sm", cell: (h) => h.so_anh || 0 },
                  { key: "lydo", header: "Lý do", className: "max-w-[220px] text-sm", cell: (h) => <span className="line-clamp-1" title={h.ly_do}>{h.ly_do || "—"}</span> },
                ]}
                renderCard={(h) => (
                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{h.thoi_gian}</span>
                      {statusBadge(h.trang_thai)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Ca <span className="font-medium text-foreground">{h.ca}</span> • {h.nhan_vien || "—"}</span>
                      <span className="tabular-nums text-muted-foreground">TT/Web: <span className="font-medium text-foreground">{h.tong_thuc_te}/{h.tong_web}</span></span>
                    </div>
                    {h.ly_do ? <div className="text-sm text-muted-foreground">Lý do: <span className="text-foreground">{h.ly_do}</span></div> : null}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tiền mặt: <span className="text-foreground tabular-nums">{Number(h.tien_mat || 0).toLocaleString("vi-VN")}₫</span></span>
                      <span>Ảnh: {h.so_anh || 0}</span>
                    </div>
                  </div>
                )}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
