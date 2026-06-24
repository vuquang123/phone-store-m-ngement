"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit2 } from "lucide-react"

interface Accessory {
  id: string
  ten_phu_kien: string
  loai_phu_kien: string
  so_luong_ton: number | string
  gia_nhap: number | string
  gia_ban: number | string
  ghi_chu?: string
  updated_at?: string
}

interface AccessoryTableProps {
  items: Accessory[]
  isManager: boolean
  onEdit: (item: Accessory) => void
  totalCount?: number
}

export function AccessoryTable({
  items,
  isManager,
  onEdit,
  totalCount
}: AccessoryTableProps) {
  const parseNum = (val: any) => {
    if (typeof val === "number") return val
    if (!val) return 0
    return parseInt(String(val).replace(/\./g, "").replace(/,/g, "")) || 0
  }

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/80">
          <TableRow>
            <TableHead className="font-semibold text-foreground">
              <div className="flex items-center gap-2">
                Tên phụ kiện
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 py-0 leading-none h-5">
                  {totalCount !== undefined ? totalCount : items.length}
                </Badge>
              </div>
            </TableHead>
            <TableHead className="font-semibold text-foreground hidden sm:table-cell">Loại</TableHead>
            <TableHead className="font-semibold text-foreground text-center">Số lượng</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Giá bán</TableHead>
            <TableHead className="font-semibold text-foreground hidden md:table-cell">Ghi chú</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.id || idx} className="hover:bg-accent/50 transition-colors group">
              <TableCell className="py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground leading-tight">{item.ten_phu_kien || "(Không tên)"}</span>
                  {item.updated_at && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">Cập nhật: {item.updated_at}</span>
                  )}
                  
                  {/* Additional info for Mobile */}
                  <div className="flex flex-col gap-1 mt-1.5 sm:hidden">
                    <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] h-4 py-0 px-1 self-start leading-none font-normal">
                      {item.loai_phu_kien || "Khác"}
                    </Badge>
                    {item.ghi_chu && (
                      <p className="text-[10px] text-muted-foreground italic bg-muted p-1 rounded border border-slate-100">
                        {item.ghi_chu}
                      </p>
                    )}
                  </div>
                  
                  {/* Note for Medium screens where the column is still hidden */}
                  <div className="hidden sm:block md:hidden mt-1">
                    {item.ghi_chu && (
                      <p className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">
                        {item.ghi_chu}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-accent">
                  {item.loai_phu_kien || "Khác"}
                </Badge>
              </TableCell>
              <TableCell className="text-center font-medium">
                {item.so_luong_ton || 0}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="font-bold text-emerald-600">
                    {parseNum(item.gia_ban).toLocaleString()}
                  </span>
                  {isManager && parseNum(item.gia_nhap) > 0 && (
                    <span className="text-[10px] text-muted-foreground line-through">
                      {parseNum(item.gia_nhap).toLocaleString()}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                {item.ghi_chu || "-"}
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onEdit(item)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                Không tìm thấy phụ kiện nào.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
