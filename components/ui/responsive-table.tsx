// components/ui/responsive-table.tsx
"use client"

import * as React from "react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface ResponsiveColumn<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string // class áp cho cả <th> và <td>
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  /** Render 1 dòng dạng Card cho mobile (< md). */
  renderCard: (row: T) => React.ReactNode
  /** min-width cho bảng desktop để không vỡ cột (vd "min-w-[760px]"). */
  minWidth?: string
  emptyText?: React.ReactNode
}

/**
 * Bảng responsive: dưới md hiển thị danh sách Card, từ md hiển thị <Table> như cũ.
 * Desktop giữ nguyên diện mạo; chỉ mobile chuyển sang card.
 */
export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  renderCard,
  minWidth = "min-w-[640px]",
  emptyText = "Không có dữ liệu",
}: ResponsiveTableProps<T>) {
  if (!data || data.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
  }

  return (
    <>
      {/* Mobile: danh sách Card */}
      <div className="space-y-3 md:hidden">
        {data.map((row, i) => (
          <React.Fragment key={rowKey(row, i)}>{renderCard(row)}</React.Fragment>
        ))}
      </div>

      {/* Desktop: bảng (cuộn ngang nếu chật) */}
      <div className="hidden overflow-x-auto md:block">
        <Table className={minWidth}>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={rowKey(row, i)}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

/** Một dòng "Nhãn: giá trị" tiện dùng trong renderCard. */
export function CardField({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  )
}
