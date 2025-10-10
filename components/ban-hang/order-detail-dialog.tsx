"use client"

import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
dayjs.extend(customParseFormat)

import { useState, useEffect, Fragment } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useIsMobile } from "@/hooks/use-mobile"

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

// Kiểu dữ liệu đơn giản cho bản ghi bảo hành hiển thị
interface WarrantyRow {
  ma_hd: string
  imei: string
  ma_goi: string
  han_tong: string
  trang_thai?: string
  con_lai?: number | null
  han_1doi1?: string
  han_phan_cung?: string
  han_cnc?: string
  lifetime?: boolean
}

export function OrderDetailDialog({ isOpen, onClose, orderId }: OrderDetailDialogProps) {
  const isMobile = useIsMobile()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [warranties, setWarranties] = useState<WarrantyRow[]>([])
  const [warrantyLoading, setWarrantyLoading] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)
  const [returnImei, setReturnImei] = useState("")
  const [returnReason, setReturnReason] = useState("")
  const [returnAmount, setReturnAmount] = useState("")
  const [isPartner, setIsPartner] = useState(false)
  const [note, setNote] = useState("")

  // Helper: lấy giá bán theo IMEI từ order
  const getPriceByImei = (imei: string) => {
    if (!order) return 0
    const item = (order.chi_tiet || []).find(i => i.san_pham?.imei === imei)
    if (!item) return 0
    // Ưu tiên thanh_tien nếu có, fallback gia_ban
    return Number(item.thanh_tien || item.gia_ban || 0)
  }

  // Xác định có phải hàng đối tác từ nguồn hàng của dòng
  const isPartnerSourceByImei = (imei: string) => {
    if (!order) return false
    const item = (order.chi_tiet || []).find(i => i.san_pham?.imei === imei)
    const src = (item as any)?.nguon_hang ? String((item as any).nguon_hang).toLowerCase() : ''
    return src.includes('đối tác') || src.includes('doi tac') || src.includes('partner')
  }

  // Prefill khi chỉ có 1 thiết bị trong đơn
  useEffect(() => {
    if (!order) return
    const devices = (order.chi_tiet || []).filter(i => i.san_pham?.imei)
    if (devices.length === 1) {
      const imei = devices[0].san_pham!.imei
      setReturnImei(imei)
      const price = getPriceByImei(imei)
      setReturnAmount(price > 0 ? String(price) : "")
      setIsPartner(isPartnerSourceByImei(imei))
    }
  }, [order])
  const EXPIRING_DAYS = 7

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
    // Sau khi có chi tiết đơn hàng mới fetch bảo hành (tránh gọi 2 lần)
    fetchWarranties(orderDetail.ma_don_hang)
    } catch (error) {
      console.error("Error fetching order detail:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWarranties = async (oid: string) => {
    try {
      setWarrantyLoading(true)
      const res = await fetch(`/api/warranties?orderId=${encodeURIComponent(oid)}`)
      if (!res.ok) throw new Error('Failed to fetch warranties')
      const data = await res.json()
      setWarranties(Array.isArray(data.data) ? data.data : [])
    } catch (e) {
      console.error('[WARRANTY][UI] load error:', e)
      setWarranties([])
    } finally {
      setWarrantyLoading(false)
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="p-3 border rounded-lg bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{order.khach_hang.ho_ten}</div>
                        <div className="text-sm text-muted-foreground">{order.khach_hang.so_dien_thoai}</div>
                      </div>
                      <div className="flex gap-2">
                        {order.khach_hang.so_dien_thoai && (
                          <a className="text-xs px-2 py-1 border rounded hover:bg-slate-50" href={`tel:${order.khach_hang.so_dien_thoai}`}>Gọi</a>
                        )}
                        {order.khach_hang.so_dien_thoai && (
                          <a className="text-xs px-2 py-1 border rounded hover:bg-slate-50" href={`sms:${order.khach_hang.so_dien_thoai}`}>SMS</a>
                        )}
                      </div>
                    </div>
                    {(order.khach_hang.email || order.khach_hang.dia_chi) && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {order.khach_hang.email && (
                          <div className="truncate"><span className="text-muted-foreground">Email:</span> {order.khach_hang.email}</div>
                        )}
                        {order.khach_hang.dia_chi && (
                          <div className="truncate"><span className="text-muted-foreground">Địa chỉ:</span> {order.khach_hang.dia_chi}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Khách lẻ</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Bảo hành */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Bảo hành</h3>
                {warrantyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {(!warranties || warranties.length === 0) && !warrantyLoading && (
                <p className="text-sm text-muted-foreground">Không có gói bảo hành</p>
              )}
              {warranties && warranties.length > 0 && (
                isMobile ? (
                  <div className="space-y-2">
                    {warranties.map(w => {
                      const days = typeof w.con_lai === 'number' ? w.con_lai : null
                      const status = w.trang_thai || (days && days>0? 'active':'')
                      const isExpired = status === 'expired' || (days !== null && days <= 0)
                      const isExpiringSoon = !isExpired && days !== null && days <= EXPIRING_DAYS
                      const badgeClass = isExpired
                        ? 'bg-red-100 text-red-700'
                        : isExpiringSoon
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      return (
                        <div key={w.ma_hd + w.imei} className="rounded-xl border p-3 bg-white">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-xs">{w.ma_hd}</div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium inline-block ${badgeClass}`}>
                              {isExpired ? 'Expired' : isExpiringSoon ? `Sắp hết (${days}d)` : 'Active'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">IMEI: <span className="font-mono">{w.imei}</span></div>
                          <div className="mt-2 text-sm">Gói: <span className="font-medium">{w.ma_goi}</span></div>
                          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                            <div>Hạn tổng: <span className="font-mono">{w.han_tong || '—'}</span></div>
                            <div>Còn: <span className={days !== null && days <= EXPIRING_DAYS ? 'text-amber-600 font-medium' : 'text-emerald-600'}>{isExpired ? 0 : (days ?? '—')}</span></div>
                            <div>1-1: <span className="font-mono">{w.han_1doi1 || '—'}</span></div>
                            <div>HW: <span className="font-mono">{w.han_phan_cung || '—'}</span></div>
                            <div>CNC: <span className="font-mono">{w.han_cnc || '—'}</span></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã HĐ</TableHead>
                          <TableHead>IMEI</TableHead>
                          <TableHead>Gói</TableHead>
                          <TableHead className="pl-14 text-left">Hạn Tổng</TableHead>
                          <TableHead>Trạng Thái</TableHead>
                          <TableHead>Còn (ngày)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {warranties.map(w => {
                          const days = typeof w.con_lai === 'number' ? w.con_lai : null
                          const status = w.trang_thai || (days && days>0? 'active':'')
                          const isExpired = status === 'expired' || (days !== null && days <= 0)
                          const isExpiringSoon = !isExpired && days !== null && days <= EXPIRING_DAYS
                          const badgeClass = isExpired
                            ? 'bg-red-100 text-red-700'
                            : isExpiringSoon
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          return (
                            <TableRow key={w.ma_hd + w.imei}>
                              <TableCell className="font-mono text-xs">{w.ma_hd}</TableCell>
                              <TableCell className="font-mono text-xs">{w.imei}</TableCell>
                              <TableCell>{w.ma_goi}</TableCell>
                              <TableCell>
                                <div className="space-y-1 text-left">
                                  <div className="grid grid-cols-[3.5rem_auto] items-baseline w-full">
                                    <div />
                                    <div className="font-mono tabular-nums">{w.han_tong || '—'}</div>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground leading-tight space-y-0.5">
                                    <div className="grid grid-cols-[3.5rem_auto] items-baseline w-full">
                                      <div className="text-right pr-1">1-1:</div>
                                      <div className="font-mono tabular-nums">{w.han_1doi1 || '—'}</div>
                                    </div>
                                    <div className="grid grid-cols-[3.5rem_auto] items-baseline w-full">
                                      <div className="text-right pr-1">HW:</div>
                                      <div className="font-mono tabular-nums">{w.han_phan_cung || '—'}</div>
                                    </div>
                                    <div className="grid grid-cols-[3.5rem_auto] items-baseline w-full">
                                      <div className="text-right pr-1">CNC:</div>
                                      <div className="font-mono tabular-nums">{w.han_cnc || '—'}</div>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium inline-block ${badgeClass}`}>
                                  {isExpired ? 'Expired' : isExpiringSoon ? `Sắp hết (${days}d)` : 'Active'}
                                </span>
                              </TableCell>
                              <TableCell>
                                {days !== null && !isExpired && (
                                  <span className={days <= EXPIRING_DAYS ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
                                    {days}
                                  </span>
                                )}
                                {isExpired && <span className='text-red-600 font-medium'>0</span>}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </div>

            <Separator />

            {/* Chi tiết sản phẩm */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Sản phẩm đã mua</h3>
              {isMobile ? (
                <div className="space-y-2">
                  {(order.chi_tiet ?? []).map((item) => (
                    <Fragment key={item.id}>
                      {item.san_pham && (
                        <div className="rounded-xl border p-3 bg-white">
                          <div className="font-medium">
                            {item.san_pham.ten_san_pham} {item.san_pham.loai_may}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.san_pham.dung_luong} • {item.san_pham.mau_sac}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-1">IMEI: {item.san_pham.imei}</div>
                          {(item.san_pham.tinh_trang_may || item.tinh_trang_may) && (
                            <div className="mt-1 text-sm">TT: {item.san_pham.tinh_trang_may || item.tinh_trang_may}</div>
                          )}
                          <div className="mt-1 flex items-center justify-between">
                            <div className="text-sm">SL: {item.so_luong}</div>
                            <div className="font-semibold">₫{Number(item.thanh_tien ?? 0).toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                      {item.phu_kien && (
                        <div className="rounded-xl border p-3 bg-white">
                          <div className="font-medium">{item.phu_kien.ten_phu_kien}</div>
                          <div className="text-xs text-muted-foreground capitalize">{item.phu_kien.loai_phu_kien}</div>
                          <div className="mt-1 text-sm">SL: {item.so_luong}</div>
                        </div>
                      )}
                      {(item as any)["Phụ Kiện"] && (
                        <div className="rounded-xl border p-3 bg-white">
                          <div className="font-medium">{(item as any)["Phụ Kiện"]}</div>
                          <div className="mt-1 text-sm">SL: 1</div>
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              ) : (
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
                        <Fragment key={item.id}>
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
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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

            <Separator />

            {/* Hoàn trả */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Hoàn trả</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Chọn IMEI</Label>
                  <select
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    value={returnImei}
                    onChange={(e) => {
                      const v = e.target.value
                      setReturnImei(v)
                      const price = getPriceByImei(v)
                      setReturnAmount(price > 0 ? String(price) : "")
                      setIsPartner(isPartnerSourceByImei(v))
                    }}
                  >
                    <option value="">-- Chọn IMEI --</option>
                    {(order.chi_tiet ?? []).filter(i => i.san_pham?.imei).map(i => (
                      <option key={i.san_pham!.imei} value={i.san_pham!.imei}>
                        {i.san_pham!.imei} — {i.san_pham!.ten_san_pham}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm">Số tiền hoàn (VND)</Label>
                  <Input
                    className="mt-1"
                    value={returnAmount ? `₫${Number(returnAmount).toLocaleString('vi-VN')}đ` : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '')
                      setReturnAmount(digits)
                    }}
                    placeholder=" "
                  />
                </div>
                <div>
                  <Label className="text-sm">Lý do</Label>
                  <Input className="mt-1" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Khách đổi ý / Lỗi kỹ thuật..." />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Checkbox id="partner-item" checked={isPartner} onCheckedChange={(v: any)=> setIsPartner(Boolean(v))} />
                  <Label htmlFor="partner-item" className="text-sm">Hàng đối tác</Label>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-sm">Ghi chú</Label>
                  <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú bổ sung" />
                </div>
              </div>

              <div className="mt-4 hidden md:flex justify-end">
                <Button
                  disabled={returnLoading || !returnImei}
                  onClick={async () => {
                    if (!order) return
                    try {
                      setReturnLoading(true)
                      const res = await fetch('/api/hoan-tra', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ma_don_hang: order.ma_don_hang,
                          khach_hang: order.khach_hang?.ho_ten,
                          so_dien_thoai: order.khach_hang?.so_dien_thoai,
                          imei: returnImei,
                          ly_do: returnReason,
                          so_tien_hoan: returnAmount ? Number(returnAmount) : undefined,
                          nguoi_xu_ly: order.nhan_vien?.ho_ten,
                          restock_inhouse: !isPartner,
                          partner_return: isPartner,
                          ghi_chu: note,
                        })
                      })
                      if (!res.ok) throw new Error('Hoàn trả thất bại')
                      // Có thể fetch lại bảo hành sau hoàn trả
                      fetchWarranties(order.ma_don_hang)
                      onClose()
                    } catch (e) {
                      console.error('[RETURN][UI] error:', e)
                      alert('Hoàn trả thất bại, vui lòng thử lại.')
                    } finally {
                      setReturnLoading(false)
                    }
                  }}
                >
                  {returnLoading ? (<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Đang hoàn trả...</span>) : 'Xác nhận hoàn trả'}
                </Button>
              </div>
              {/* Sticky action bar for mobile */}
              {isMobile && (
                <div className="md:hidden sticky bottom-0 left-0 right-0 bg-white border-t mt-2 py-3 flex justify-end">
                  <Button
                    disabled={returnLoading || !returnImei}
                    onClick={async () => {
                      if (!order) return
                      try {
                        setReturnLoading(true)
                        const res = await fetch('/api/hoan-tra', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            ma_don_hang: order.ma_don_hang,
                            khach_hang: order.khach_hang?.ho_ten,
                            so_dien_thoai: order.khach_hang?.so_dien_thoai,
                            imei: returnImei,
                            ly_do: returnReason,
                            so_tien_hoan: returnAmount ? Number(returnAmount) : undefined,
                            nguoi_xu_ly: order.nhan_vien?.ho_ten,
                            restock_inhouse: !isPartner,
                            partner_return: isPartner,
                            ghi_chu: note,
                          })
                        })
                        if (!res.ok) throw new Error('Hoàn trả thất bại')
                        fetchWarranties(order.ma_don_hang)
                        onClose()
                      } catch (e) {
                        console.error('[RETURN][UI] error:', e)
                        alert('Hoàn trả thất bại, vui lòng thử lại.')
                      } finally {
                        setReturnLoading(false)
                      }
                    }}
                  >
                    {returnLoading ? (<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Đang hoàn trả...</span>) : 'Xác nhận hoàn trả'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
