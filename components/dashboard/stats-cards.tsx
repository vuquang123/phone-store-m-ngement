"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ShoppingCart, Package, Users } from "lucide-react"

interface StatsCardsProps {
  stats: {
    revenue: { monthly: number; today: number }
    profit?: { monthly: number; today: number }
    margin?: { monthly: number; today: number }
    orders: { monthly: number; today: number }
    products: { total: number; lowStock: number }
    customers: { total: number; new: number }
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Hàm hiển thị số có dấu + nếu > 0, và định dạng tiền tệ nếu là số tiền
  const showPlusCurrency = (value: number) => value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value)

  return (
    <Card className="w-full hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Tổng hợp hôm nay</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row items-stretch justify-center text-center">
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2 justify-center">Doanh thu <span className="p-1 rounded bg-emerald-100"><DollarSign className="h-4 w-4 text-emerald-600" /></span></span>
            <span className="text-2xl font-bold text-emerald-700 mt-2">{showPlusCurrency(stats.revenue.today)}</span>
          </div>
          <div className="border-l border-gray-200 mx-2"></div>
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2 justify-center">Lợi nhuận <span className="p-1 rounded bg-orange-100"><DollarSign className="h-4 w-4 text-orange-600" /></span></span>
            <span className="text-2xl font-bold text-orange-700 mt-2">{showPlusCurrency(stats.profit?.today ?? 0)}</span>
          </div>
          <div className="border-l border-gray-200 mx-2"></div>
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2 justify-center">Đơn hàng <span className="p-1 rounded bg-blue-100"><ShoppingCart className="h-4 w-4 text-blue-600" /></span></span>
            <span className="text-2xl font-bold text-blue-700 mt-2">{stats.orders.today > 0 ? `+${stats.orders.today}` : stats.orders.today}</span>
          </div>
          <div className="border-l border-gray-200 mx-2"></div>
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2 justify-center">Khách hàng <span className="p-1 rounded bg-purple-100"><Users className="h-4 w-4 text-purple-600" /></span></span>
            <span className="text-2xl font-bold text-purple-700 mt-2">{(stats.customers.new ?? 0) > 0 ? `+${stats.customers.new ?? 0}` : stats.customers.new ?? 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
