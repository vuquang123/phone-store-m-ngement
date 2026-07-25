// app/dashboard/don-online/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { RefreshButton } from "@/components/ui/refresh-button"
import { OrderDetailDialog } from "@/components/ban-hang/order-detail-dialog"
import { STATUS_GROUP_COLOR } from "@/lib/ghtk-status"
import { cn } from "@/lib/utils"
import { Eye, Loader2, Check, Truck, Package } from "lucide-react"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"

interface OnlineOrder {
  id: string
  ma_don_hang: string
  ten_khach_hang?: string
  so_dien_thoai?: string
  ten_san_pham?: string
  items_count?: number
  tong_tien?: number
  ma_ghtk?: string
  ngay_xuat?: string
  status_code?: string
  status_label?: string
  status_group?: keyof typeof STATUS_GROUP_COLOR
  cod_money?: number
  ship_money?: number
}

const fmt = (n: number) => Number(n || 0).toLocaleString("vi-VN") + "₫"

function deriveProgress(statusCode: string) {
  const n = Number(statusCode)
  return {
    picked: [3, 4, 5, 6, 9, 10, 11, 13, 20, 21].includes(n),
    shipped: [4, 5, 6, 9, 10].includes(n),
  }
}

function GhtkOrderRow({ order, onView }: { order: OnlineOrder; onView: (id: string) => void }) {
  const prog = deriveProgress(order.status_code || "")
  const cod = order.cod_money ?? 0

  const Flag = ({ ok }: { ok: boolean }) =>
    ok ? <Check className="h-4 w-4 text-emerald-600" /> : <span className="text-muted-foreground">—</span>

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">{order.ma_don_hang}</TableCell>
      <TableCell className="text-sm">
        <div className="font-medium">{order.ten_khach_hang || "Khách lẻ"}</div>
        {order.so_dien_thoai && <div className="text-xs text-muted-foreground">{order.so_dien_thoai}</div>}
      </TableCell>
      <TableCell className="text-sm">
        <div className="line-clamp-1 max-w-[200px]">{order.ten_san_pham || "—"}</div>
        {(order.items_count || 0) > 1 && (
          <div className="text-xs text-muted-foreground">{order.items_count} sản phẩm</div>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs whitespace-nowrap">{order.ma_ghtk}</TableCell>
      <TableCell>
        {order.status_label ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
              STATUS_GROUP_COLOR[order.status_group || "other"],
            )}
          >
            {order.status_label}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Flag ok={prog.picked} />
      </TableCell>
      <TableCell className="text-center">
        <Flag ok={prog.shipped} />
      </TableCell>
      <TableCell className="text-right font-medium whitespace-nowrap">{fmt(cod)}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={() => onView(order.ma_don_hang)} aria-label="Xem chi tiết">
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function GhtkOrderCard({ order, onView }: { order: OnlineOrder; onView: (id: string) => void }) {
  const prog = deriveProgress(order.status_code || "")
  const cod = order.cod_money ?? 0

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{order.ma_don_hang}</div>
          <div className="truncate text-xs text-muted-foreground">
            {order.ten_khach_hang || "Khách lẻ"}{order.so_dien_thoai ? ` • ${order.so_dien_thoai}` : ""}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onView(order.ma_don_hang)} aria-label="Xem chi tiết">
          <Eye className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm">{order.ten_san_pham || "—"}{(order.items_count || 0) > 1 ? ` (${order.items_count} sp)` : ""}</div>
      <div className="flex items-center justify-between gap-2">
        {order.status_label ? (
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_GROUP_COLOR[order.status_group || "other"])}>{order.status_label}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <span className="font-medium">{fmt(cod)}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">Lấy hàng {prog.picked ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : "—"}</span>
        <span className="inline-flex items-center gap-1">Vận chuyển {prog.shipped ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : "—"}</span>
      </div>
      <div className="font-mono text-[11px] text-muted-foreground">{order.ma_ghtk}</div>
    </div>
  )
}

export default function DonOnlinePage() {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data, isLoading, isFetching, refetch } = useQuery<OnlineOrder[]>({
    queryKey: ["don-online"],
    queryFn: async () => {
      const res = await fetch("/api/ban-hang?ghtk=1&limit=200", { cache: "no-store" })
      if (!res.ok) throw new Error("Không tải được danh sách đơn online")
      const json = await res.json()
      return Array.isArray(json.data) ? json.data : []
    },
    staleTime: 30_000,
  })

  const orders = data ?? []
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const totalCod = useMemo(() => orders.reduce((sum, order) => sum + (order.cod_money ?? 0), 0), [orders])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedOrders = useMemo(
    () => orders.slice((page - 1) * pageSize, page * pageSize),
    [orders, page],
  )

  const handleView = (id: string) => {
    setSelectedOrder(id)
    setDialogOpen(true)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Đơn online</h1>
            <p className="text-muted-foreground">Theo dõi đơn giao qua GHTK: shipper lấy hàng, vận chuyển, tiền COD</p>
          </div>
          <RefreshButton onRefresh={() => { refetch() }} loading={isFetching} label />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" /> Tổng đơn GHTK
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Truck className="h-4 w-4" /> Tổng tiền COD
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {fmt(totalCod)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách đơn online (GHTK)</CardTitle>
            <CardDescription>Mới nhất trước — bấm icon mắt để xem chi tiết & tra cứu đầy đủ</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải...
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Chưa có đơn nào có mã GHTK. Nhập mã GHTK khi tạo đơn online để theo dõi tại đây.
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {pagedOrders.map((o) => (
                    <GhtkOrderCard key={o.ma_don_hang || o.id} order={o} onView={handleView} />
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mã đơn</TableHead>
                        <TableHead>Khách hàng</TableHead>
                        <TableHead>Sản phẩm</TableHead>
                        <TableHead>Mã GHTK</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead className="text-center">Lấy hàng</TableHead>
                        <TableHead className="text-center">Vận chuyển</TableHead>
                        <TableHead className="text-right">COD</TableHead>
                        <TableHead className="text-right">Chi tiết</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedOrders.map((o) => (
                        <GhtkOrderRow key={o.ma_don_hang || o.id} order={o} onView={handleView} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePaginationFooter
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={orders.length}
                  pageSize={pageSize}
                  itemLabel="đơn online"
                />
              </>
            )}
          </CardContent>
        </Card>

        <OrderDetailDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} orderId={selectedOrder} />
      </div>
    </ProtectedRoute>
  )
}
