"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit2, Eye, Hammer, UserPlus } from "lucide-react"
import { getTrangThaiColor, getTrangThaiKhoColor, getLoaiMayLabel } from "@/lib/utils/inventory-helpers"

interface Product {
  id: string
  ten_san_pham: string
  loai_phu_kien: string
  dung_luong: string
  mau_sac: string
  pin: string
  imei: string
  serial?: string
  tinh_trang: string
  gia_nhap: number
  gia_ban: number
  giam_gia: number
  trang_thai: string
  trang_thai_kho?: string
  ngay_nhap: string
  ghi_chu?: string
  loai_may?: string
  nguon?: string
}

interface ProductTableProps {
  products: Product[]
  selectedIds: string[]
  onSelect: (id: string) => void
  onSelectAll: () => void
  isEditMode: boolean
  isManager: boolean
  onEdit: (product: Product) => void
  onSendCNC?: (product: Product) => void
  onSendPartner?: (product: Product) => void
  onViewCustomer?: (product: Product) => void
  totalCount?: number
}

export function ProductTable({
  products,
  selectedIds,
  onSelect,
  onSelectAll,
  isEditMode,
  isManager,
  onEdit,
  onSendCNC,
  onSendPartner,
  onViewCustomer,
  totalCount
}: ProductTableProps) {
  return (
    <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            {isEditMode && (
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={products.length > 0 && selectedIds.length === products.length}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead className="font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                Sản phẩm
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 py-0 leading-none h-5">
                  {totalCount !== undefined ? totalCount : products.length}
                </Badge>
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-700 hidden md:table-cell">IMEI/Serial</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden sm:table-cell">Loại</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">Pin</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Tình trạng</TableHead>
            <TableHead className="font-semibold text-slate-700">Trạng thái</TableHead>

            <TableHead className="font-semibold text-slate-700 text-right">Giá bán</TableHead>
            {!isEditMode && <TableHead className="w-20"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors group">
              {isEditMode && (
                <TableCell className="text-center">
                  <Checkbox 
                    checked={selectedIds.includes(product.id)}
                    onCheckedChange={() => onSelect(product.id)}
                  />
                </TableCell>
              )}
              <TableCell className="py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900 leading-tight">{product.ten_san_pham}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">{product.mau_sac}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{product.dung_luong}</span>
                    {String(product.nguon || "").toLowerCase().includes("kho ngoài") ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] h-4 px-1 py-0 leading-none">Kho ngoài</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] h-4 px-1 py-0 leading-none">Kho trong</Badge>
                    )}
                  </div>
                  
                  {/* Additional info for Mobile */}
                  <div className="flex flex-col gap-1 mt-2 md:hidden">
                    {(product.imei || product.serial) && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-50 self-start px-1 rounded">
                        {product.imei || product.serial}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[10px] h-4 py-0 px-1 leading-none font-normal">
                        {getLoaiMayLabel(product.loai_may)}
                      </Badge>
                      {product.pin && (
                        <span className="text-[10px] text-slate-500">Pin: {product.pin}%</span>
                      )}
                    </div>
                    {product.tinh_trang && (
                      <p className="text-[11px] text-slate-600 italic bg-orange-50/50 p-1 rounded border border-orange-100/50">
                        {product.tinh_trang}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-col text-xs font-mono text-slate-600">
                  {product.imei ? (
                    <span>{product.imei}</span>
                  ) : product.serial ? null : (
                    <span>-</span>
                  )}
                  {product.serial && (
                    <span className={product.imei ? "text-slate-400" : "text-slate-600"}>
                      {product.serial}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100">
                  {getLoaiMayLabel(product.loai_may)}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-sm font-medium text-slate-700">{product.pin ? `${product.pin}%` : "-"}</span>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-slate-600">{product.tinh_trang || "-"}</span>
              </TableCell>
              <TableCell>
                <Badge className={`${getTrangThaiColor(product.trang_thai)} border-none text-[11px]`}>
                  {product.trang_thai}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-bold text-emerald-600">
                    {(product.gia_ban - (product.giam_gia || 0)).toLocaleString()}
                  </span>
                  {(product.giam_gia || 0) > 0 && (
                    <span className="text-[10px] text-slate-400 line-through">
                      {product.gia_ban.toLocaleString()}
                    </span>
                  )}
                  {isManager && product.gia_nhap > 0 && (
                    <span className="text-[9px] text-slate-300 mt-1">
                      Nhập: {product.gia_nhap.toLocaleString()}
                    </span>
                  )}
                </div>
              </TableCell>
              {!isEditMode && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Row-level edit removed as per user request */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-orange-500"
                      title="Gửi CNC"
                      onClick={() => onSendCNC?.(product)}
                    >
                      <Hammer className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-purple-600"
                      title="Giao đối tác"
                      onClick={() => onSendPartner?.(product)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    {onViewCustomer && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        onClick={() => onViewCustomer(product)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={isEditMode ? 9 : 8} className="h-32 text-center text-slate-500">

                Không tìm thấy sản phẩm nào phù hợp.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
