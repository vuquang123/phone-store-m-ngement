"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { getTrangThaiColor } from "@/lib/utils/inventory-helpers"

interface CNCProduct {
  id: string
  ten_san_pham: string
  imei: string
  mau_sac?: string
  nguon: string
  tinh_trang: string
  loai_may: string
  trang_thai: string
  dia_chi_cnc: string
  ngay_gui: string
  ngay_nhan_lai: string
  ten_khach_hang?: string
  so_dien_thoai?: string
}

interface CNCTableProps {
  products: CNCProduct[]
  selectedImeis: string[]
  onSelect: (imei: string) => void
  onSelectAll: () => void
  isEditMode: boolean
  onComplete?: (product: CNCProduct) => void
  onCustomerReceived?: (imei: string) => void
  totalCount?: number
}

export function CNCTable({
  products,
  selectedImeis,
  onSelect,
  onSelectAll,
  isEditMode,
  onComplete,
  onCustomerReceived,
  totalCount
}: CNCTableProps) {
  const getItemKey = (p: CNCProduct, idx: number) => p.imei || p.id || `unknown-${idx}`;

  return (
    <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            {isEditMode && (
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={products.length > 0 && products.every((p, idx) => selectedImeis.includes(getItemKey(p, idx)))}
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
            <TableHead className="font-semibold text-slate-700">IMEI</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Địa chỉ CNC</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">Tình trạng</TableHead>
            <TableHead className="font-semibold text-slate-700">Trạng thái</TableHead>
            <TableHead className="hidden xl:table-cell font-semibold text-slate-700">Ngày gửi</TableHead>
            {(onComplete || onCustomerReceived) && <TableHead className="w-24"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p, idx) => (
            <TableRow key={`${p.imei}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
              {isEditMode && (
                <TableCell className="text-center">
                  <Checkbox 
                    checked={selectedImeis.includes(getItemKey(p, idx))}
                    onCheckedChange={() => onSelect(getItemKey(p, idx))}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">{p.ten_san_pham}</span>
                  <span className="text-xs text-slate-500">{p.mau_sac} • {p.loai_may}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm font-mono text-slate-600">{p.imei}</TableCell>
              <TableCell className="hidden md:table-cell text-sm text-slate-600 font-medium text-blue-600">{p.dia_chi_cnc}</TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-slate-600">{p.tinh_trang}</TableCell>
              <TableCell>
                <Badge className={`${getTrangThaiColor(p.trang_thai)} border-none text-[11px]`}>
                  {p.trang_thai}
                </Badge>
              </TableCell>
              <TableCell className="hidden xl:table-cell text-sm text-slate-500">{p.ngay_gui}</TableCell>
              {(onComplete || onCustomerReceived) && (
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    {onComplete && p.trang_thai !== "Hoàn thành CNC" && (
                      <Button size="sm" className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={() => onComplete(p)}>
                        Xong
                      </Button>
                    )}
                    {onCustomerReceived && p.trang_thai === "Hoàn thành CNC" && p.nguon === "Khách ngoài" && (
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => onCustomerReceived(p.imei)}>
                        Khách nhận
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
                Không có sản phẩm nào đang CNC.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
