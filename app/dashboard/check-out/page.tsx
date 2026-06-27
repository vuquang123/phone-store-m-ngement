// app/dashboard/check-out/page.tsx
"use client"

import { useRef, useState } from "react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { RefreshButton } from "@/components/ui/refresh-button"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ImagePlus, X, Send, Eye } from "lucide-react"

type KhoKey = "website" | "thucTe" | "s17" | "s16" | "s15" | "ipad" | "khac"
type CountState = Record<KhoKey, string>

interface KhoCounts { website: number; thucTe: number; s17: number; s16: number; s15: number; ipad: number; khac: number }
interface CheckoutItem {
  id: string
  ca: string
  created_at: string
  nhanVien?: string
  trangThai: "khop" | "khong_khop"
  lyDo?: string
  so_anh: number
  khoNgoai: KhoCounts
  khoTrong: KhoCounts
  taiChinh: { banRa: number; banRaOff: string; banRaOnl: string; thuVao: string; tienMatBanGiao: number; ghiChuCaSau: string }
}

const FIELDS: { key: KhoKey; label: string }[] = [
  { key: "website", label: "Website" },
  { key: "thucTe", label: "Thực tế" },
  { key: "s17", label: "17 Series" },
  { key: "s16", label: "16 Series" },
  { key: "s15", label: "15 Series" },
  { key: "ipad", label: "Ipad" },
  { key: "khac", label: "Khác (14/13/12/Lẻ)" },
]
const EMPTY: CountState = { website: "", thucTe: "", s17: "", s16: "", s15: "", ipad: "", khac: "" }
const MAX_IMAGES = 6

const n = (v: string) => Number(v || 0) || 0
const fmt = (v: number) => Number(v || 0).toLocaleString("vi-VN") + "₫"
const fmtDate = (iso: string) => {
  const t = Date.parse(iso)
  return t ? new Date(t).toLocaleString("vi-VN") : iso || "—"
}

