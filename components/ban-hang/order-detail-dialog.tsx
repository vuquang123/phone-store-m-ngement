"use client"

import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
dayjs.extend(customParseFormat)

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"

interface OrderDetail {
  id: string
  ma_don_hang: string
  tong_tien: number
  giam_gia: number
  thanh_toan: number
  phuong_thuc_thanh_toan: string
  trang_thai: string
  ngay_ban: string
  ghi_chu?: string
  khach_hang?: {
    ho_ten: string
    so_dien_thoai: string
    email?: string
    dia_chi?: string
  }
  nhan_vien?: { ho_ten: string }
  chi_tiet: Array<{
    id: string
    so_luong: number
    gia_ban: number
    thanh_tien: number
    tinh_trang_may?: string
    san_pham?: {
      ten_san_pham: string
      loai_may: string
      dung_luong: string
      mau_sac: string
      imei: string
      tinh_trang_may?: string
    }
    phu_kien?: {
      ten_phu_kien: string
      loai_phu_kien: string
    }
  }>
}

interface OrderDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  orderId: string | null
}

export function OrderDetailDialog({ isOpen, onClose, orderId }: OrderDetailDialogProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetail()
    }
  }, [isOpen, orderId])

  const fetchOrderDetail = async () => {
    if (!orderId) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/ban-hang/${orderId}`)
      if (!response.ok) throw new Error("Failed to fetch order detail")

      const data = await response.json()
      // Tự động kiểm tra và chuyển đổi các trường cho phù hợp với FE
      // Xử lý ngày bán
      let ngayBan = data.ngay_ban || data.ngay_xuat || data["Ngày Xuất"] || "";
      // Sử dụng dayjs để parse ngày bán từ chuỗi DD/MM/YYYY
      if (typeof ngayBan === "string" && ngayBan.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
        const parsed = dayjs(ngayBan, "D/M/YYYY", true);
        ngayBan = parsed.isValid() ? parsed.format("DD/MM/YYYY") : ngayBan;
      }
      // Xử lý mã đơn hàng
      const maDonHang = data.ma_don_hang || data.id || data["ID Đơn Hàng"] || "";
      // Xử lý thanh toán
      const tongTien = typeof data.tong_tien === "string" ? parseInt(data.tong_tien.replace(/[^\d]/g, "")) || 0 : (data.tong_tien || parseInt(data["Giá Bán"]?.replace(/[^\d]/g, "")) || 0);
      const thanhToan = typeof data.thanh_toan === "string" ? parseInt(data.thanh_toan.replace(/[^\d]/g, "")) || 0 : (data.thanh_toan || tongTien);
      const phuongThuc = data.phuong_thuc_thanh_toan || data["Hình Thức Thanh Toán"] || "";
      const orderDetail: OrderDetail = {
        id: maDonHang,
        ma_don_hang: maDonHang,
        tong_tien: tongTien,
        giam_gia: typeof data.giam_gia === "string" ? parseInt(data.giam_gia.replace(/[^\d]/g, "")) || 0 : (data.giam_gia || 0),
        thanh_toan: thanhToan,
        phuong_thuc_thanh_toan: phuongThuc,
        trang_thai: data.trang_thai || "hoan_thanh",
        ngay_ban: ngayBan,
        ghi_chu: data.ghi_chu || data["Ghi Chú"] || "",
        khach_hang: data.khach_hang || (data.ten_khach_hang || data["Tên Khách Hàng"]
          ? {
              ho_ten: data.ten_khach_hang || data["Tên Khách Hàng"] || "Khách lẻ",
              so_dien_thoai: data.so_dien_thoai || data["Số Điện Thoại"] || ""
            }
          : undefined),
        nhan_vien: data.nhan_vien || (data["Người Bán"] ? { ho_ten: data["Người Bán"] } : undefined),
        chi_tiet: Array.isArray(data.chi_tiet)
          ? data.chi_tiet.map((item: any) => {
              const isMay = item.san_pham?.imei || item.imei;
              return {
                id: item.id || "",
                so_luong: item.so_luong || 1,
                gia_ban: isMay ? (typeof item.gia_ban === "string" ? parseInt(item.gia_ban.replace(/[^\d]/g, "")) || 0 : item.gia_ban) : 0,
                thanh_tien: isMay ? (typeof item.thanh_tien === "string" ? parseInt(item.thanh_tien.replace(/[^\d]/g, "")) || 0 : item.thanh_tien) : 0,
                tinh_trang_may: item.tinh_trang_may || item["Tình Trạng Máy"] || data["Tình Trạng Máy"] || "",
                san_pham: item.san_pham || {
                  ten_san_pham: item.ten_san_pham || data.ten_san_pham || data["Tên Sản Phẩm"] || "",
                  loai_may: item.loai_may || data.loai_may || data["Loại Máy"] || "",
                  dung_luong: item.dung_luong || data.dung_luong || data["Dung Lượng"] || "",
                  mau_sac: item.mau_sac || data.mau_sac || data["Màu Sắc"] || "",
                  imei: item.imei || data.imei || data["IMEI"] || "",
                  tinh_trang_may: item.tinh_trang_may || item["Tình Trạng Máy"] || data["Tình Trạng Máy"] || ""
                },
                phu_kien: item.phu_kien || (item["Phụ Kiện"] ? { ten_phu_kien: item["Phụ Kiện"], loai_phu_kien: "" } : undefined)
              }
            })
          : [
              {
                id: "0",
                so_luong: 1,
                gia_ban: typeof data["Giá Bán"] === "string" ? parseInt(data["Giá Bán"].replace(/[^\d]/g, "")) || 0 : data["Giá Bán"],
                thanh_tien: typeof data["Giá Bán"] === "string" ? parseInt(data["Giá Bán"].replace(/[^\d]/g, "")) || 0 : data["Giá Bán"],
                tinh_trang_may: data["Tình Trạng Máy"] || "",
                san_pham: {
                  ten_san_pham: data.ten_san_pham || data["Tên Sản Phẩm"] || "",
                  loai_may: data.loai_may || data["Loại Máy"] || "",
                  dung_luong: data.dung_luong || data["Dung Lượng"] || "",
                  mau_sac: data.mau_sac || data["Màu Sắc"] || "",
                  imei: data.imei || data["IMEI"] || "",
                  tinh_trang_may: data["Tình Trạng Máy"] || ""
                },
                phu_kien: data.phu_kien ? { ten_phu_kien: data.phu_kien, loai_phu_kien: "" } : undefined
              }
            ],
      }
      setOrder(orderDetail)
    } catch (error) {
      console.error("Error fetching order detail:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!order && !isLoading) return null

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Chi tiết đơn hàng</DialogTitle>
          <DialogDescription>Thông tin chi tiết về đơn hàng và sản phẩm</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Thông tin đơn hàng */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Thông tin đơn hàng</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Mã đơn hàng:</span>
                    <p className="font-mono">{order.ma_don_hang}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Ngày bán:</span>
                    <p>{order.ngay_ban}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Nhân viên bán:</span>
                    <p>{order.nhan_vien?.ho_ten || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Trạng thái:</span>
                    <Badge className={getTrangThaiColor(order.trang_thai)}>
                      {order.trang_thai === "hoan_thanh" ? "Hoàn thành" : "Đã hủy"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Thông tin khách hàng</h3>
                {order.khach_hang ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Họ tên:</span>
                      <p>{order.khach_hang.ho_ten}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Số điện thoại:</span>
                      <p>{order.khach_hang.so_dien_thoai}</p>
                    </div>
                    {order.khach_hang.email && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Email:</span>
                        <p>{order.khach_hang.email}</p>
                      </div>
                    )}
                    {order.khach_hang.dia_chi && (
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Địa chỉ:</span>
                        <p>{order.khach_hang.dia_chi}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Khách lẻ</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Chi tiết sản phẩm */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Sản phẩm đã mua</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>Tình Trạng Máy</TableHead>
                      <TableHead>Số lượng</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(order.chi_tiet ?? []).map((item) => (
                      <>
                        {item.san_pham && (
                          <TableRow key={item.id + "-may"}>
                            <TableCell>
                              <div className="font-medium">
                                {item.san_pham.ten_san_pham} {item.san_pham.loai_may}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.san_pham.dung_luong} - {item.san_pham.mau_sac}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">IMEI: {item.san_pham.imei}</div>
                            </TableCell>
                            <TableCell>{item.san_pham.tinh_trang_may || item.tinh_trang_may || ""}</TableCell>
                            <TableCell>{item.so_luong}</TableCell>
                            <TableCell className="text-right">₫{Number(item.thanh_tien ?? 0).toLocaleString()}</TableCell>
                          </TableRow>
                        )}
                        {item.phu_kien && (
                          <TableRow key={item.id + "-pk"}>
                            <TableCell>
                              <div className="font-medium">{item.phu_kien.ten_phu_kien}</div>
                              <div className="text-sm text-muted-foreground capitalize">
                                {item.phu_kien.loai_phu_kien}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell>{item.so_luong}</TableCell>
                            <TableCell className="text-right"></TableCell>
                          </TableRow>
                        )}
                        {/* Nếu API trả về phụ kiện là chuỗi, render dòng riêng */}
                        {(item as any)["Phụ Kiện"] && (
                          <TableRow key={item.id + "-pkstr"}>
                            <TableCell>
                              <div className="font-medium">{(item as any)["Phụ Kiện"]}</div>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell>1</TableCell>
                            <TableCell className="text-right"></TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Tổng kết */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Thanh toán</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Phương thức:</span>
                    <Badge className={getPhuongThucColor(order.phuong_thuc_thanh_toan)}>
                      {order.phuong_thuc_thanh_toan === "Tiền mặt"
                        ? "Tiền mặt"
                        : order.phuong_thuc_thanh_toan === "Chuyển khoản"
                          ? "Chuyển khoản"
                          : "Thẻ"}
                    </Badge>
                  </div>
                  {order.ghi_chu && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Ghi chú:</span>
                      <p className="text-sm">{order.ghi_chu}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="space-y-2">
                  {order.giam_gia > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Giảm giá:</span>
                      <span>-₫{Number(order.giam_gia ?? 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Thanh toán:</span>
                    <span>₫{Number(order.thanh_toan ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
