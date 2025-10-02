"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { useState } from "react"
import { BarChart } from "@/components/dashboard/bar-chart"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RecentActivities } from "@/components/dashboard/recent-activities"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Plus, Package, ShoppingCart, Users, AlertCircle, HelpCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

type NormalizedStats = {
  products: { total: number; lowStock: number }
  customers: { total: number; new: number }
  orders: { monthly: number; today: number }
  revenue: { monthly: number; today: number }
}

const DEFAULT_STATS: NormalizedStats = {
  products: { total: 0, lowStock: 0 },
  customers: { total: 0, new: 0 },
  orders: { monthly: 0, today: 0 },
  revenue: { monthly: 0, today: 0 },
}

export default function DashboardPage() {
  // State tháng/năm chỉ dùng cho BarChart
  const [selectedMonth, setSelectedMonth] = useState<number>(0)
  const [selectedYear, setSelectedYear] = useState<number>(2025)
  // Dữ liệu tổng cho các phần khác
  const {
    stats: rawStats,
    activities = [],
    isLoading = false,
    error = "",
  } = useDashboardStats() || {}
  // Chuẩn hóa về đúng shape mà QuickStats/StatsCards cần
  const stats: NormalizedStats = (() => {
    const s: any = rawStats || {}
    return {
      products: {
        total: Number(s?.products?.total ?? 0),
        lowStock: Number(s?.products?.lowStock ?? 0),
      },
      customers: {
        total: Number(s?.customers?.total ?? 0),
        new: Number(s?.customers?.new ?? 0),
      },
      orders: {
        monthly: Number(s?.orders?.monthly ?? 0),
        today: Number(s?.orders?.today ?? 0),
      },
      revenue:
        typeof s?.revenue === "number"
          ? { monthly: Number(s.revenue), today: 0 }
          : {
              monthly: Number(s?.revenue?.monthly ?? 0),
              today: Number(s?.revenue?.today ?? 0),
            },
      profit:
        typeof s?.profit === "number"
          ? { monthly: Number(s.profit), today: 0 }
          : {
              monthly: Number(s?.profit?.monthly ?? 0),
              today: Number(s?.profit?.today ?? 0),
            },
    }
  })()
  const hasNoData =
    stats.products.total === 0 &&
    stats.customers.total === 0 &&
    stats.orders.monthly === 0

  return (
    <ProtectedRoute>
      <TooltipProvider>
        <div className="space-y-6 lg:space-y-8 p-4 lg:p-0">
          {/* Bar chart lợi nhuận tháng */}
          <BarChartSection 
            selectedMonth={selectedMonth} 
            setSelectedMonth={setSelectedMonth} 
            selectedYear={selectedYear} 
            setSelectedYear={setSelectedYear} 
          />

          {/* Stats */}
          <StatsCards stats={stats} />

          {hasNoData ? (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl lg:text-2xl">Bắt đầu với cửa hàng của bạn</CardTitle>
                <CardDescription className="text-base lg:text-lg">
                  Hệ thống chưa có dữ liệu. Hãy bắt đầu bằng việc thêm sản phẩm và khách hàng.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild className="h-20 lg:h-24 flex-col gap-2 text-center">
                        <Link href="/dashboard/kho-hang">
                          <Package className="h-6 lg:h-8 w-6 lg:w-8" />
                          <span className="font-medium text-sm lg:text-base">Thêm sản phẩm</span>
                          <span className="text-xs opacity-80 hidden lg:block">Quản lý kho hàng iPhone</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Thêm iPhone Lock vào kho hàng để bắt đầu bán</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant="outline"
                        className="h-20 lg:h-24 flex-col gap-2 bg-transparent text-center"
                      >
                        <Link href="/dashboard/khach-hang">
                          <Users className="h-6 lg:h-8 w-6 lg:w-8" />
                          <span className="font-medium text-sm lg:text-base">Thêm khách hàng</span>
                          <span className="text-xs opacity-80 hidden lg:block">Quản lý thông tin khách hàng</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tạo hồ sơ khách hàng để theo dõi lịch sử mua hàng</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant="outline"
                        className="h-20 lg:h-24 flex-col gap-2 bg-transparent text-center sm:col-span-2 lg:col-span-1"
                      >
                        <Link href="/dashboard/ban-hang">
                          <ShoppingCart className="h-6 lg:h-8 w-6 lg:w-8" />
                          <span className="font-medium text-sm lg:text-base">Tạo đơn hàng</span>
                          <span className="text-xs opacity-80 hidden lg:block">Bắt đầu bán hàng</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Tạo đơn hàng mới và xử lý thanh toán</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>

              <div className="grid gap-6 lg:grid-cols-1">
                <RecentActivities activities={activities ?? []} />
              </div>
            </>
          )}
        </div>
      </TooltipProvider>
    </ProtectedRoute>
  )
}

// Component chỉ phục vụ BarChart, dùng hook useDashboardStats(selectedMonth, selectedYear)
type BarChartSectionProps = {
  selectedMonth: number;
  setSelectedMonth: React.Dispatch<React.SetStateAction<number>>;
  selectedYear: number;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
};
function BarChartSection({ selectedMonth, setSelectedMonth, selectedYear, setSelectedYear }: BarChartSectionProps) {
  const { stats: rawStats, isLoading, error } = useDashboardStats(selectedMonth, selectedYear) || {}
  return (
    <div className="mb-4">
      <BarChart
        data={
          selectedMonth === 0
            ? {
                labels: rawStats?.labels ?? [],
                values: rawStats?.revenueByMonth ?? [],
                profit: rawStats?.profitByMonth ?? [],
                margin: rawStats?.marginByMonth ?? [],
                orders: rawStats?.ordersByMonth ?? [],
                customers: rawStats?.customersByMonth ?? [],
                title: "Lợi nhuận từng tháng",
                totalOrdersOnlYear: rawStats?.totalOrdersOnlYear ?? 0,
                totalOrdersOffYear: rawStats?.totalOrdersOffYear ?? 0,
                totalCustomersYear: rawStats?.totalCustomersYear ?? 0,
              }
            : {
                labels: rawStats?.dailyLabels ?? [],
                values: rawStats?.dailyRevenue ?? [],
                profit: rawStats?.dailyProfit ?? [],
                margin: [],
                orders: rawStats?.dailyOrders ?? [],
                customers: rawStats?.dailyCustomers ?? [], 
                ordersOnl: rawStats?.dailyOrdersOnl ?? [],
                ordersOff: rawStats?.dailyOrdersOff ?? [],
                title: `Lợi nhuận từng ngày tháng ${selectedMonth}`
              }
        }
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
      />
    </div>
  )
}
