"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ShoppingCart, Users } from "lucide-react"

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
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 text-center">
          {/* Doanh thu */}
          <div className="min-w-0 px-2 py-3 sm:py-4 flex flex-col items-center justify-center">
            <span className="min-w-0 break-words text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5 leading-tight">
              <span className="shrink-0">Doanh thu</span>
              <span className="shrink-0 p-1 rounded bg-emerald-100">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </span>
            </span>
            <span className="text-lg sm:text-2xl font-bold text-emerald-700 mt-1.5 sm:mt-2">{showPlusCurrency(stats.revenue.today)}</span>
          </div>
          {/* Lợi nhuận */}
          <div className="min-w-0 px-2 py-3 sm:py-4 flex flex-col items-center justify-center">
            <span className="min-w-0 break-words text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5 leading-tight">
              <span className="shrink-0">Lợi nhuận</span>
              <span className="shrink-0 p-1 rounded bg-orange-100">
                <DollarSign className="h-4 w-4 text-orange-600" />
              </span>
            </span>
            <span className="text-lg sm:text-2xl font-bold text-orange-700 mt-1.5 sm:mt-2">{showPlusCurrency(stats.profit?.today ?? 0)}</span>
          </div>
          {/* Đơn hàng */}
          <div className="min-w-0 px-2 py-3 sm:py-4 flex flex-col items-center justify-center">
            <span className="min-w-0 break-words text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5 leading-tight">
              <span className="shrink-0">Đơn hàng</span>
              <span className="shrink-0 p-1 rounded bg-blue-100">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </span>
            </span>
            <span className="text-lg sm:text-2xl font-bold text-blue-700 mt-1.5 sm:mt-2">{stats.orders.today > 0 ? `+${stats.orders.today}` : stats.orders.today}</span>
          </div>
          {/* Khách hàng */}
          <div className="min-w-0 px-2 py-3 sm:py-4 flex flex-col items-center justify-center">
            <span className="min-w-0 break-words text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5 leading-tight">
              <span className="shrink-0">Khách hàng</span>
              <span className="shrink-0 p-1 rounded bg-purple-100">
                <Users className="h-4 w-4 text-purple-600" />
              </span>
            </span>
            <span className="text-lg sm:text-2xl font-bold text-purple-700 mt-1.5 sm:mt-2">{(stats.customers.new ?? 0) > 0 ? `+${stats.customers.new ?? 0}` : stats.customers.new ?? 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