export default function CheckOutPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [ca, setCa] = useState("1")
  const [khoNgoai, setKhoNgoai] = useState<CountState>({ ...EMPTY })
  const [khoTrong, setKhoTrong] = useState<CountState>({ ...EMPTY })
  const [trangThai, setTrangThai] = useState<"khop" | "khong_khop">("khop")
  const [lyDo, setLyDo] = useState("")
  // Tài chính
  const [banRa, setBanRa] = useState("")
  const [banRaOff, setBanRaOff] = useState("")
  const [banRaOnl, setBanRaOnl] = useState("")
  const [thuVao, setThuVao] = useState("")
  const [tienMatRaw, setTienMatRaw] = useState("")
  const [ghiChuCaSau, setGhiChuCaSau] = useState("")

  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<CheckoutItem | null>(null)
  const [open, setOpen] = useState(false)

  const { data: history, isLoading: loadingHistory, isFetching, refetch } = useQuery<CheckoutItem[]>({
    queryKey: ["check-out"],
    queryFn: async () => {
      const res = await fetch("/api/check-out", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      return Array.isArray(json?.items) ? json.items : []
    },
    staleTime: 30_000,
  })

  const lineTotal = (k: CountState) => n(k.s17) + n(k.s16) + n(k.s15) + n(k.ipad) + n(k.khac)
  const tienMatDisplay = tienMatRaw ? Number(tienMatRaw).toLocaleString("vi-VN") : ""

  const onPickImages = (files: FileList | null) => {
    if (!files || !files.length) return
    if (images.length >= MAX_IMAGES) {
      toast({ title: "Tối đa 6 ảnh", variant: "destructive" })
      return
    }
    const room = MAX_IMAGES - images.length
    Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room)
      .forEach((file) => {
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
    setBanRa(""); setBanRaOff(""); setBanRaOnl(""); setThuVao(""); setTienMatRaw(""); setGhiChuCaSau("")
    setImages([])
  }

  const toNums = (k: CountState) => ({
    website: n(k.website), thucTe: n(k.thucTe), s17: n(k.s17), s16: n(k.s16), s15: n(k.s15), ipad: n(k.ipad), khac: n(k.khac),
  })

  const handleSubmit = async () => {
    if (trangThai === "khong_khop" && !lyDo.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập lý do khi không khớp", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ca,
          khoNgoai: toNums(khoNgoai),
          khoTrong: toNums(khoTrong),
          trangThai,
          lyDo: trangThai === "khong_khop" ? lyDo : undefined,
          taiChinh: {
            banRa: n(banRa),
            banRaOff,
            banRaOnl,
            thuVao,
            tienMatBanGiao: Number(tienMatRaw || 0) || 0,
            ghiChuCaSau,
          },
          images,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.message || "Gửi báo cáo thất bại")
      toast({ title: "Đã gửi báo cáo cuối ca" })
      resetForm()
      queryClient.invalidateQueries({ queryKey: ["check-out"] })
    } catch (e: any) {
      toast({ title: "Lỗi", description: e?.message || "Có lỗi xảy ra", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const renderKhoCard = (title: string, state: CountState, setState: React.Dispatch<React.SetStateAction<CountState>>) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={state[f.key]}
                onChange={(e) => setState((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Tổng theo dòng máy: <span className="font-semibold text-foreground">{lineTotal(state)}</span>
        </p>
      </CardContent>
    </Card>
  )

  const StatusBadge = ({ tt }: { tt: string }) =>
    tt === "khong_khop" ? <Badge variant="destructive">Không khớp</Badge> : <Badge className="bg-emerald-600 hover:bg-emerald-600">Khớp</Badge>

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Báo cáo cuối ca</h1>
          <p className="text-muted-foreground">Chốt số liệu kho + tài chính cuối ca và gửi báo cáo</p>
        </div>

        {/* Ca */}
        <div className="max-w-[200px] space-y-2">
          <Label>Ca làm việc</Label>
          <Select value={ca} onValueChange={setCa}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Ca 1</SelectItem>
              <SelectItem value="2">Ca 2</SelectItem>
              <SelectItem value="3">Ca 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 2 kho */}
        <div className="grid gap-4 md:grid-cols-2">
          {renderKhoCard("KHO NGOÀI", khoNgoai, setKhoNgoai)}
          {renderKhoCard("KHO TRONG", khoTrong, setKhoTrong)}
        </div>

        {/* Trạng thái */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trạng thái</CardTitle>
            <CardDescription>Đối chiếu số liệu thực tế với website</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup value={trangThai} onValueChange={(v) => setTrangThai(v as "khop" | "khong_khop")} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="khop" id="co-khop" />
                <Label htmlFor="co-khop" className="cursor-pointer font-normal">Khớp</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="khong_khop" id="co-khong" />
                <Label htmlFor="co-khong" className="cursor-pointer font-normal">Không khớp</Label>
              </div>
            </RadioGroup>
            {trangThai === "khong_khop" && (
              <div className="space-y-1">
                <Label htmlFor="co-lydo">Lý do <span className="text-red-500">*</span></Label>
                <Textarea id="co-lydo" placeholder="Nêu rõ lý do lệch số liệu..." value={lyDo} onChange={(e) => setLyDo(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tài chính & đơn hàng */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tài chính & đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bán ra (số đơn)</Label>
                <Input type="number" min={0} inputMode="numeric" placeholder="0" value={banRa} onChange={(e) => setBanRa(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tiền mặt bàn giao</Label>
                <Input inputMode="numeric" placeholder="0" value={tienMatDisplay} onChange={(e) => setTienMatRaw(e.target.value.replace(/[^\d]/g, ""))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bán ra Off</Label>
                <Input placeholder="VD: 5 máy / 50tr..." value={banRaOff} onChange={(e) => setBanRaOff(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bán ra Onl</Label>
                <Input placeholder="VD: 3 đơn / 30tr..." value={banRaOnl} onChange={(e) => setBanRaOnl(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Thu vào</Label>
                <Input placeholder="Tổng thu vào trong ca..." value={thuVao} onChange={(e) => setThuVao(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ghi chú ca sau (Khách hẹn, máy lỗi...)</Label>
              <Textarea placeholder="Ghi chú bàn giao cho ca sau..." value={ghiChuCaSau} onChange={(e) => setGhiChuCaSau(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Ảnh đính kèm */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ảnh đính kèm</CardTitle>
            <CardDescription>Tối đa {MAX_IMAGES} ảnh</CardDescription>
          </CardHeader>
          <CardContent>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickImages(e.target.files)} />
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
            Gửi báo cáo
          </Button>
        </div>

        {/* Lịch sử */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Lịch sử báo cáo cuối ca</CardTitle>
              <CardDescription>Mới nhất trước</CardDescription>
            </div>
            <RefreshButton onRefresh={() => { refetch() }} loading={isFetching} />
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải...
              </div>
            ) : !history || history.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Chưa có báo cáo cuối ca</div>
            ) : (
              <ResponsiveTable
                data={history}
                rowKey={(h) => h.id}
                minWidth="min-w-[820px]"
                columns={[
                  { key: "time", header: "Thời gian", className: "whitespace-nowrap text-sm", cell: (h) => fmtDate(h.created_at) },
                  { key: "ca", header: "Ca", className: "text-center text-sm", cell: (h) => h.ca },
                  { key: "nv", header: "Nhân viên", className: "text-sm", cell: (h) => h.nhanVien || "—" },
                  { key: "tt", header: "Trạng thái", cell: (h) => <StatusBadge tt={h.trangThai} /> },
                  { key: "ngoai", header: "Ngoài (TT/Web)", className: "text-center text-sm tabular-nums", cell: (h) => `${h.khoNgoai.thucTe}/${h.khoNgoai.website}` },
                  { key: "trong", header: "Trong (TT/Web)", className: "text-center text-sm tabular-nums", cell: (h) => `${h.khoTrong.thucTe}/${h.khoTrong.website}` },
                  { key: "banra", header: "Bán ra", className: "text-center text-sm", cell: (h) => h.taiChinh.banRa },
                  { key: "tienmat", header: "Tiền mặt", className: "text-right text-sm", cell: (h) => fmt(h.taiChinh.tienMatBanGiao) },
                  { key: "anh", header: "Ảnh", className: "text-center text-sm", cell: (h) => h.so_anh || 0 },
                  { key: "xem", header: "Xem", className: "text-right", cell: (h) => (
                    <Button variant="ghost" size="icon" onClick={() => { setSelected(h); setOpen(true) }} aria-label="Xem chi tiết">
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) },
                ]}
                renderCard={(h) => (
                  <button
                    type="button"
                    onClick={() => { setSelected(h); setOpen(true) }}
                    className="w-full space-y-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{fmtDate(h.created_at)}</span>
                      <StatusBadge tt={h.trangThai} />
                    </div>
                    <div className="text-sm">Ca <span className="font-medium">{h.ca}</span> • {h.nhanVien || "—"}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                      <div>Ngoài: <span className="text-foreground tabular-nums">{h.khoNgoai.thucTe}/{h.khoNgoai.website}</span></div>
                      <div>Trong: <span className="text-foreground tabular-nums">{h.khoTrong.thucTe}/{h.khoTrong.website}</span></div>
                      <div>Bán ra: <span className="text-foreground">{h.taiChinh.banRa}</span></div>
                      <div>Tiền mặt: <span className="text-foreground">{fmt(h.taiChinh.tienMatBanGiao)}</span></div>
                    </div>
                  </button>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Dialog chi tiết */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Chi tiết báo cáo cuối ca</DialogTitle>
              {selected && (
                <DialogDescription>
                  Ca {selected.ca} • {fmtDate(selected.created_at)} • {selected.nhanVien || "—"}
                </DialogDescription>
              )}
            </DialogHeader>
            {selected && (
              <div className="space-y-4 text-sm">
                <div><StatusBadge tt={selected.trangThai} /> {selected.trangThai === "khong_khop" && selected.lyDo ? <span className="ml-2 text-muted-foreground">Lý do: {selected.lyDo}</span> : null}</div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {([["KHO NGOÀI", selected.khoNgoai], ["KHO TRONG", selected.khoTrong]] as const).map(([title, k]) => (
                    <div key={title} className="rounded-lg border p-3">
                      <div className="mb-2 font-semibold">{title}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        <div>Website: <span className="text-foreground">{k.website}</span></div>
                        <div>Thực tế: <span className="text-foreground">{k.thucTe}</span></div>
                        <div>17: <span className="text-foreground">{k.s17}</span></div>
                        <div>16: <span className="text-foreground">{k.s16}</span></div>
                        <div>15: <span className="text-foreground">{k.s15}</span></div>
                        <div>Ipad: <span className="text-foreground">{k.ipad}</span></div>
                        <div className="col-span-2">Khác: <span className="text-foreground">{k.khac}</span></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 font-semibold">Tài chính & đơn hàng</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    <div>Bán ra: <span className="text-foreground">{selected.taiChinh.banRa}</span></div>
                    <div>Tiền mặt bàn giao: <span className="font-medium text-foreground">{fmt(selected.taiChinh.tienMatBanGiao)}</span></div>
                    <div>Off: <span className="text-foreground">{selected.taiChinh.banRaOff || "—"}</span></div>
                    <div>Onl: <span className="text-foreground">{selected.taiChinh.banRaOnl || "—"}</span></div>
                    <div className="col-span-2">Thu vào: <span className="text-foreground">{selected.taiChinh.thuVao || "—"}</span></div>
                    <div className="col-span-2">Ghi chú ca sau: <span className="text-foreground">{selected.taiChinh.ghiChuCaSau || "—"}</span></div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
