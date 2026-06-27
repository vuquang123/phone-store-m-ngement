"use client"

import { useState, useEffect } from "react"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

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

        // Tham số kỳ gửi lên API (mặc định hiện tại). month=0 nghĩa là xem cả năm.
        const qYear = typeof selectedYear === "number" ? selectedYear : new Date().getFullYear()
        const qMonth = typeof selectedMonth === "number" ? selectedMonth : new Date().getMonth() + 1

        // Fetch stats — gửi year/month để API trả đúng kỳ được chọn
        const statsResponse = await fetchWithTimeout(`/api/dashboard/stats?year=${qYear}&month=${qMonth}`)
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
        // Biểu đồ tháng: tạo đủ số ngày, khớp bản ghi theo (ngày, tháng, năm) đã PARSE
        // (không so khớp chuỗi cứng -> tránh lệch định dạng zero-pad/có giờ làm ra 0)
        if (Array.isArray(statsData.dailyStats)) {
          const daysInMonth = new Date(qYear, qMonth, 0).getDate();
          const dailyLabels: string[] = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}/${qMonth}/${qYear}`);
          const findByDay = (day: number) =>
            statsData.dailyStats.find((d: any) => {
              const m = String(d.date).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
              return m && Number(m[1]) === day && Number(m[2]) === qMonth && Number(m[3]) === qYear;
            });
          const perDay = Array.from({ length: daysInMonth }, (_, i) => findByDay(i + 1));
          statsData.dailyLabels = dailyLabels;
          statsData.dailyRevenue = perDay.map((d: any) => (d ? d.revenue : 0));
          statsData.dailyProfit = perDay.map((d: any) => (d ? d.profit : 0));
          statsData.dailyOrders = perDay.map((d: any) => (d ? d.orders : 0));
          statsData.dailyOrdersOnl = perDay.map((d: any) => (d ? d.ordersOnl ?? 0 : 0));
          statsData.dailyOrdersOff = perDay.map((d: any) => (d ? d.ordersOff ?? 0 : 0));
          statsData.dailyCustomers = perDay.map((d: any) => (d ? d.newCustomers ?? 0 : 0));
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
        const activitiesResponse = await fetchWithTimeout("/api/dashboard/recent-activities")
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
