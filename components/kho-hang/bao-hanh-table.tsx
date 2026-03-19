"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye } from "lucide-react"
import { getTrangThaiColor } from "@/lib/utils/inventory-helpers"

interface BaoHanhProduct {
  "Tên Sản Phẩm": string
  "IMEI": string
  "Loại Máy": string
  "Màu Sắc"?: string
  "Nguồn": string
  "Tình trạng": string
  "Lỗi": string
  "Trạng Thái": string
  "Ngày gửi": string
  "Ngày nhận lại": string
  "Địa chỉ Bảo hành": string
  "Tên khách hàng": string
  "Số điện thoại": string
}

interface BaoHanhTableProps {
  products: any[]
  selectedIds: string[]
  onSelect: (id: string) => void
  onSelectAll: () => void
  isEditMode: boolean
  onViewInfo: (product: any, rect: DOMRect) => void
}

export function BaoHanhTable({
  products,
  selectedIds,
  onSelect,
  onSelectAll,
  isEditMode,
  onViewInfo
}: BaoHanhTableProps) {
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
                  {products.length}
                </Badge>
              </div>
            </TableHead>
            <TableHead className="font-semibold text-slate-700">IMEI</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Lỗi</TableHead>
            <TableHead className="font-semibold text-slate-700">Trạng thái</TableHead>
            <TableHead className="font-semibold text-slate-700 hidden lg:table-cell">Ngày gửi</TableHead>
            <TableHead className="font-semibold text-slate-700 text-center">Info</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p, idx) => {
            const id = `${p["IMEI"] || p.imei || "bh"}-${idx}`
            return (
              <TableRow key={id} className="hover:bg-slate-50/50 transition-colors">
                {isEditMode && (
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={selectedIds.includes(id)}
                      onCheckedChange={() => onSelect(id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{p["Tên Sản Phẩm"] || p.ten_san_pham}</span>
                    <span className="text-xs text-slate-500">{p["Màu Sắc"] || p.mau_sac} • {p["Loại Máy"] || p.loai_may}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono text-slate-600">{p["IMEI"] || p.imei}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-red-600 truncate max-w-[200px]">{p["Lỗi"] || p.loi}</TableCell>
                <TableCell>
                  <Badge className={`${getTrangThaiColor(p["Trạng Thái"] || p.trang_thai)} border-none text-[11px]`}>
                    {p["Trạng Thái"] || p.trang_thai}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-slate-500">{p["Ngày gửi"] || p.ngay_gui}</TableCell>
                <TableCell className="text-center">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                    onClick={(e) => onViewInfo(p, e.currentTarget.getBoundingClientRect())}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="h-32 text-center text-slate-500">
                Không có sản phẩm nào đang bảo hành.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
