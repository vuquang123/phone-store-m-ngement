"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Eye, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

interface ReturnOrder {
  id: string
  ma_don_hang: string
  khach_hang: string
  san_pham: string
  ly_do: string
  trang_thai: "cho_duyet" | "da_duyet" | "tu_choi"
  so_tien_hoan: number
  ngay_tao: string
  ghi_chu: string
}

export default function HoanTraPage() {
  const [returns, setReturns] = useState<ReturnOrder[]>([])
  const [filteredReturns, setFilteredReturns] = useState<ReturnOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true)
      try {
        const response = await fetch("/api/hoan-tra")
        const result = await response.json()
        const data = Array.isArray(result.data) ? result.data : []
        // Map dữ liệu từ sheet về interface ReturnOrder
  const mapped: ReturnOrder[] = data.map((item: any, idx: number) => ({
          id: item.id || item.ma_don_hang || String(idx),
          ma_don_hang: item.ma_don_hang || "",
          khach_hang: item.khach_hang || "",
          san_pham: item.san_pham || "",
          ly_do: item.ly_do || "",
          trang_thai: item.trang_thai || "cho_duyet",
          so_tien_hoan: Number(item.so_tien_hoan) || 0,
          ngay_tao: item.ngay_tao || "",
          ghi_chu: item.ghi_chu || ""
        }))
        setReturns(mapped)
        setFilteredReturns(mapped)
      } catch (error) {
        setReturns([])
        setFilteredReturns([])
        toast({ title: "Lỗi tải dữ liệu hoàn trả", description: String(error), variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchReturns()
  }, [])

  useEffect(() => {
    const filtered = returns.filter(
      (returnOrder) =>
        returnOrder.ma_don_hang.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnOrder.khach_hang.toLowerCase().includes(searchTerm.toLowerCase()) ||
        returnOrder.san_pham.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredReturns(filtered)
  }, [returns, searchTerm])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "cho_duyet":
        return <Badge variant="secondary">Chờ duyệt</Badge>
      case "da_duyet":
        return (
          <Badge variant="default" className="bg-green-500">
            Đã duyệt
          </Badge>
        )
      case "tu_choi":
        return <Badge variant="destructive">Từ chối</Badge>
      default:
        return <Badge variant="outline">Không xác định</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hoàn trả</h1>
          <p className="text-muted-foreground">Quản lý các yêu cầu hoàn trả từ khách hàng</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Tạo hoàn trả
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hoàn trả</CardTitle>
          <CardDescription>Tổng cộng {returns.length} yêu cầu hoàn trả</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo mã đơn hàng, khách hàng hoặc sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-4">
            {filteredReturns.map((returnOrder) => (
              <div
                key={returnOrder.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <RotateCcw className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">{returnOrder.ma_don_hang}</h3>
                      {getStatusBadge(returnOrder.trang_thai)}
                    </div>
                    <p className="text-sm text-muted-foreground">{returnOrder.khach_hang}</p>
                    <p className="text-sm text-muted-foreground">{returnOrder.san_pham}</p>
                    <p className="text-sm font-medium text-red-600">{formatCurrency(returnOrder.so_tien_hoan)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(returnOrder.ngay_tao), { addSuffix: true, locale: vi })}
                    </p>
                    <p className="text-sm text-muted-foreground">{returnOrder.ly_do}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredReturns.length === 0 && (
            <div className="text-center py-16 bg-white rounded-lg">
              <h3 className="text-lg font-medium mb-2">Sẽ được cập nhật trong thời gian sớm nhất</h3>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
