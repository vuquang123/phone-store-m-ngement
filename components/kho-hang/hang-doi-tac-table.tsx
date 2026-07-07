"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, ArrowRightLeft } from "lucide-react"
import { getLoaiMayLabel, getLoaiMayBadgeClass, getPinColorClass, getAppleColorHex, formatPinDisplay } from "@/lib/utils/inventory-helpers"

export interface HangDoiTacProduct {
  id: string
  ngay_nhap: string
  nguon_hang: string
  ten_san_pham: string
  loai_may: string
  dung_luong: string
  pin: string
  mau_sac: string
  imei: string
  tinh_trang: string
  gia_nhap: number
  gia_ban: number
  ghi_chu: string
}

interface HangDoiTacTableProps {
  products: HangDoiTacProduct[]
  isManager: boolean
  onDelete: (product: HangDoiTacProduct) => void
  onTransfer: (product: HangDoiTacProduct, khoDich: "Kho trong" | "Kho ngoài") => void
  isDeleting?: boolean
  isTransferring?: boolean
  totalCount?: number
}

export function HangDoiTacTable({
  products,
  isManager,
  onDelete,
  onTransfer,
  isDeleting,
  isTransferring,
  totalCount,
}: HangDoiTacTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<HangDoiTacProduct | null>(null)
  const [transferTarget, setTransferTarget] = useState<HangDoiTacProduct | null>(null)
  const [khoDich, setKhoDich] = useState<"Kho trong" | "Kho ngoài">("Kho trong")

  const confirmDelete = () => {
    if (deleteTarget) onDelete(deleteTarget)
    setDeleteTarget(null)
  }

  const confirmTransfer = () => {
    if (transferTarget) onTransfer(transferTarget, khoDich)
    setTransferTarget(null)
  }

  const ActionButtons = ({ product, size }: { product: HangDoiTacProduct; size: "mobile" | "desktop" }) => (
    <div className={size === "mobile" ? "flex shrink-0 gap-1" : "flex justify-end gap-1"}>
      <Button
        variant={size === "mobile" ? "outline" : "ghost"}
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
        title="Chuyển kho (sang Kho_hang)"
        onClick={() => { setKhoDich("Kho trong"); setTransferTarget(product) }}
        disabled={isTransferring}
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Button>
      {isManager && (
        <Button
          variant={size === "mobile" ? "outline" : "ghost"}
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-rose-600"
          title="Xóa máy (chỉ quản lý)"
          onClick={() => setDeleteTarget(product)}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {products.length === 0 ? (
          <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
            Chưa có máy đối tác nào.
          </div>
        ) : (
          products.map((product) => (
            <div key={`${product.id}-${product.imei}`} className="rounded-lg border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium leading-tight text-foreground">{product.ten_san_pham}</span>
                {isManager && (
                  <Badge variant="outline" className="shrink-0 border-purple-100 bg-purple-50 text-[11px] text-purple-600 dark:border-transparent dark:bg-purple-500/15 dark:text-purple-400">
                    {product.nguon_hang || "Đối tác"}
                  </Badge>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                    style={{ backgroundColor: getAppleColorHex(product.mau_sac) }}
                  />
                  {product.mau_sac}
                </span>
                {product.dung_luong && <span className="text-xs text-muted-foreground">• {product.dung_luong}</span>}
                <Badge variant="outline" className={`${getLoaiMayBadgeClass(product.loai_may)} h-4 px-1 py-0 text-[10px] leading-none`}>
                  {getLoaiMayLabel(product.loai_may)}
                </Badge>
                {product.pin && (
                  <span className="text-[11px] text-muted-foreground">
                    Pin: <span className={`font-semibold ${getPinColorClass(product.pin)}`}>{formatPinDisplay(product.pin)}</span>
                  </span>
                )}
              </div>

              {product.imei && (
                <div className="mt-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{product.imei}</span>
                </div>
              )}

              {product.tinh_trang && (
                <p className="mt-1.5 rounded border border-orange-100/50 bg-orange-50/50 p-1.5 text-[11px] italic text-muted-foreground dark:border-orange-500/20 dark:bg-orange-500/10">
                  {product.tinh_trang}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="leading-tight">
                  <span className="font-bold text-emerald-600">₫{(product.gia_ban || 0).toLocaleString()}</span>
                  {isManager && product.gia_nhap > 0 && (
                    <span className="ml-2 text-[10px] text-muted-foreground">Nhập: {product.gia_nhap.toLocaleString()}</span>
                  )}
                </div>
                <ActionButtons product={product} size="mobile" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden rounded-md border border-border bg-card shadow-sm md:block">
        <Table className="min-w-[640px]" containerClassName="max-h-[calc(100vh-360px)] min-h-[200px]">
          <TableHeader className="sticky top-0 z-20 bg-muted [&_tr]:border-b-0 shadow-[inset_0_-1px_0_hsl(var(--border))]">
            <TableRow className="hover:bg-muted">
              <TableHead className="font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  Sản phẩm
                  <Badge variant="secondary" className="h-5 bg-purple-100 py-0 leading-none text-purple-700 hover:bg-purple-100">
                    {totalCount !== undefined ? totalCount : products.length}
                  </Badge>
                </div>
              </TableHead>
              {isManager && <TableHead className="font-semibold text-foreground">Nguồn hàng</TableHead>}
              <TableHead className="hidden font-semibold text-foreground md:table-cell">IMEI</TableHead>
              <TableHead className="hidden font-semibold text-foreground sm:table-cell">Loại</TableHead>
              <TableHead className="hidden font-semibold text-foreground lg:table-cell">Pin</TableHead>
              <TableHead className="hidden font-semibold text-foreground md:table-cell">Tình trạng</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Giá bán</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={`${product.id}-${product.imei}`} className="group transition-colors hover:bg-accent/50">
                <TableCell className="py-3">
                  <div className="flex flex-col">
                    <span className="font-medium leading-tight text-foreground">{product.ten_san_pham}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                          style={{ backgroundColor: getAppleColorHex(product.mau_sac) }}
                        />
                        {product.mau_sac}
                      </span>
                      {product.dung_luong && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{product.dung_luong}</span>
                        </>
                      )}
                    </div>
                  </div>
                </TableCell>
                {isManager && (
                  <TableCell>
                    <Badge variant="outline" className="border-purple-100 bg-purple-50 text-[11px] text-purple-600 dark:border-transparent dark:bg-purple-500/15 dark:text-purple-400">
                      {product.nguon_hang || "-"}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="hidden md:table-cell">
                  <span className="font-mono text-xs text-muted-foreground">{product.imei || "-"}</span>
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
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-emerald-600">{(product.gia_ban || 0).toLocaleString()}</span>
                    {isManager && product.gia_nhap > 0 && (
                      <span className="mt-1 text-[9px] text-slate-400">Nhập: {product.gia_nhap.toLocaleString()}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    <ActionButtons product={product} size="desktop" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={isManager ? 8 : 7} className="h-32 text-center text-muted-foreground">
                  Chưa có máy đối tác nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Xác nhận xóa (chỉ quản lý) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa máy đối tác?</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa vĩnh viễn <b>{deleteTarget?.ten_san_pham}</b>
              {deleteTarget?.imei ? ` (IMEI: ${deleteTarget.imei})` : ""} khỏi sheet Hang_doi_tac.
              Thông tin sẽ không được lưu lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={confirmDelete}>
              Xóa máy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chuyển kho: chọn Kho trong / Kho ngoài */}
      <Dialog open={!!transferTarget} onOpenChange={(open) => { if (!open) setTransferTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Chuyển kho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              
              Chuyển <b className="text-foreground">{transferTarget?.ten_san_pham}</b>
              {transferTarget?.imei ? ` (IMEI: ${transferTarget.imei})` : ""} từ Hàng đối tác sang Kho hàng.
            </p>
            <Select value={khoDich} onValueChange={(v) => setKhoDich(v as "Kho trong" | "Kho ngoài")}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn kho đích" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="Kho trong">Kho trong</SelectItem>
                <SelectItem value="Kho ngoài">Kho ngoài</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTransferTarget(null)}>Hủy</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmTransfer} disabled={isTransferring}>
              {isTransferring ? "Đang chuyển..." : "Chuyển kho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
