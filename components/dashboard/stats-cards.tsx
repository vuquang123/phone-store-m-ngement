"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ShoppingCart, Users, Package, Wallet, type LucideIcon } from "lucide-react"

interface StatsCardsProps {
  stats: {
    revenue: { monthly: number; today: number }
    profit?: { monthly: number; today: number }
    margin?: { monthly: number; today: number }
    orders: { monthly: number; today: number }
    products: { total: number; lowStock: number }
    customers: { total: number; new: number }
    inventory?: { inStock: number; totalCost: number }
  }
}

// Lớp tĩnh theo từng "tint" (Tailwind cần class đầy đủ, không nội suy động) — có biến thể dark.
const TINT = {
  emerald: { chip: "bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400", value: "text-emerald-700 dark:text-emerald-400" },
  orange: { chip: "bg-orange-500/10", icon: "text-orange-600 dark:text-orange-400", value: "text-orange-700 dark:text-orange-400" },
  blue: { chip: "bg-blue-500/10", icon: "text-blue-600 dark:text-blue-400", value: "text-blue-700 dark:text-blue-400" },
  purple: { chip: "bg-purple-500/10", icon: "text-purple-600 dark:text-purple-400", value: "text-purple-700 dark:text-purple-400" },
  sky: { chip: "bg-sky-500/10", icon: "text-sky-600 dark:text-sky-400", value: "text-sky-700 dark:text-sky-400" },
  amber: { chip: "bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400", value: "text-amber-700 dark:text-amber-400" },
} as const

export function StatsCards({ stats }: StatsCardsProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount)
  const showPlusCurrency = (value: number) => (value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value))
  const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value)
  const showPlusNumber = (value: number) => (value > 0 ? `+${value}` : `${value}`)

  const items: { label: string; icon: LucideIcon; tint: keyof typeof TINT; value: string }[] = [
    { label: "Doanh thu", icon: DollarSign, tint: "emerald", value: showPlusCurrency(stats.revenue.today) },
    { label: "Lợi nhuận", icon: DollarSign, tint: "orange", value: showPlusCurrency(stats.profit?.today ?? 0) },
    { label: "Đơn hàng", icon: ShoppingCart, tint: "blue", value: showPlusNumber(stats.orders.today) },
    { label: "Khách hàng", icon: Users, tint: "purple", value: showPlusNumber(stats.customers.new ?? 0) },
    { label: "Tồn kho", icon: Package, tint: "sky", value: formatNumber(stats.inventory?.inStock ?? 0) },
    { label: "Giá vốn tồn", icon: Wallet, tint: "amber", value: formatCurrency(stats.inventory?.totalCost ?? 0) },
  ]

  return (
    <Card className="w-full hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Tổng hợp hôm nay</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-border text-center">
          {items.map(({ label, icon: Icon, tint, value }) => (
            <div key={label} className="min-w-0 px-2 py-3 sm:py-4 flex flex-col items-center justify-center">
              <span className="min-w-0 break-words text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5 leading-tight">
                <span className="shrink-0">{label}</span>
                <span className={`shrink-0 p-1 rounded ${TINT[tint].chip}`}>
                  <Icon className={`h-4 w-4 ${TINT[tint].icon}`} />
                </span>
              </span>
              <span className={`text-lg sm:text-2xl font-bold mt-1.5 sm:mt-2 ${TINT[tint].value}`}>{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
