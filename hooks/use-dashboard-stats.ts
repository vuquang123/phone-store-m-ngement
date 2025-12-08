"use client"

import { useState, useEffect } from "react"

interface DashboardStats {
  dailyLabels?: string[];
  dailyRevenue?: number[];
  dailyProfit?: number[];
  dailyOrders?: number[];
  dailyOrdersOnl?: number[];
  dailyOrdersOff?: number[];
  dailyCustomers?: number[];
  revenue: {
    monthly: number
    today: number
    yearly?: number
  }
  profit: {
    monthly: number
    today: number
    yearly?: number
  }
  margin: {
    monthly: number
    yearly?: number
  }
  orders: {
    monthly: number
    today: number
  }
  products: {
    total: number
    lowStock?: number
    lowStockThreshold?: number
  }
  inventory?: {
    inStock: number
    totalCost: number
  }
  customers: {
    total: number
    new?: number
  }
  labels?: string[]
  revenueByMonth?: number[]
  profitByMonth?: number[]
  marginByMonth?: number[]
  ordersByMonth?: number[]
  customersByMonth?: number[]
  totalOrdersOnlYear?: number;
  totalOrdersOffYear?: number;
  totalCustomersYear?: number;
}

interface Activity {
  type: string
  title: string
  description: string
  time: string
  icon: string
}

export function useDashboardStats(selectedMonth?: number, selectedYear?: number) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true)

        // Fetch stats
        const statsResponse = await fetch("/api/dashboard/stats")
        if (!statsResponse.ok) throw new Error("Failed to fetch stats")
        const statsData = await statsResponse.json()

        console.log(statsData.dailyStats);

        // Nếu API trả về monthlyStats thì dùng cho biểu đồ năm, dailyStats cho biểu đồ tháng
        let labels: string[] = []
        let revenueByMonth: number[] = []
        let profitByMonth: number[] = []
        let ordersByMonth: number[] = []
        let ordersOnlByMonth: number[] = []
        let ordersOffByMonth: number[] = []
        // Mặc định: hiển thị theo năm (12 tháng)
        if (Array.isArray(statsData.monthlyStats)) {
          labels = statsData.monthlyStats.map((d: any) => d.month)
          revenueByMonth = statsData.monthlyStats.map((d: any) => d.revenue)
          profitByMonth = statsData.monthlyStats.map((d: any) => d.profit)
          ordersByMonth = statsData.monthlyStats.map((d: any) => d.orders)
          ordersOnlByMonth = statsData.monthlyStats.map((d: any) => d.ordersOnl ?? 0)
          ordersOffByMonth = statsData.monthlyStats.map((d: any) => d.ordersOff ?? 0)
        }
        // Nếu FE chọn tháng, tạo mảng ngày đủ số ngày trong tháng, ngày không có thì mặc định 0
        if (Array.isArray(statsData.dailyStats)) {
          // Lấy selectedMonth, selectedYear từ tham số truyền vào, nếu không có thì lấy tháng/năm hiện tại
          let year = typeof selectedYear === "number" ? selectedYear : new Date().getFullYear();
          let month = typeof selectedMonth === "number" ? selectedMonth : new Date().getMonth() + 1;
          const daysInMonth = new Date(year, month, 0).getDate();
          const dailyLabels: string[] = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}/${month}/${year}`);
          const dailyRevenue: number[] = dailyLabels.map(label => {
            const found = statsData.dailyStats.find((d: any) => {
              const m = d.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              return m && Number(m[2]) === month && Number(m[3]) === year && d.date === label;
            });
            return found ? found.revenue : 0;
          });
          const dailyProfit: number[] = dailyLabels.map(label => {
            const found = statsData.dailyStats.find((d: any) => {
              const m = d.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              return m && Number(m[2]) === month && Number(m[3]) === year && d.date === label;
            });
            return found ? found.profit : 0;
          });
          const dailyOrders: number[] = dailyLabels.map(label => {
            const found = statsData.dailyStats.find((d: any) => {
              const m = d.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              return m && Number(m[2]) === month && Number(m[3]) === year && d.date === label;
            });
            return found ? found.orders : 0;
          });
          statsData.dailyLabels = dailyLabels;
          statsData.dailyRevenue = dailyRevenue;
          statsData.dailyProfit = dailyProfit;
          statsData.dailyOrders = dailyOrders;
          // Thêm đơn online/offline nếu có
          statsData.dailyOrdersOnl = dailyLabels.map(label => {
            const found = statsData.dailyStats.find((d: any) => {
              const m = d.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              return m && Number(m[2]) === month && Number(m[3]) === year && d.date === label;
            });
            return found ? found.ordersOnl ?? 0 : 0;
          });
          statsData.dailyOrdersOff = dailyLabels.map(label => {
            const found = statsData.dailyStats.find((d: any) => {
              const m = d.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              return m && Number(m[2]) === month && Number(m[3]) === year && d.date === label;
            });
            return found ? found.ordersOff ?? 0 : 0;
          });
          statsData.dailyCustomers = dailyLabels.map(label => {
            const found = statsData.dailyStats.find((d: any) => d.date === label);
            return found ? found.newCustomers ?? 0 : 0;
          });
        }
        setStats({
          ...statsData,
          labels,
          revenueByMonth,
          profitByMonth,
          ordersByMonth,
          ordersOnlByMonth,
          ordersOffByMonth,
          dailyCustomers: statsData.dailyCustomers,
          // Bổ sung tổng khách hàng năm và tổng đơn onl/off năm cho FE
          totalCustomersYear: statsData.customers?.total ?? 0,
          totalOrdersOnlYear: statsData.orders?.onlYear ?? 0,
          totalOrdersOffYear: statsData.orders?.offYear ?? 0,
        })

        // Fetch activities
        const activitiesResponse = await fetch("/api/dashboard/recent-activities")
        if (!activitiesResponse.ok) throw new Error("Failed to fetch activities")
        const activitiesData = await activitiesResponse.json()
        setActivities(activitiesData.activities)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [selectedMonth, selectedYear])

  // Trả về toàn bộ dữ liệu thực tế từ API, nếu không có thì trả về mock
  const updatedStats = stats ?? {
    revenue: { monthly: 0, today: 0 },
    profit: { monthly: 0, today: 0 },
    margin: { monthly: 0 },
    orders: { monthly: 0, today: 0 },
    products: { total: 0 },
    inventory: { inStock: 0, totalCost: 0 },
    customers: { total: 0 },
  }
  return { stats: updatedStats, activities, isLoading, error }
}
