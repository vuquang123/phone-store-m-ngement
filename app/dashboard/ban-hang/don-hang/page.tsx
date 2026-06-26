"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Search, Eye, FileText } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useIsMobile } from "@/hooks/use-mobile"
import { OrderDetailDialog } from "@/components/ban-hang/order-detail-dialog"
import OrderProductsCell from "@/app/dashboard/ban-hang/OrderProductsCell"
import { GhtkStatusBadge } from "@/components/ghtk/ghtk-status-badge"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

interface Order {
  id: string
  ma_don_hang: string
  tong_tien: number
  giam_gia: number
  thanh_toan: number
  phuong_thuc_thanh_toan: string
  phuong_thuc_list?: string[]
  trang_thai: string
  ngay_ban: string
  khach_hang?: { ho_ten: string; so_dien_thoai: string }
  nhan_vien?: { id?: string; name?: string; role?: string }
  loai_don?: string
  ma_ghtk?: string
  hinh_thuc_van_chuyen?: string
  imeis?: string[]
  imei?: string // raw from each row for grouping convenience
}

export default function DonHangPage() {
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [trangThai, setTrangThai] = useState("all")
  const [loaiDonFilter, setLoaiDonFilter] = useState<"all" | "online" | "offline">("all")
  const [timeFilter, setTimeFilter] = useState<"all" | "this_month" | "last_month">("all")

  const fetchOrders = async (force = false) => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        // Chỉ lấy đơn hàng đã thanh toán
        trang_thai: "hoan_thanh",
      })
      if (force) params.set("refresh", "1")
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())

      const response = await fetchWithTimeout(`/api/ban-hang?${params}`)
      if (!response.ok) throw new Error("Failed to fetch orders")

      const data = await response.json()
      // Map lại dữ liệu đã gộp từ API
      const orders = Array.isArray(data.data) ? data.data.map((o: any) => {
        // Chuyển ngày bán từ chuỗi sang ISO nếu cần
        let ngayBanRaw = o.ngay_xuat || "";
        let ngayBanDate = "";
        if (typeof ngayBanRaw === "string" && ngayBanRaw.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          const [d, m, y] = ngayBanRaw.split("/");
          ngayBanDate = new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
        } else {
          ngayBanDate = ngayBanRaw;
        }
        
        return {
          ...o,
          id: o.ma_don_hang || o.id,
          ngay_ban: ngayBanDate,
          khach_hang: o.ten_khach_hang || o.so_dien_thoai
            ? { ho_ten: o.ten_khach_hang || "Khách lẻ", so_dien_thoai: o.so_dien_thoai || "" }
            : undefined,
        }
      }) : []
      
      setOrders(orders)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error("Error fetching orders:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Debounce ô tìm kiếm -> reset trang 1 + tìm trên TOÀN BỘ đơn ở server
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch])

  const handleViewOrder = (orderId: string) => {
    setSelectedOrder(orderId)
    setIsDetailDialogOpen(true)
  }

  // Chuẩn hoá chuỗi trạng thái thô từ sheet (bỏ dấu, thường hoá) để so khớp.
  const normTrangThai = (s: string) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase()
      .trim()

  const isCancelled = (s: string) => normTrangThai(s).includes("huy")
  const isReturned = (s: string) => normTrangThai(s).includes("hoan tra")

  // Màu: đã huỷ -> đỏ; đã hoàn -> vàng; còn lại -> xanh lá.
  const getTrangThaiColor = (trangThai: string) =>
    isCancelled(trangThai)
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : isReturned(trangThai)
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
        : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"

  // Nhãn: "Hoàn trả" -> "Đã hoàn"; đã huỷ -> "Đã hủy"; còn lại -> "Thành công".
  const getTrangThaiLabel = (trangThai: string) =>
    isReturned(trangThai) ? "Đã hoàn" : isCancelled(trangThai) ? "Đã hủy" : "Thành công"

  // Pill trạng thái viền màu + chấm (UI card mới)
  const getStatusPillClass = (trangThai: string) =>
    isCancelled(trangThai)
      ? "border-red-500/40 text-red-500"
      : isReturned(trangThai)
        ? "border-yellow-500/40 text-yellow-600 dark:text-yellow-500"
        : "border-emerald-500/40 text-emerald-600 dark:text-emerald-500"

  const getPhuongThucColor = (label: string) => {
    const s = (label || '').toLowerCase()
    if (s === 'tiền mặt' || s === 'tien mat') return 'bg-blue-100 text-blue-800'
    if (s === 'chuyển khoản' || s === 'chuyen khoan') return 'bg-purple-100 text-purple-800'
    if (s === 'thẻ' || s === 'the') return 'bg-orange-100 text-orange-800'
    if (s === 'trả góp' || s === 'tra gop') return 'bg-amber-100 text-amber-800'
    return 'bg-muted text-foreground'
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Danh sách đơn hàng</h2>
            <p className="text-muted-foreground">Quản lý và theo dõi các đơn hàng đã bán</p>
          </div>
          <RefreshButton onRefresh={() => fetchOrders(true)} loading={isLoading} label />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Đơn hàng</CardTitle>
            <CardDescription>Tìm kiếm và lọc đơn hàng theo các tiêu chí</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm theo số điện thoại, tên khách hàng..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              {/* Dropdown trạng thái cho desktop */}
              <div className="hidden md:block">
                <Select value={trangThai} onValueChange={setTrangThai}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="hoan_thanh">Hoàn thành</SelectItem>
                    <SelectItem value="huy">Đã hủy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bộ lọc nhanh cho mobile */}
            <div className="md:hidden space-y-3 mb-4">

              {/* Loại đơn */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Loại đơn</div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "online", label: "Đơn online" },
                    { key: "offline", label: "Đơn offline" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setLoaiDonFilter(opt.key as any)}
                      className={`px-3 py-1 rounded-full text-sm border ${loaiDonFilter === opt.key ? "bg-blue-600 text-white border-blue-600" : "bg-card text-foreground border-border"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thời gian */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Thời gian</div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "this_month", label: "Tháng này" },
                    { key: "last_month", label: "Tháng trước" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTimeFilter(opt.key as any)}
                      className={`px-3 py-1 rounded-full text-sm border ${timeFilter === opt.key ? "bg-blue-600 text-white border-blue-600" : "bg-card text-foreground border-border"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Danh sách: Mobile cards vs Desktop table */}
            {isMobile ? (
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center text-muted-foreground py-8">Đang tải...</div>
                ) : orders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Không có đơn hàng nào</div>
                ) : (
                  orders
                    .filter(order => {
                      // Tìm kiếm đã xử lý ở server (?search=) trên toàn bộ đơn
                      // Trạng thái
                      if (trangThai !== "all" && order.trang_thai !== trangThai) return false
                      // Loại đơn
                      const ld = String(order.loai_don || '').toLowerCase()
                      if (loaiDonFilter === "online" && !ld.includes("onl")) return false
                      if (loaiDonFilter === "offline" && (ld.includes("onl") || ld === "")) return false
                      // Thời gian
                      if (timeFilter !== "all" && order.ngay_ban) {
                        const d = new Date(order.ngay_ban)
                        const now = new Date()
                        const thisMonth = now.getMonth()
                        const thisYear = now.getFullYear()
                        if (timeFilter === "this_month" && !(d.getMonth() === thisMonth && d.getFullYear() === thisYear)) return false
                        if (timeFilter === "last_month") {
                          const lastMonthDate = new Date(thisYear, thisMonth - 1, 1)
                          const lm = lastMonthDate.getMonth()
                          const ly = lastMonthDate.getFullYear()
                          if (!(d.getMonth() === lm && d.getFullYear() === ly)) return false
                        }
                      }
                      return true
                    })
                    .map(order => (
                      <div key={order.ma_don_hang || order.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                        {/* Mã đơn + trạng thái */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Mã đơn</div>
                            <div className="truncate text-md font-bold text-foreground">{order.ma_don_hang || order.id}</div>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${getStatusPillClass(order.trang_thai)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {getTrangThaiLabel(order.trang_thai)}
                          </span>
                        </div>

                        

                        <div className="my-4 border-t" />

                        {/* Ngày bán + giá */}
                        <div className="flex items-start justify-between gap-3">

                          {/* Khách hàng */}
                        <div>
                          <div className="">
                            {order.khach_hang ? (
                              <>
                                <div className="text-lg font-bold text-foreground">{order.khach_hang.ho_ten}</div>
                                {order.khach_hang.so_dien_thoai && (
                                  <div className="font-mono text-sm text-muted-foreground">{order.khach_hang.so_dien_thoai}</div>
                                )}
                              </>
                            ) : (
                              <div className="text-lg font-bold text-foreground">Khách lẻ</div>
                            )}
                          </div>
                          
                            <div className="text-sm text-muted-foreground">{new Date(order.ngay_ban).toLocaleDateString("vi-VN")}</div>
                        </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-foreground">đ{Number(order.thanh_toan || 0).toLocaleString("en-US")}</div>
                            {order.loai_don && <div className="text-sm text-muted-foreground">{order.loai_don}</div>}
                            {String(order.loai_don || "").toLowerCase().includes("onl") && (
                              <div className="mt-1 flex justify-end">
                                <GhtkStatusBadge code={order.ma_ghtk || order.ma_don_hang || order.id} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="my-4 border-t" />

                        {/* Sản phẩm + nút Xem */}
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Sản phẩm</div>
                            <div className="mt-1">
                              <OrderProductsCell orderId={order.ma_don_hang || order.id} />
                            </div>
                          </div>
                          <Button variant="secondary" size="sm" className="shrink-0 gap-1.5" onClick={() => handleViewOrder(order.ma_don_hang || order.id)}>
                            <Eye className="h-4 w-4" /> Xem
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã đơn hàng</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Thanh toán</TableHead>
                      
                      <TableHead>Loại đơn</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày bán</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          Đang tải...
                        </TableCell>
                      </TableRow>
                    ) : orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          Không có đơn hàng nào
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders
                        .filter(order => {
                          // Tìm kiếm đã xử lý ở server (?search=) trên toàn bộ đơn
                          // Trạng thái
                          if (trangThai !== "all" && order.trang_thai !== trangThai) return false
                          // Loại đơn
                          const ld = String(order.loai_don || '').toLowerCase()
                          if (loaiDonFilter === "online" && !ld.includes("onl")) return false
                          if (loaiDonFilter === "offline" && (ld.includes("onl") || ld === "")) return false
                          // Thời gian
                          if (timeFilter !== "all" && order.ngay_ban) {
                            const d = new Date(order.ngay_ban)
                            const now = new Date()
                            const thisMonth = now.getMonth()
                            const thisYear = now.getFullYear()
                            if (timeFilter === "this_month" && !(d.getMonth() === thisMonth && d.getFullYear() === thisYear)) return false
                            if (timeFilter === "last_month") {
                              const lastMonthDate = new Date(thisYear, thisMonth - 1, 1)
                              const lm = lastMonthDate.getMonth()
                              const ly = lastMonthDate.getFullYear()
                              if (!(d.getMonth() === lm && d.getFullYear() === ly)) return false
                            }
                          }
                          return true
                        })
                        .map((order) => (
                          <TableRow key={order.ma_don_hang || order.id}>
                            <TableCell className="font-medium">{order.ma_don_hang}</TableCell>
                            <TableCell>
                              {order.khach_hang ? (
                                <div>
                                  <div className="font-medium">{order.khach_hang.ho_ten}</div>
                                  <div className="text-sm text-muted-foreground">{order.khach_hang.so_dien_thoai}</div>
                                </div>
                              ) : (
                                "Khách lẻ"
                              )}
                            </TableCell>
                            {/* Sản phẩm máy đã mua */}
                            <TableCell>
                              <OrderProductsCell orderId={order.ma_don_hang || order.id} />
                            </TableCell>
                            <TableCell>
                              {order.nhan_vien?.name || order.nhan_vien?.id ? (
                                <div>
                                  <div className="font-medium">{order.nhan_vien?.name || order.nhan_vien?.id}</div>
                                  {order.nhan_vien?.role && (
                                    <div className="text-xs text-muted-foreground">
                                      {order.nhan_vien.role === "quan_ly" ? "Quản lý" : "Nhân viên"}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                "N/A"
                              )}
                            </TableCell>
                            {/* <TableCell>₫{Number(order.tong_tien || 0).toLocaleString()}</TableCell> */}
                            <TableCell>
                              <div>
                                <div className="font-medium">₫{Number(order.thanh_toan || 0).toLocaleString()}</div>
                                {order.giam_gia > 0 && (
                                  <div className="text-sm text-muted-foreground">
                                    Giảm: ₫{Number(order.giam_gia || 0).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                <Badge variant="outline">{order.loai_don || <span className="text-muted-foreground">-</span>}</Badge>
                                {String(order.loai_don || "").toLowerCase().includes("onl") && (
                                  <GhtkStatusBadge code={order.ma_ghtk || order.ma_don_hang || order.id} />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getTrangThaiColor(order.trang_thai)}>
                                {getTrangThaiLabel(order.trang_thai)}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(order.ngay_ban).toLocaleDateString("vi-VN")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleViewOrder(order.ma_don_hang || order.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Trang {page} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <OrderDetailDialog
        isOpen={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        orderId={selectedOrder}
      />
    </ProtectedRoute>
  )
}