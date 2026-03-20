"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RotateCcw, ShoppingCart, User } from "lucide-react"
import { getTrangThaiColor } from "@/lib/utils/inventory-helpers"

interface PartnerProduct {
  id: string
  ten_san_pham: string
  imei: string
  mau_sac?: string
  dung_luong?: string
  tinh_trang: string
  loai_may: string
  trang_thai: string
  ghi_chu?: string
  ngay_nhap?: string
  gia_ban?: number
}

interface PartnerTableProps {
  products: PartnerProduct[]
  selectedIds: string[]
  onSelect: (id: string) => void
  onSelectAll: () => void
  isEditMode: boolean
  onReturnStock?: (product: PartnerProduct) => void
  onCompleteSale?: (product: PartnerProduct) => void
  totalCount?: number
  isReturning?: boolean
}

export function PartnerTable({
  products,
  selectedIds,
  onSelect,
  onSelectAll,
  isEditMode,
  onReturnStock,
  onCompleteSale,
  totalCount,
  isReturning
}: PartnerTableProps) {
  
  const extractPartnerInfo = (note: string = "") => {
    const match = note.match(/\[GiaoĐốiTác: (.*?)\]/)
    return match ? match[1] : "Chưa xác định"
  }

  return (
    <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            {isEditMode && (
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={products.length > 0 && products.every(p => selectedIds.includes(p.id))}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead className="font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                Sản phẩm
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 py-0 leading-none h-5">
                  {totalCount !== undefined ? totalCount : products.length}
                </Badge>
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-700">IMEI</TableHead>
            <TableHead className="font-semibold text-slate-700">Đối tác & Ngày giao</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">Tình trạng</TableHead>
            {(onReturnStock || onCompleteSale) && <TableHead className="w-32 text-right">Thao tác</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p, idx) => (
            <TableRow key={`${p.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
              {isEditMode && (
                <TableCell className="text-center">
                  <Checkbox 
                    checked={selectedIds.includes(p.id)}
                    onCheckedChange={() => onSelect(p.id)}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">{p.ten_san_pham}</span>
                  <span className="text-xs text-slate-500">{p.mau_sac} • {p.dung_luong}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm font-mono text-slate-600">{p.imei || "—"}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-purple-700">
                    <User className="w-3.5 h-3.5" />
                    {extractPartnerInfo(p.ghi_chu)}
                  </div>
                  {p.ghi_chu?.includes(" - ") && (
                    <span className="text-[10px] text-slate-500 ml-5">
                      {p.ghi_chu.split(" - ")[1].replace("]", "")}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-slate-600">
                <Badge variant="outline" className="text-[10px]">{p.tinh_trang || "—"}</Badge>
              </TableCell>
              {(onReturnStock || onCompleteSale) && (
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    {onReturnStock && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        title="Hoàn kho"
                        className="h-8 w-8 p-0 text-slate-600 hover:text-orange-600 hover:bg-orange-50 border-slate-200" 
                        onClick={() => onReturnStock(p)}
                        disabled={isReturning}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                    {onCompleteSale && (
                      <Button 
                        size="sm" 
                        title="Chốt bán (Thêm vào giỏ)"
                        className="h-8 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                        onClick={() => onCompleteSale(p)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1.5" />
                        Chốt
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="h-32 text-center text-slate-500">
                Không có sản phẩm nào đang giao đối tác.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
