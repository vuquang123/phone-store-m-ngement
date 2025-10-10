"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, FileText } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useIsMobile } from "@/hooks/use-mobile"
import { OrderDetailDialog } from "@/components/ban-hang/order-detail-dialog"

interface Order {
  id: string
  ma_don_hang: string
  tong_tien: number
  giam_gia: number
  thanh_toan: number
  phuong_thuc_thanh_toan: string
  trang_thai: string
  ngay_ban: string
  khach_hang?: { ho_ten: string; so_dien_thoai: string }
  nhan_vien?: { id: string }
  loai_don?: string
  hinh_thuc_van_chuyen?: string
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
  const [trangThai, setTrangThai] = useState("all")
  const [loaiDonFilter, setLoaiDonFilter] = useState<"all" | "online" | "offline">("all")
  const [timeFilter, setTimeFilter] = useState<"all" | "this_month" | "last_month">("all")

  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        // Chỉ lấy đơn hàng đã thanh toán
        trang_thai: "hoan_thanh",
      })

      const response = await fetch(`/api/ban-hang?${params}`)
      if (!response.ok) throw new Error("Failed to fetch orders")

      const data = await response.json()
      // Map lại dữ liệu từ sheet
      const mappedRaw = Array.isArray(data.data)
        ? data.data.map((item: any, idx: number) => {
            // Chuyển giá trị tiền từ chuỗi sang số
            const giaBanRaw = item.gia_ban || "";
            const giaBanNum = typeof giaBanRaw === "string" ? parseInt(giaBanRaw.replace(/[^\d]/g, "")) || 0 : Number(giaBanRaw) || 0;
            // Chuyển ngày bán từ chuỗi sang Date
            let ngayBanRaw = item.ngay_xuat || "";
            let ngayBanDate = "";
            if (typeof ngayBanRaw === "string" && ngayBanRaw.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
              const [d, m, y] = ngayBanRaw.split("/");
              ngayBanDate = new Date(Number(y), Number(m) - 1, Number(d)).toISOString();
            } else {
              ngayBanDate = ngayBanRaw;
            }
            return {
              id: item.id || item.ma_don_hang || String(idx),
              ma_don_hang: item.ma_don_hang || item.id || "",
              tong_tien: giaBanNum,
              giam_gia: 0, // Sheet chưa có trường này
              thanh_toan: giaBanNum,
              phuong_thuc_thanh_toan: item["Hình Thức Thanh Toán"] || item.hinh_thuc_thanh_toan || "",
              trang_thai: item.trang_thai || "hoan_thanh",
              ngay_ban: ngayBanDate,
              khach_hang: item["Tên Khách Hàng"] || item.ten_khach_hang || item.so_dien_thoai
                ? { ho_ten: item["Tên Khách Hàng"] || item.ten_khach_hang || "Khách lẻ", so_dien_thoai: item["Số Điện Thoại"] || item.so_dien_thoai || "" }
                : undefined,
              nhan_vien: item["Người Bán"] || item.nhan_vien ? { id: item["Người Bán"] || (item.nhan_vien && item.nhan_vien.id) || "" } : undefined,
              loai_don: item["Loại Đơn"] || item.loai_don || "",
              hinh_thuc_van_chuyen: item["Hình Thức Vận Chuyển"] || item.hinh_thuc_van_chuyen || "",
              // Có thể bổ sung thêm các trường khác nếu cần
            };
          })
        : [];
      // Gộp theo mã đơn hàng, cộng tổng thanh toán (thanh_toan)
      const groupedMap = new Map<string, Order & { _ids: string[] }>()
      for (const o of mappedRaw) {
        const key = o.ma_don_hang || o.id
        if (!key) continue
        const ex = groupedMap.get(key)
        if (!ex) {
          groupedMap.set(key, { ...o, _ids: [o.id] })
        } else {
          ex.thanh_toan = (Number(ex.thanh_toan) || 0) + (Number(o.thanh_toan) || 0)
          ex.tong_tien = (Number(ex.tong_tien) || 0) + (Number(o.tong_tien) || 0)
          // Giữ ngày bán sớm nhất cho ổn định hiển thị (hoặc muộn nhất tuỳ nhu cầu)
          if (o.ngay_ban && (!ex.ngay_ban || new Date(o.ngay_ban) < new Date(ex.ngay_ban))) {
            ex.ngay_ban = o.ngay_ban
          }
          // Ưu tiên thông tin khách nếu trống
          if (!ex.khach_hang && o.khach_hang) ex.khach_hang = o.khach_hang
          if (!ex.nhan_vien && o.nhan_vien) ex.nhan_vien = o.nhan_vien
          if (!ex.phuong_thuc_thanh_toan && o.phuong_thuc_thanh_toan) ex.phuong_thuc_thanh_toan = o.phuong_thuc_thanh_toan
          ex._ids.push(o.id)
        }
      }
      const grouped = Array.from(groupedMap.values()).map(g => ({
        ...g,
        id: g.ma_don_hang || g.id // đảm bảo mở dialog dùng mã đơn hàng
      }))
      setOrders(grouped)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error("Error fetching orders:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [page])

  const handleViewOrder = (orderId: string) => {
    setSelectedOrder(orderId)
    setIsDetailDialogOpen(true)
  }

  const getTrangThaiColor = (trangThai: string) => {
    switch (trangThai) {
      case "hoan_thanh":
        return "bg-green-100 text-green-800"
      case "huy":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPhuongThucColor = (phuongThuc: string) => {
    switch (phuongThuc) {
      case "Tiền mặt":
        return "bg-blue-100 text-blue-800"
      case "Chuyển khoản":
        return "bg-purple-100 text-purple-800"
      case "Thẻ":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Danh sách đơn hàng</h2>
            <p className="text-muted-foreground">Quản lý và theo dõi các đơn hàng đã bán</p>
          </div>
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
              {/* Trạng thái */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Trạng thái</div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "hoan_thanh", label: "Hoàn thành" },
                    { key: "huy", label: "Đã hủy" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTrangThai(opt.key)}
                      className={`px-3 py-1 rounded-full text-sm border ${trangThai === opt.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loại đơn */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Loại đơn</div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "online", label: "Đơn onl" },
                    { key: "offline", label: "Tại quầy" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setLoaiDonFilter(opt.key as any)}
                      className={`px-3 py-1 rounded-full text-sm border ${loaiDonFilter === opt.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thời gian */}
              <div>
                <div className="text-xs text-slate-500 mb-1">Thời gian</div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "this_month", label: "Tháng này" },
                    { key: "last_month", label: "Tháng trước" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setTimeFilter(opt.key as any)}
                      className={`px-3 py-1 rounded-full text-sm border ${timeFilter === opt.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200"}`}
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
                      // Tìm kiếm
                      const s = search.trim().toLowerCase()
                      if (s) {
                        const ten = order.khach_hang?.ho_ten?.toLowerCase() || ""
                        const sdt = order.khach_hang?.so_dien_thoai?.toLowerCase() || ""
                        if (!ten.includes(s) && !sdt.includes(s)) return false
                      }
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
                      <div key={order.ma_don_hang || order.id} className="rounded-xl border p-4 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm text-slate-500">Mã đơn</div>
                            <div className="font-semibold text-slate-900">{order.ma_don_hang || order.id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getTrangThaiColor(order.trang_thai)}>
                              {order.trang_thai === "hoan_thanh" ? "Hoàn thành" : "Đã hủy"}
                            </Badge>
                            <Badge className={getPhuongThucColor(order.phuong_thuc_thanh_toan)}>
                              {order.phuong_thuc_thanh_toan}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {order.khach_hang ? (
                            <div>
                              <div className="font-medium">{order.khach_hang.ho_ten}</div>
                              <div className="text-xs text-muted-foreground">{order.khach_hang.so_dien_thoai}</div>
                            </div>
                          ) : (
                            <div className="font-medium">Khách lẻ</div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-slate-600 text-sm">{new Date(order.ngay_ban).toLocaleDateString("vi-VN")}</div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-900">₫{Number(order.thanh_toan || 0).toLocaleString()}</div>
                            {order.loai_don && (
                              <div className="text-xs text-muted-foreground">{order.loai_don}</div>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewOrder(order.ma_don_hang || order.id)}>
                            <Eye className="h-4 w-4 mr-1" /> Xem
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/hoan-tra">Hoàn trả</Link>
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
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Thanh toán</TableHead>
                      <TableHead>Phương thức</TableHead>
                      <TableHead>Loại đơn</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày bán</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Đang tải...
                        </TableCell>
                      </TableRow>
                    ) : orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Không có đơn hàng nào
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders
                        .filter(order => {
                          // Tìm kiếm
                          const s = search.trim().toLowerCase()
                          if (s) {
                            const ten = order.khach_hang?.ho_ten?.toLowerCase() || ""
                            const sdt = order.khach_hang?.so_dien_thoai?.toLowerCase() || ""
                            if (!ten.includes(s) && !sdt.includes(s)) return false
                          }
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
                            <TableCell>{order.nhan_vien?.id || "N/A"}</TableCell>
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
                              <Badge className={getPhuongThucColor(order.phuong_thuc_thanh_toan)}>
                                {order.phuong_thuc_thanh_toan === "Tiền mặt"
                                  ? "Tiền mặt"
                                  : order.phuong_thuc_thanh_toan === "Chuyển khoản"
                                    ? "Chuyển khoản"
                                    : "Thẻ"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{order.loai_don || <span className="text-muted-foreground">-</span>}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getTrangThaiColor(order.trang_thai)}>
                                {order.trang_thai === "hoan_thanh" ? "Hoàn thành" : "Đã hủy"}
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