"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Product {
  id: string
  ten_san_pham: string
  loai_phu_kien: string
  dung_luong: string
  mau_sac: string
  imei: string
  tinh_trang: string
  gia_nhap: number
  gia_ban: number
  trang_thai: string
  ghi_chu?: string
  ngay_nhap: string
  nguoi_nhap?: { ho_ten: string }
  nguoi_ban?: { ho_ten: string }
  ngay_ban?: string
}

interface ProductDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
}

export function ProductDetailDialog({ isOpen, onClose, product }: ProductDetailDialogProps) {
  if (!product) return null

  const getTrangThaiColor = (trangThai: string) => {
    switch (trangThai) {
      case "Còn hàng":
        return "bg-green-100 text-green-800"
      case "da_ban":
        return "bg-blue-100 text-blue-800"
      case "hong":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTinhTrangColor = (tinhTrang: string) => {
    switch (tinhTrang) {
      case "moi":
        return "bg-emerald-100 text-emerald-800"
      case "cu_99":
        return "bg-green-100 text-green-800"
      case "cu_95":
        return "bg-yellow-100 text-yellow-800"
      case "cu_90":
        return "bg-orange-100 text-orange-800"
      case "hong":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chi tiết sản phẩm</DialogTitle>
          <DialogDescription>Thông tin chi tiết về sản phẩm trong kho</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{product.ten_san_pham}</h3>
            <p className="text-muted-foreground">
              {product.loai_phu_kien} {product.dung_luong} - {product.mau_sac}
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">IMEI</p>
              <p className="font-mono">{product.imei}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tình trạng</p>
              <Badge className={getTinhTrangColor(product.tinh_trang)}>
                {product.tinh_trang === "moi"
                  ? "Mới"
                  : product.tinh_trang === "cu_99"
                    ? "Cũ 99%"
                    : product.tinh_trang === "cu_95"
                      ? "Cũ 95%"
                      : product.tinh_trang === "cu_90"
                        ? "Cũ 90%"
                        : "Hỏng"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Giá nhập</p>
              <p className="text-lg font-semibold">₫{(product.gia_nhap ?? 0).toLocaleString("vi-VN") + " VNĐ"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Giá bán</p>
              <p className="text-lg font-semibold">₫{(product.gia_ban ?? 0).toLocaleString("vi-VN") + " VNĐ"}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Trạng thái</p>
            <Badge className={getTrangThaiColor(product.trang_thai)}>
              {product.trang_thai === "Còn hàng" ? "Còn hàng" : product.trang_thai === "da_ban" ? "Đã bán" : "Hỏng"}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ngày nhập</p>
              <p>{new Date(product.ngay_nhap).toLocaleDateString("vi-VN")}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Người nhập</p>
              <p>{product.nguoi_nhap?.ho_ten || "N/A"}</p>
            </div>
          </div>

          {product.trang_thai === "da_ban" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ngày bán</p>
                <p>{product.ngay_ban ? new Date(product.ngay_ban).toLocaleDateString("vi-VN") : "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Người bán</p>
                <p>{product.nguoi_ban?.ho_ten || "N/A"}</p>
              </div>
            </div>
          )}

          {product.ghi_chu && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ghi chú</p>
              <p className="text-sm">{product.ghi_chu}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
