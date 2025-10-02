"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Edit, Eye } from "lucide-react"
import { useState, useEffect } from "react"

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
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead>Tên Khách Hàng</TableHead>
                    <TableHead>Số Điện Thoại</TableHead>
                    <TableHead>Tổng Mua</TableHead>
                    <TableHead>Lần Mua Cuối</TableHead>
                    <TableHead>Ghi Chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Đang tải...
                      </TableCell>
                    </TableRow>
                  ) : customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Không có khách hàng nào
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((customer) => (
                      <TableRow key={customer.so_dien_thoai}>
                        <TableCell>
                          {customer.ngay_tao ? (() => { const d = new Date(customer.ngay_tao); return isNaN(d.getTime()) ? customer.ngay_tao : d.toLocaleDateString("vi-VN"); })() : ""}
                        </TableCell>
                        <TableCell className="font-medium">{customer.ho_ten}</TableCell>
                        <TableCell>{customer.so_dien_thoai}</TableCell>
                        <TableCell>{customer.tong_mua || ""}</TableCell>
                        <TableCell>{customer.lan_mua_cuoi || ""}</TableCell>
                        <TableCell>{customer.ghi_chu || ""}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
