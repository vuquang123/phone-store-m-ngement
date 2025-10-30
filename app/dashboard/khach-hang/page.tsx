"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"
import { Search, Edit } from "lucide-react"
import { useState, useEffect } from "react"
import { Eye } from "lucide-react"
import CustomerPurchasesDialog from "@/components/khach-hang/CustomerPurchasesDialog"
import { useIsMobile } from "@/hooks/use-mobile"

interface Customer {
  id: string
  ho_ten: string
  so_dien_thoai: string
  tong_mua?: string
  lan_mua_cuoi?: string
  ghi_chu?: string
  ngay_tao: string
}

export default function KhachHangPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer|null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogPhone, setDialogPhone] = useState<string>("")
  const [page, setPage] = useState(1)
  const pageSize = 10
  const isMobile = useIsMobile()

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/khach-hang${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      if (!response.ok) throw new Error("Failed to fetch customers");
      const data = await response.json();
      const mapped = Array.isArray(data)
            ? data.map((item) => ({
                id: item.sdt,
                ho_ten: item.ten_khach,
                so_dien_thoai: item.sdt,
                tong_mua: item.tong_mua || item["Tổng Mua"] || "",
                lan_mua_cuoi: item.lan_mua_cuoi || item["Lần Mua Cuối"] || "",
                ghi_chu: item.ghi_chu || "",
                ngay_tao: item.created_at || item["created_at"] || item["Ngày tạo"] || ""
              }))
        : [];
      setCustomers(mapped);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [search])

  // Pagination logic
  const totalPages = Math.ceil(customers.length / pageSize)
  const pagedCustomers = customers.slice((page - 1) * pageSize, page * pageSize)

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Danh sách khách hàng</h2>
            <p className="text-muted-foreground">Quản lý thông tin khách hàng của cửa hàng</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Khách hàng</CardTitle>
            <CardDescription>Tìm kiếm và xem thông tin khách hàng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm theo tên, số điện thoại..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-8"
                    inputMode="search"
                    enterKeyHint="search"
                  />
                </div>
              </div>
            </div>

            {/* Mobile card list */}
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
            ) : customers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Không có khách hàng nào</div>
            ) : (
              <>
                <div className="md:hidden grid grid-cols-1 gap-3">
                  {pagedCustomers.map((customer) => {
                    const created = customer.ngay_tao
                      ? (() => { const d = new Date(customer.ngay_tao); return isNaN(d.getTime()) ? customer.ngay_tao : d.toLocaleDateString('vi-VN') })()
                      : ''
                    return (
                      <div key={customer.so_dien_thoai} className="border rounded-xl p-3 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900 leading-tight">{customer.ho_ten || 'Khách lẻ'}</div>
                            <div className="text-sm text-slate-600">{customer.so_dien_thoai}</div>
                          </div>
                          <div className="text-right text-xs text-slate-500 min-w-[88px]">{created}</div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-slate-500">Tổng mua</div>
                            <div className="font-medium text-slate-800">{customer.tong_mua || '—'}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Lần mua cuối</div>
                            <div className="font-medium text-slate-800 break-words">{customer.lan_mua_cuoi || '—'}</div>
                          </div>
                        </div>
                        {customer.ghi_chu ? (
                          <div className="mt-2 text-xs text-slate-600 line-clamp-2">{customer.ghi_chu}</div>
                        ) : null}
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            className="p-1 rounded hover:bg-slate-100"
                            onClick={() => { setDialogPhone(customer.so_dien_thoai); setDialogOpen(true) }}
                            aria-label={`Xem chi tiết mua hàng ${customer.so_dien_thoai}`}
                          >
                            <Eye className="h-4 w-4 text-slate-700" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ngày tạo</TableHead>
                        <TableHead>Tên Khách Hàng</TableHead>
                        <TableHead>Số Điện Thoại</TableHead>
                        <TableHead>Tổng Mua</TableHead>
                        <TableHead>Lần Mua Cuối</TableHead>
                        <TableHead>Ghi Chú</TableHead>
                        <TableHead>Chi tiết</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedCustomers.map((customer) => (
                        <TableRow key={customer.so_dien_thoai}>
                          <TableCell>
                            {customer.ngay_tao ? (() => { const d = new Date(customer.ngay_tao); return isNaN(d.getTime()) ? customer.ngay_tao : d.toLocaleDateString("vi-VN"); })() : ""}
                          </TableCell>
                          <TableCell className="font-medium">{customer.ho_ten}</TableCell>
                          <TableCell>{customer.so_dien_thoai}</TableCell>
                          <TableCell>{customer.tong_mua || ""}</TableCell>
                          <TableCell>{customer.lan_mua_cuoi || ""}</TableCell>
                          <TableCell>{customer.ghi_chu || ""}</TableCell>
                          <TableCell>
                            <button
                              className="p-1 rounded hover:bg-slate-100"
                              onClick={() => { setDialogPhone(customer.so_dien_thoai); setDialogOpen(true) }}
                              aria-label={`Xem chi tiết mua hàng ${customer.so_dien_thoai}`}
                            >
                              <Eye className="h-4 w-4 text-slate-700" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Single pagination bar at bottom for all views */}
                {totalPages > 1 && (
                  <Pagination className="mt-4">
                    <PaginationContent>
                      {/* Remove Previous button */}
                      {/* Compact pagination logic: show first, last, current, neighbors, ellipsis */}
                      {(() => {
                        const items = [];
                        const maxPages = 7;
                        if (totalPages <= maxPages) {
                          for (let i = 1; i <= totalPages; i++) {
                            items.push(
                              <PaginationItem key={i}>
                                <PaginationLink
                                  href="#"
                                  isActive={page === i}
                                  onClick={e => { e.preventDefault(); setPage(i); }}
                                >{i}</PaginationLink>
                              </PaginationItem>
                            );
                          }
                        } else {
                          // Always show first page
                          items.push(
                            <PaginationItem key={1}>
                              <PaginationLink
                                href="#"
                                isActive={page === 1}
                                onClick={e => { e.preventDefault(); setPage(1); }}
                              >1</PaginationLink>
                            </PaginationItem>
                          );
                          // Show left ellipsis if needed
                          if (page > 4) {
                            items.push(
                              <PaginationItem key="left-ellipsis">
                                <span className="px-2">...</span>
                              </PaginationItem>
                            );
                          }
                          // Show up to 3 pages before/after current
                          for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) {
                            items.push(
                              <PaginationItem key={i}>
                                <PaginationLink
                                  href="#"
                                  isActive={page === i}
                                  onClick={e => { e.preventDefault(); setPage(i); }}
                                >{i}</PaginationLink>
                              </PaginationItem>
                            );
                          }
                          // Show right ellipsis if needed
                          if (page < totalPages - 3) {
                            items.push(
                              <PaginationItem key="right-ellipsis">
                                <span className="px-2">...</span>
                              </PaginationItem>
                            );
                          }
                          // Always show last page
                          items.push(
                            <PaginationItem key={totalPages}>
                              <PaginationLink
                                href="#"
                                isActive={page === totalPages}
                                onClick={e => { e.preventDefault(); setPage(totalPages); }}
                              >{totalPages}</PaginationLink>
                            </PaginationItem>
                          );
                        }
                        return items;
                      })()}
                      {/* Remove Next button */}
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <CustomerPurchasesDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} phone={dialogPhone} />
    </ProtectedRoute>
  )
}
