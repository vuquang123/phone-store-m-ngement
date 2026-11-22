"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Phone, RotateCcw, ShoppingCart, User } from "lucide-react"
import { parsePartnerInfo } from "@/lib/utils/inventory-helpers"

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
  

  return (
    <div className="rounded-md border border-border overflow-x-auto bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/80">
          <TableRow>
            {isEditMode && (
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={products.length > 0 && products.every(p => selectedIds.includes(p.id))}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead className="font-semibold text-foreground">
              <div className="flex items-center gap-2">
                Sản phẩm
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 py-0 leading-none h-5">
                  {totalCount !== undefined ? totalCount : products.length}
                </Badge>
              </div>
            </TableHead>
            <TableHead className="font-semibold text-foreground hidden sm:table-cell">IMEI</TableHead>
            <TableHead className="font-semibold text-foreground">Đối tác & Ngày gửi</TableHead>
            <TableHead className="font-semibold text-foreground hidden xl:table-cell">Tình trạng</TableHead>
            {(onReturnStock || onCompleteSale) && <TableHead className="whitespace-nowrap text-right">Thao tác</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p, idx) => (
            <TableRow key={`${p.id}-${idx}`} className="hover:bg-accent/50 transition-colors">
              {isEditMode && (
                <TableCell className="text-center">
                  <Checkbox 
                    checked={selectedIds.includes(p.id)}
                    onCheckedChange={() => onSelect(p.id)}
                  />
                </TableCell>
              )}
              <TableCell className="py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground leading-tight">{p.ten_san_pham}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{p.mau_sac} • {p.dung_luong}</span>
                  
                  {/* Additional info for Mobile */}
                  <div className="flex flex-col gap-1 mt-1.5 sm:hidden">
                    {p.imei && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted self-start px-1 rounded">
                        {p.imei}
                      </span>
                    )}
                    {p.tinh_trang && (
                      <p className="text-[10px] text-muted-foreground italic bg-purple-50/30 p-1 rounded border border-purple-100/50">
                        {p.tinh_trang}
                      </p>
                    )}
                  </div>
                  
                  {/* Condition for tablets (where lg is still hidden) */}
                  <div className="hidden sm:block xl:hidden mt-1">
                    {p.tinh_trang && (
                      <p className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
                        {p.tinh_trang}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm font-mono text-muted-foreground hidden sm:table-cell">{p.imei || "—"}</TableCell>
              <TableCell>
                {(() => {
                  const info = parsePartnerInfo(p.ghi_chu)
                  return (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-purple-700 dark:text-purple-400">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {info?.name || "Chưa rõ đối tác"}
                      </div>
                      {info?.phone ? (
                        <a
                          href={`tel:${info.phone}`}
                          className="ml-5 inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" />
                          {info.phone}
                        </a>
                      ) : null}
                      {info?.date ? <span className="ml-5 text-[11px] text-muted-foreground">Gửi ngày {info.date}</span> : null}
                    </div>
                  )
                })()}
              </TableCell>
              <TableCell className="hidden xl:table-cell max-w-[220px] text-xs text-muted-foreground">
                <span className="line-clamp-2" title={p.tinh_trang}>{p.tinh_trang || "—"}</span>
              </TableCell>
              {(onReturnStock || onCompleteSale) && (
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    {onReturnStock && (
                      <Button
                        size="sm"
                        variant="outline"
                        title="Đối tác không lấy: hoàn máy về kho"
                        className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/10"
                        onClick={() => onReturnStock(p)}
                        disabled={isReturning}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden md:inline">Hoàn kho</span>
                      </Button>
                    )}
                    {onCompleteSale && (
                      <Button 
                        size="sm" 
                        title="Xuất bán: thêm vào giỏ, điền sẵn đối tác làm khách hàng"
                        className="h-8 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                        onClick={() => onCompleteSale(p)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1.5" />
                        Xuất bán
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                Chưa có máy nào đang gửi đối tác.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
