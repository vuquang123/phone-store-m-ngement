"use client"

// ---------------------------------------------------------------------------
// Tổng kết ca làm — trang nhân viên mở đầu ca để biết ca trước đã làm gì và
// còn việc gì phải nhận bàn giao.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Banknote,
  Clock,
  Package,
  RotateCcw,
  StickyNote,
  Truck,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SHIFTS, BUCKET_LABEL, currentShift } from "@/lib/shift"

const money = (n: number) => `₫${Number(n || 0).toLocaleString("vi-VN")}`

function todayISO() {
  // Dùng giờ VN để "hôm nay" không lệch ngày khi máy đặt múi giờ khác.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
}

type Summary = any

export default function TongKetCaPage() {
  // Mặc định mở đúng ca đang diễn ra -> nhân viên vào là thấy ngay ca của mình.
  const [shift, setShift] = useState<string>(() => currentShift()?.key ?? "all")
  const [date, setDate] = useState<string>(todayISO)

  const { data, isLoading, error } = useQuery<Summary>({
    queryKey: ["tong-ket-ca", date, shift],
    queryFn: async () => {
      const res = await fetch(`/api/nhan-vien/tong-ket-ca?date=${date}&shift=${shift}`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Lỗi ${res.status}`)
      return res.json()
    },
    retry: 2,
  })

  const canXuLy = data?.can_xu_ly
  const tongViecTon = useMemo(() => {
    if (!canXuLy) return 0
    return (
      canXuLy.don_online_chua_gui.length +
      canXuLy.coc_chua_tat_toan.length +
      canXuLy.hoan_tra_cho_xu_ly.length +
      canXuLy.ghi_chu_chua_xong.length
    )
  }, [canXuLy])

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">Tổng kết ca làm</h1>
          <p className="text-sm text-muted-foreground">
            Ca trước bán được gì, tiền nong ra sao, còn việc gì phải nhận bàn giao.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="space-y-1">
            <Label htmlFor="ngay" className="text-xs text-muted-foreground">Ngày</Label>
            <Input
              id="ngay"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ca" className="text-xs text-muted-foreground">Ca làm</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger id="ca" className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-400">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}

      {data && (
        <>
          {/* Cảnh báo dữ liệu cũ không có giờ -> không xếp được vào ca nào. */}
          {shift !== "all" && data.canh_bao?.don_chua_ghi_gio > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-500/10">
              <CardContent className="flex items-start gap-2 p-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Có <b>{data.canh_bao.don_chua_ghi_gio}</b> đơn trong ngày chưa lưu giờ bán nên
                  không xếp được vào ca nào. Chọn <b>Cả ngày</b> để thấy đầy đủ.
                </span>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Package} label="Đơn đã bán" value={String(data.ban_hang.so_don)}
              sub={`${data.ban_hang.so_may} máy/món`} />
            <StatCard icon={Banknote} label="Doanh thu" value={money(data.ban_hang.doanh_thu)} />
            <StatCard icon={Wallet} label="Quỹ tiền mặt"
              value={data.quy_tien_mat.so_du_cuoi === null ? "—" : money(data.quy_tien_mat.so_du_cuoi)}
              sub={`Thu ${money(data.quy_tien_mat.thu)} · Chi ${money(data.quy_tien_mat.chi)}`} />
            <StatCard icon={Clock} label="Việc còn tồn" value={String(tongViecTon)}
              sub="Cần xử lý, không phân ca" highlight={tongViecTon > 0} />
          </div>

          {/* Tiền theo phương thức */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tiền thu theo phương thức</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.ban_hang.theo_phuong_thuc).length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có giao dịch nào trong ca này.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.ban_hang.theo_phuong_thuc).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="px-3 py-1 text-sm font-normal">
                      {k}: <span className="ml-1 font-semibold tabular-nums">{money(v as number)}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Đơn trong ca */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Đơn trong {data.ca === "all" ? "ngày" : "ca"} ({data.ban_hang.don_hang.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead className="w-[70px]">Giờ</TableHead>
                      <TableHead>Mã đơn</TableHead>
                      <TableHead>Khách</TableHead>
                      <TableHead className="hidden md:table-cell">Sản phẩm</TableHead>
                      <TableHead className="text-right">Tổng thu</TableHead>
                      <TableHead className="hidden lg:table-cell">NV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ban_hang.don_hang.map((o: any) => (
                      <TableRow key={o.ma}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {o.gio || <span title={BUCKET_LABEL[o.bucket as keyof typeof BUCKET_LABEL]}>—</span>}
                        </TableCell>
                        <TableCell className="font-medium">{o.ma}</TableCell>
                        <TableCell>
                          <div className="text-sm">{o.khach}</div>
                          <div className="font-mono text-xs text-muted-foreground">{o.sdt}</div>
                        </TableCell>
                        <TableCell className="hidden max-w-[280px] truncate md:table-cell text-sm">{o.san_pham}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(o.tong_thu)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{o.nguoi_ban}</TableCell>
                      </TableRow>
                    ))}
                    {data.ban_hang.don_hang.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Chưa có đơn nào.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Thu chi tiền mặt */}
          {data.quy_tien_mat.giao_dich.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Thu chi tiền mặt trong ca</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.quy_tien_mat.giao_dich.map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{g.gio}</span>
                      <Badge className={g.loai === "thu"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"}>
                        {g.loai === "thu" ? "Thu" : "Chi"}
                      </Badge>
                      <span>{g.ly_do}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{g.nhan_vien}</span>
                      <span className="font-semibold tabular-nums">{money(g.so_tien)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Việc cần xử lý */}
          <div className="grid gap-4 lg:grid-cols-2">
            <PendingCard icon={Truck} title="Đơn online chưa gửi" items={canXuLy.don_online_chua_gui}
              render={(o: any) => (
                <>
                  <div className="font-medium">{o.ma} · {o.khach}</div>
                  <div className="text-xs text-muted-foreground">{o.san_pham}</div>
                  <div className="text-xs text-muted-foreground">{o.sdt} · {o.van_chuyen}</div>
                </>
              )} />
            <PendingCard icon={Wallet} title="Đơn cọc chưa tất toán" items={canXuLy.coc_chua_tat_toan}
              render={(o: any) => (
                <>
                  <div className="font-medium">
                    {o.khach} · còn {money(o.con_lai)}
                    {o.qua_han && <Badge className="ml-2 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">Quá hạn</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{o.san_pham}</div>
                  <div className="text-xs text-muted-foreground">{o.sdt} · hạn {o.han_thanh_toan}</div>
                </>
              )} />
            <PendingCard icon={RotateCcw} title="Hoàn trả chờ xử lý" items={canXuLy.hoan_tra_cho_xu_ly}
              render={(o: any) => (
                <>
                  <div className="font-medium">{o.khach} · {o.trang_thai}</div>
                  <div className="text-xs text-muted-foreground">{o.san_pham}</div>
                  <div className="text-xs text-muted-foreground">{o.sdt} · {o.ly_do}</div>
                </>
              )} />
            <PendingCard icon={StickyNote} title="Ghi chú chưa hoàn thành" items={canXuLy.ghi_chu_chua_xong}
              render={(o: any) => (
                <>
                  <div className="font-medium">{o.noi_dung}</div>
                  <div className="text-xs text-muted-foreground">{o.nguoi_tao} · {o.tao_luc}</div>
                </>
              )} />
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, highlight }: {
  icon: any; label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <Card className={highlight ? "border-amber-300" : undefined}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</div>
          {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

function PendingCard({ icon: Icon, title, items, render }: {
  icon: any; title: string; items: any[]; render: (item: any) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
          <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không còn việc nào. 👍</p>
        ) : (
          items.map((o, i) => (
            <div key={i} className="rounded-md border border-border px-3 py-2 text-sm">
              {render(o)}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
