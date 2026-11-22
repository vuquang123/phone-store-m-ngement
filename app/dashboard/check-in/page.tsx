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
import { useAuthMe } from "@/hooks/use-auth-me"
import { Loader2, ImagePlus, X, Send, Copy, AlertTriangle, CheckCircle2, Clock, XCircle, ShieldCheck } from "lucide-react"
import {
  SERIES_KEYS,
  SERIES_LABELS,
  YEU_CAU_LABEL,
  actualKey,
  diffWithPrev,
  formatDiffLine,
  normalizeActual,
  type PrevCheckout,
  type SeriesCounts,
  type SeriesKey,
  type WebStock,
  type YeuCauLechCa,
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

  // Báo cáo cuối ca gần nhất của chi nhánh: mốc đối chiếu số máy
  const { data: caTruoc, refetch: refetchCaTruoc } = useQuery<{ allView: boolean; branch?: string; prev: PrevCheckout | null }>({
    queryKey: ["check-in-ca-truoc"],
    queryFn: async () => {
      const res = await fetch("/api/check-in/ca-truoc", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.message || "Không đọc được báo cáo cuối ca trước")
      return { allView: !!json.allView, branch: json.branch, prev: json.prev || null }
    },
    staleTime: 30_000,
  })
  const prev = caTruoc?.prev ?? null

  // Yêu cầu duyệt lệch ca: nhân viên thấy của mình, chủ shop/quản lý thấy cả chi nhánh
  const { data: yc, refetch: refetchYc } = useQuery<{ isManager: boolean; items: YeuCauLechCa[] }>({
    queryKey: ["check-in-yeu-cau"],
    queryFn: async () => {
      const res = await fetch("/api/check-in/yeu-cau", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      return { isManager: !!json?.isManager, items: Array.isArray(json?.items) ? json.items : [] }
    },
    refetchInterval: (q) => (q.state.data?.items?.some((y) => y.trangThai === "cho_duyet") ? 15_000 : 60_000),
  })
  const isManager = !!yc?.isManager
  const { me } = useAuthMe()
  const myEmail = me?.email || ""
  const choDuyet = (yc?.items || []).filter((y) => y.trangThai === "cho_duyet")

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
  const [ghiChuLech, setGhiChuLech] = useState("")
  const [sendingReq, setSendingReq] = useState(false)
  const [decide, setDecide] = useState<{ id: string; action: "duyet" | "tu_choi" } | null>(null)
  const [decideNote, setDecideNote] = useState("")
  const [deciding, setDeciding] = useState(false)

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

  // ----- đối chiếu với ca trước -----
  const daDem = SERIES_KEYS.some((k) => khoNgoai[k] !== "" || khoTrong[k] !== "")
  const toActual = (k: CountState) => SERIES_KEYS.reduce((acc, key) => ({ ...acc, [key]: n(k[key]) }), {} as SeriesCounts)
  const soDem = normalizeActual({ khoNgoai: toActual(khoNgoai), khoTrong: toActual(khoTrong) })
  const diffs = daDem ? diffWithPrev(prev, soDem) : []
  const soDemKey = actualKey(soDem)
  // Yêu cầu mới nhất của mình cho đúng bộ số + đúng mốc ca trước
  const myReq = (yc?.items || []).find(
    (y) => y.key === soDemKey && y.mocId === prev?.id && y.trangThai !== "huy" && y.trangThai !== "da_dung" && (!isManager || y.email === myEmail),
  )
  const approved = myReq?.trangThai === "da_duyet"
  const allView = !!caTruoc?.allView
  const blocked = allView || (diffs.length > 0 && !approved)

  const sendRequest = async () => {
    if (!ghiChuLech.trim()) {
      toast({ title: "Thiếu ghi chú", description: "Vui lòng ghi rõ lý do số máy lệch với ca trước", variant: "destructive" })
      return
    }
    setSendingReq(true)
    try {
      const res = await fetch("/api/check-in/yeu-cau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ca, khoNgoai: soDem.khoNgoai, khoTrong: soDem.khoTrong, ghiChu: ghiChuLech }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.message || "Gửi yêu cầu thất bại")
      toast({
        title: "Đã gửi yêu cầu cho chủ shop / quản lý",
        description: json.telegram === false ? "Đã lưu yêu cầu nhưng chưa gửi được Telegram." : "Chờ duyệt rồi bấm Gửi check-in.",
      })
      setGhiChuLech("")
      refetchYc()
    } catch (e: any) {
      toast({ title: "Lỗi", description: e?.message || "Có lỗi xảy ra", variant: "destructive" })
    } finally {
      setSendingReq(false)
    }
  }

  const submitDecision = async () => {
    if (!decide) return
    if (decide.action === "tu_choi" && !decideNote.trim()) {
      toast({ title: "Thiếu lý do", description: "Ghi lý do từ chối để nhân viên biết", variant: "destructive" })
      return
    }
    setDeciding(true)
    try {
      const res = await fetch(`/api/check-in/yeu-cau/${encodeURIComponent(decide.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: decide.action, ghiChu: decideNote }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.message || "Thao tác thất bại")
      toast({ title: decide.action === "duyet" ? "Đã duyệt yêu cầu" : "Đã từ chối yêu cầu" })
      setDecide(null)
      setDecideNote("")
      refetchYc()
    } catch (e: any) {
      toast({ title: "Lỗi", description: e?.message || "Có lỗi xảy ra", variant: "destructive" })
      refetchYc()
    } finally {
      setDeciding(false)
    }
  }

  const resetForm = () => {
    setCa("1")
    setKhoNgoai({ ...EMPTY })
    setKhoTrong({ ...EMPTY })
    setTrangThai("khop")
    setLyDo("")
    setTienMatRaw("")
    setImages([])
    setGhiChuLech("")
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
      if (json?.code === "LECH_CA_TRUOC") {
        refetchCaTruoc()
        refetchYc()
      }
      if (!res.ok || !json?.success) throw new Error(json?.message || "Gửi check-in thất bại")
      toast(
        json.telegram === false
          ? { title: "Đã lưu check-in", description: "Chưa gửi được Telegram (" + (json.message || "lỗi kết nối") + "). Không cần gửi lại, báo quản lý nếu cần." }
          : { title: "Đã gửi báo cáo check-in" },
      )
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["check-in-history"] })
      queryClient.invalidateQueries({ queryKey: ["check-in-web-stock"] })
      queryClient.invalidateQueries({ queryKey: ["check-in-yeu-cau"] })
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

        {/* Chủ shop / quản lý: yêu cầu lệch ca chờ duyệt */}
        {isManager && choDuyet.length > 0 && (
          <Card className="border-amber-300 dark:border-amber-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                Yêu cầu lệch kho chờ duyệt ({choDuyet.length})
              </CardTitle>
              <CardDescription>Nhân viên đếm số máy lệch với báo cáo cuối ca trước. Duyệt thì nhân viên mới gửi được check-in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {choDuyet.map((y) => (
                <div key={y.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{y.nhanVien}</span> · Ca {y.ca}
                      {y.chiNhanh ? <> · <span className="font-medium">{y.chiNhanh}</span></> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{y.thoi_gian}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">So với báo cáo cuối ca: {y.mocThoiGian}</div>
                  <ul className="space-y-0.5 text-sm">
                    {y.chiTiet.split("; ").map((l, i) => (
                      <li key={i} className="tabular-nums text-amber-700 dark:text-amber-400">• {l}</li>
                    ))}
                  </ul>
                  <div className="text-sm">Ghi chú: <span className="text-foreground">{y.ghiChu}</span></div>
                  {decide?.id === y.id ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder={decide.action === "duyet" ? "Ghi chú khi duyệt (không bắt buộc)" : "Lý do từ chối (bắt buộc)"}
                        value={decideNote}
                        onChange={(e) => setDecideNote(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setDecide(null); setDecideNote("") }} disabled={deciding}>Huỷ</Button>
                        <Button
                          size="sm"
                          variant={decide.action === "duyet" ? "default" : "destructive"}
                          onClick={submitDecision}
                          disabled={deciding}
                        >
                          {deciding && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                          {decide.action === "duyet" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setDecide({ id: y.id, action: "tu_choi" }); setDecideNote("") }}>
                        <XCircle className="mr-1 h-4 w-4" /> Từ chối
                      </Button>
                      <Button size="sm" onClick={() => { setDecide({ id: y.id, action: "duyet" }); setDecideNote("") }}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Duyệt
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {allView && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Đang xem tất cả chi nhánh. Chọn DEV PỒ hoặc T1s ở góc trên để check-in.
          </div>
        )}

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
          <RefreshButton onRefresh={() => { refetchStock(); refetchCaTruoc() }} loading={fetchingStock} />
        </div>
        {!allView && (
          <p className="-mt-3 text-xs text-muted-foreground">
            {prev ? (
              <>
                Số đếm phải khớp <span className="font-medium text-foreground">báo cáo cuối ca {prev.ca}</span> lúc {prev.thoi_gian}
                {prev.nhanVien ? ` (${prev.nhanVien})` : ""}: Kho ngoài {prev.khoNgoai.thucTe} máy, Kho trong {prev.khoTrong.thucTe} máy.
              </>
            ) : caTruoc ? (
              "Chưa có báo cáo cuối ca nào của chi nhánh này, không cần đối chiếu ca trước."
            ) : null}
          </p>
        )}
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

        {/* Lệch với ca trước */}
        {diffs.length > 0 && (
          <Card className={approved ? "border-emerald-300 dark:border-emerald-800" : "border-red-300 dark:border-red-900"}>
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 text-base ${approved ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                {approved ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                Lệch với báo cáo cuối ca trước
              </CardTitle>
              <CardDescription>
                Ca {prev?.ca} lúc {prev?.thoi_gian}{prev?.nhanVien ? ` (${prev.nhanVien})` : ""}. Lệch thì không được check-in cho tới khi chủ shop / quản lý duyệt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-0.5 text-sm tabular-nums">
                {diffs.map((d, i) => (
                  <li key={i}>• {formatDiffLine(d)}</li>
                ))}
              </ul>
              {myReq?.trangThai === "cho_duyet" ? (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    Đã gửi yêu cầu lúc {myReq.thoi_gian}, đang chờ chủ shop / quản lý duyệt. Trang tự cập nhật khi có kết quả.
                    <div className="text-xs opacity-80">Ghi chú: {myReq.ghiChu}</div>
                  </div>
                </div>
              ) : approved ? (
                <div className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    {myReq?.nguoiDuyet} đã duyệt lúc {myReq?.thoiGianDuyet}{myReq?.ghiChuDuyet ? ` (${myReq.ghiChuDuyet})` : ""}. Bấm Gửi check-in để hoàn tất.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {myReq?.trangThai === "tu_choi" && (
                    <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>{myReq.nguoiDuyet} đã từ chối: {myReq.ghiChuDuyet}. Đếm lại hoặc gửi yêu cầu mới.</div>
                    </div>
                  )}
                  <Label htmlFor="ghichu-lech">Ghi chú lý do lệch <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="ghichu-lech"
                    placeholder="VD: 1 máy 16 Pro Max khách lấy bảo hành tối qua, chưa cập nhật..."
                    value={ghiChuLech}
                    onChange={(e) => setGhiChuLech(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button onClick={sendRequest} disabled={sendingReq || allView} variant="destructive" className="gap-2">
                      {sendingReq ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Gửi yêu cầu cho chủ shop / quản lý
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-end gap-3">
          {blocked && !allView && (
            <span className="text-xs text-muted-foreground">Cần được duyệt lệch ca trước mới gửi được check-in</span>
          )}
          <Button onClick={handleSubmit} disabled={submitting || blocked} className="gap-2">
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
