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
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [trangThai, setTrangThai] = useState("all")

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
      const mapped = Array.isArray(data.data)
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
      setOrders(mapped)
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
                        if (!search.trim()) return true;
                        const s = search.trim().toLowerCase();
                        const ten = order.khach_hang?.ho_ten?.toLowerCase() || "";
                        const sdt = order.khach_hang?.so_dien_thoai?.toLowerCase() || "";
                        return ten.includes(s) || sdt.includes(s);
                      })
                      .map((order) => (
                        <TableRow key={order.id}>
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
                              <Button variant="ghost" size="icon" onClick={() => handleViewOrder(order.id)}>
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