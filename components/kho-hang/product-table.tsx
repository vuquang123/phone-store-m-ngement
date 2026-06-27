"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit2, Eye, Hammer, UserPlus } from "lucide-react"
import { getTrangThaiColor, getTrangThaiKhoColor, getLoaiMayLabel, getLoaiMayBadgeClass, getPinColorClass, getAppleColorHex, formatPinDisplay } from "@/lib/utils/inventory-helpers"
import { cn } from "@/lib/utils"

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
  loai_may?: string
  nguon?: string
  do_sim?: string
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
    <>
      {/* Mobile (< md): danh sách card — hiện đủ thông tin, KHÔNG scroll ngang */}
      <div className="space-y-3 md:hidden">
        {products.length === 0 ? (
          <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
            Không tìm thấy sản phẩm nào phù hợp.
          </div>
        ) : (
          products.map((product) => {
            const giaSau = product.gia_ban - (product.giam_gia || 0)
            const isPartner = String(product.nguon || "").toLowerCase().includes("kho ngoài")
            return (
              <div
                key={product.id}
                className={cn(
                  "rounded-lg border bg-card p-3 shadow-sm",
                  isEditMode && selectedIds.includes(product.id) && "border-primary ring-1 ring-primary/40",
                )}
              >
                <div className="flex items-start gap-3">
                  {isEditMode && (
                    <Checkbox
                      className="mt-1 shrink-0"
                      checked={selectedIds.includes(product.id)}
                      onCheckedChange={() => onSelect(product.id)}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-tight text-foreground">{product.ten_san_pham}</span>
                      <Badge className={`${getTrangThaiColor(product.trang_thai)} shrink-0 border-none text-[11px]`}>
                        {product.trang_thai}
                      </Badge>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                          style={{ backgroundColor: getAppleColorHex(product.mau_sac) }}
                        />
                        {product.mau_sac}
                      </span>
                      <span className="text-xs text-muted-foreground">• {product.dung_luong}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 px-1 py-0 text-[10px] leading-none",
                          isPartner
                            ? "border-blue-100 bg-blue-50 text-blue-600 dark:border-transparent dark:bg-blue-500/15 dark:text-blue-400"
                            : "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-transparent dark:bg-emerald-500/15 dark:text-emerald-400",
                        )}
                      >
                        {isPartner ? "Kho ngoài" : "Kho trong"}
                      </Badge>
                      {product.do_sim && (
                        <Badge variant="outline" className="h-4 max-w-[120px] truncate px-1 py-0 text-[10px] leading-none" title={product.do_sim}>
                          {product.do_sim}
                        </Badge>
                      )}
                    </div>

                    {(product.imei || product.serial) && (
                      <div className="mt-1.5">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {product.imei || product.serial}
                        </span>
                      </div>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`${getLoaiMayBadgeClass(product.loai_may)} h-5 px-1.5 py-0 text-[11px] font-medium`}>
                        {getLoaiMayLabel(product.loai_may)}
                      </Badge>
                      {product.pin && (
                        <span className="text-xs text-muted-foreground">
                          Pin: <span className={`font-semibold ${getPinColorClass(product.pin)}`}>{formatPinDisplay(product.pin)}</span>
                        </span>
                      )}
                    </div>

                    {product.tinh_trang && (
                      <p className="mt-1.5 rounded border border-orange-100/50 bg-orange-50/50 p-1.5 text-[11px] italic text-muted-foreground dark:border-orange-500/20 dark:bg-orange-500/10">
                        {product.tinh_trang}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="leading-tight">
                        <span className="font-bold text-emerald-600">₫{giaSau.toLocaleString()}</span>
                        {(product.giam_gia || 0) > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground line-through">{product.gia_ban.toLocaleString()}</span>
                        )}
                        {isManager && product.gia_nhap > 0 && (
                          <span className="ml-2 text-[10px] text-muted-foreground">Nhập: {product.gia_nhap.toLocaleString()}</span>
                        )}
                      </div>
                      {!isEditMode && (
                        <div className="flex shrink-0 gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-orange-500" title="Gửi CNC" onClick={() => onSendCNC?.(product)}>
                            <Hammer className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-purple-600" title="Giao đối tác" onClick={() => onSendPartner?.(product)}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          {onViewCustomer && (
                            <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => onViewCustomer(product)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop (>= md): bảng như cũ */}
      <div className="hidden overflow-x-auto rounded-md border border-border bg-card shadow-sm md:block">
      <Table className="min-w-[560px]">
        <TableHeader className="bg-muted/80">
          <TableRow>
            {isEditMode && (
              <TableHead className="w-12 text-center">
                <Checkbox 
                  checked={products.length > 0 && selectedIds.length === products.length}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead className="font-semibold text-foreground">
              <div className="flex items-center gap-2">
                Sản phẩm
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 py-0 leading-none h-5">
                  {totalCount !== undefined ? totalCount : products.length}
                </Badge>
              </div>
            </TableHead>
            <TableHead className="font-semibold text-foreground hidden md:table-cell">IMEI/Serial</TableHead>
            <TableHead className="font-semibold text-foreground hidden sm:table-cell">Loại</TableHead>
            <TableHead className="font-semibold text-foreground hidden lg:table-cell">Pin</TableHead>
            <TableHead className="font-semibold text-foreground hidden md:table-cell">Tình trạng</TableHead>
            <TableHead className="font-semibold text-foreground">Trạng thái</TableHead>

            <TableHead className="font-semibold text-foreground text-right">Giá bán</TableHead>
            {!isEditMode && <TableHead className="w-20"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className="hover:bg-accent/50 transition-colors group">
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
                  <span className="font-medium text-foreground leading-tight">{product.ten_san_pham}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20 shrink-0"
                        style={{ backgroundColor: getAppleColorHex(product.mau_sac) }}
                      />
                      {product.mau_sac}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{product.dung_luong}</span>
                    {String(product.nguon || "").toLowerCase().includes("kho ngoài") ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:border-transparent text-[10px] h-4 px-1 py-0 leading-none">Kho ngoài</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-transparent text-[10px] h-4 px-1 py-0 leading-none">Kho trong</Badge>
                    )}
                    {product.do_sim && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/15 dark:text-orange-400 dark:border-transparent text-[10px] h-4 px-1 py-0 leading-none truncate max-w-[80px]" title={product.do_sim}>
                        {product.do_sim}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Additional info for Mobile */}
                  <div className="flex flex-col gap-1 mt-2 md:hidden">
                    {(product.imei || product.serial) && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted self-start px-1 rounded">
                        {product.imei || product.serial}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${getLoaiMayBadgeClass(product.loai_may)} text-[10px] h-4 py-0 px-1 leading-none font-medium`}>
                        {getLoaiMayLabel(product.loai_may)}
                      </Badge>
                      {product.pin && (
                        <span className="text-[10px] text-muted-foreground">
                          Pin: <span className={`font-semibold ${getPinColorClass(product.pin)}`}>{formatPinDisplay(product.pin)}</span>
                        </span>
                      )}
                    </div>
                    {product.tinh_trang && (
                      <p className="text-[11px] text-muted-foreground italic bg-orange-50/50 dark:bg-orange-500/10 p-1 rounded border border-orange-100/50 dark:border-orange-500/20">
                        {product.tinh_trang}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-col text-xs font-mono text-muted-foreground">
                  {product.imei ? (
                    <span>{product.imei}</span>
                  ) : product.serial ? null : (
                    <span>-</span>
                  )}
                  {product.serial && (
                    <span className={product.imei ? "text-muted-foreground" : "text-muted-foreground"}>
                      {product.serial}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline" className={`${getLoaiMayBadgeClass(product.loai_may)} font-medium`}>
                  {getLoaiMayLabel(product.loai_may)}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className={`text-sm font-semibold ${product.pin ? getPinColorClass(product.pin) : "text-muted-foreground"}`}>
                  {formatPinDisplay(product.pin)}
                </span>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-muted-foreground">{product.tinh_trang || "-"}</span>
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
                    <span className="text-[10px] text-muted-foreground line-through">
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
                      className="h-8 w-8 text-muted-foreground hover:text-orange-500"
                      title="Gửi CNC"
                      onClick={() => onSendCNC?.(product)}
                    >
                      <Hammer className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-purple-600"
                      title="Giao đối tác"
                      onClick={() => onSendPartner?.(product)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    {onViewCustomer && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-blue-600"
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
              <TableCell colSpan={isEditMode ? 9 : 8} className="h-32 text-center text-muted-foreground">

                Không tìm thấy sản phẩm nào phù hợp.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </>
  )
}
