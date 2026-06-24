"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Line, Chart as MixedChart } from "react-chartjs-2"
// Auto-register all controllers/scales/elements once (prevents 'category' or 'bar' not registered' in prod)
import "chart.js/auto"
import React, { useMemo, useState, useEffect } from "react"

interface BarChartProps {
  data: {
    labels: string[];
    values: number[];
    title?: string;
    profit?: number[];
    margin?: number[];
    orders?: number[];
    customers?: number[];
    ordersOnl?: number[];
    ordersOff?: number[];
    ordersOnlByMonth?: number[];
    ordersOffByMonth?: number[];
    totalOrdersOnlYear?: number;
    totalOrdersOffYear?: number;
    totalCustomersYear?: number;
  }
  selectedMonth: number;
  selectedYear: number;
  onMonthChange?: (month: number) => void;
  onYearChange?: (year: number) => void;
}

// Style dùng chung cho các select để hàng filter cân đối
const SELECT_CLS =
  "h-9 min-w-[112px] rounded-full border bg-background px-2 text-sm font-semibold text-foreground shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-ring"

// Thẻ thống kê đồng nhất (label + value, accent màu) — đảm bảo 4 thẻ cân xứng
const StatCard = ({
  label,
  value,
  valueClass,
  accentClass,
  children,
}: {
  label: string
  value: React.ReactNode
  valueClass: string
  accentClass: string
  children?: React.ReactNode
}) => (
  <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${accentClass}`} />
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
    <div className={`mt-1 text-xl font-extrabold leading-tight ${valueClass}`}>{value}</div>
    {children}
  </div>
)

const BarChartComponent = ({
  data,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: BarChartProps) => {
  // ---- Chỉ format hiển thị, không làm “logic nghiệp vụ”
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
      n || 0
    )

  const isMonthView = selectedMonth !== 0
  // Số ngày trong tháng đang chọn (selectedMonth 1-indexed). Year view không dùng.
  const daysInMonth = useMemo(
    () => (isMonthView ? new Date(selectedYear, selectedMonth, 0).getDate() : 31),
    [isMonthView, selectedYear, selectedMonth]
  )

  // ----- Bộ lọc theo ngày (chỉ áp dụng ở chế độ xem theo tháng) -----
  const [dayFrom, setDayFrom] = useState(1)
  const [dayTo, setDayTo] = useState<number | null>(null) // null = đến hết tháng
  // Reset khoảng ngày khi đổi tháng/năm
  useEffect(() => {
    setDayFrom(1)
    setDayTo(null)
  }, [selectedMonth, selectedYear])

  const effectiveTo = dayTo ?? daysInMonth
  const isDayFiltered = isMonthView && (dayFrom !== 1 || effectiveTo !== daysInMonth)

  const handleFromChange = (v: number) => {
    setDayFrom(v)
    // Giữ khoảng hợp lệ: nếu "đến" nhỏ hơn "từ" thì kéo theo
    setDayTo((prev) => (prev !== null && prev < v ? v : prev))
  }
  const resetDayFilter = () => {
    setDayFrom(1)
    setDayTo(null)
  }

  // Dữ liệu hiển thị: ở month view + có lọc thì cắt theo khoảng ngày; ngược lại giữ nguyên.
  const view = useMemo(() => {
    if (!isMonthView) return data
    const from = dayFrom - 1
    const to = effectiveTo
    const sl = <T,>(a?: T[]): T[] | undefined => (a ? a.slice(from, to) : a)
    return {
      ...data,
      labels: (sl(data.labels) ?? []) as string[],
      values: (sl(data.values) ?? []) as number[],
      profit: sl(data.profit),
      margin: sl(data.margin),
      orders: sl(data.orders),
      customers: sl(data.customers),
      ordersOnl: sl(data.ordersOnl),
      ordersOff: sl(data.ordersOff),
    }
  }, [data, isMonthView, dayFrom, effectiveTo])

  // Tóm tắt cho các thẻ bên phải (phản ánh đúng khoảng ngày đang lọc)
  const summary = useMemo(() => {
    const totalRevenue = (view.values ?? []).reduce((s, x) => s + (x || 0), 0)
    const totalProfit = (view.profit ?? []).reduce((s, x) => s + (x || 0), 0)
    const totalOrders = (view.orders ?? []).reduce((s, x) => s + (x || 0), 0)
    const totalOrdersOnl = !isMonthView
      ? (view.totalOrdersOnlYear ?? 0)
      : (view.ordersOnl ?? []).reduce((s: number, x: number) => s + (x || 0), 0)
    const totalOrdersOff = !isMonthView
      ? (view.totalOrdersOffYear ?? 0)
      : (view.ordersOff ?? []).reduce((s: number, x: number) => s + (x || 0), 0)
    const totalCustomers = !isMonthView
      ? (view.totalCustomersYear ?? 0)
      : (view.customers ?? []).reduce((s, x) => s + (x || 0), 0)
    return { totalRevenue, totalProfit, totalOrders, totalOrdersOnl, totalOrdersOff, totalCustomers }
  }, [view, isMonthView])

  // Nhãn động cho thẻ theo phạm vi đang xem
  const scopeLabel = !isMonthView ? "năm" : isDayFiltered ? `ngày ${dayFrom}–${effectiveTo}` : "tháng"

  // ----- CHART DATA (chỉ phục vụ hiển thị) -----
  // Ở month view: chỉ lấy phần ngày (vd '1/10/2025' -> '1')
  const simpleDayLabels = isMonthView
    ? (view.labels || []).map((label) => label.split("/")[0])
    : data.labels

  const lineData = {
    labels: simpleDayLabels,
    datasets: [
      {
        label: "Doanh thu theo ngày (VND)",
        data: view.values,
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.15)",
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  }

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false, // quan trọng: lấp đầy khung, không chừa khoảng trắng
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const idx = ctx.dataIndex
            const doanhThu = formatCurrency(view.values[idx] ?? 0)
            const loiNhuan = view.profit ? formatCurrency(view.profit[idx] ?? 0) : "N/A"
            const khachHang = view.customers ? view.customers[idx] ?? 0 : "N/A"
            const donOnl = view.ordersOnl ? view.ordersOnl[idx] ?? 0 : "N/A"
            const donOff = view.ordersOff ? view.ordersOff[idx] ?? 0 : "N/A"
            const donHang = view.orders ? view.orders[idx] ?? 0 : "N/A"
            return [
              `Doanh thu: ${doanhThu}`,
              `Lợi nhuận: ${loiNhuan}`,
              `Khách hàng: ${khachHang}`,
              `Đơn hàng: ${donHang}`,
              `Đơn onl: ${donOnl}`,
              `Đơn off: ${donOff}`,
            ]
          },
        },
      },
    },
    layout: { padding: 0 },
    scales: {
      x: {
        grid: { color: "rgba(148,163,184,0.18)" },
        ticks: { color: "#94a3b8" },
        title: { display: true, text: "Ngày", color: "#94a3b8", font: { weight: "bold" as const } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148,163,184,0.18)" },
        ticks: {
          color: "#94a3b8",
          callback: (v: any) => (v >= 1_000_000 ? `${v / 1_000_000} triệu` : v),
        },
        title: { display: true, text: "Doanh thu", color: "#94a3b8", font: { weight: "bold" as const } },
      },
    },
  } as const

  const profitLineData = (data.profit ?? []).map((v) => (v > 0 ? v : null))

  const barData: any = {
    labels: data.labels,
    datasets: [
      {
        label: "Doanh thu theo tháng (VND)",
        data: data.values,
        backgroundColor: data.values.map((v) => (v > 0 ? "#4A90E2" : "transparent")),
        borderRadius: 6,
        barPercentage: 0.8,
        categoryPercentage: 0.8,
        yAxisID: "y",
        type: "bar" as const,
        order: 2,
      },
      ...(data.profit
        ? [
            {
              label: "Lợi nhuận theo tháng (VND)",
              data: profitLineData, // <-- chỉ vẽ line ở tháng có lợi nhuận
              borderColor: "#7ED321",
              backgroundColor: "rgba(245, 158, 66, 0.15)",
              type: "line" as const,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: false,
              yAxisID: "y",
              order: 1,
            },
          ]
        : []),
    ],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true }, // Hiển thị chú thích cho cả bar và line
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            if (ctx.dataset.label === "Doanh thu theo tháng (VND)") {
              return `Doanh thu: ${formatCurrency(ctx.parsed.y)}`
            }
            if (ctx.dataset.label === "Lợi nhuận theo tháng (VND)") {
              return `Lợi nhuận: ${formatCurrency(ctx.parsed.y)}`
            }
            return ""
          },
        },
      },
    },
    layout: { padding: 0 },
    scales: {
      x: {
        grid: { color: "rgba(148,163,184,0.18)" },
        ticks: { color: "#94a3b8" },
        title: { display: true, text: "Tháng", color: "#94a3b8", font: { weight: "bold" as const } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148,163,184,0.18)" },
        ticks: {
          color: "#94a3b8",
          callback: (v: any) => (v >= 1_000_000 ? `${v / 1_000_000} triệu` : v),
        },
        title: { display: true, text: "Doanh thu / Lợi nhuận", color: "#94a3b8", font: { weight: "bold" as const } },
      },
    },
  } as const

  return (
    <Card className="w-full rounded-2xl border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-2xl">Biểu đồ thống kê</CardTitle>

          {/* Hàng filter: năm / tháng / khoảng ngày — wrap đều, cùng style */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={SELECT_CLS}
              value={selectedYear}
              onChange={(e) => onYearChange?.(Number(e.target.value))}
              aria-label="Chọn năm"
            >
              {Array.from({ length: 6 }, (_, i) => 2020 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              className={SELECT_CLS}
              value={selectedMonth}
              onChange={(e) => onMonthChange?.(Number(e.target.value))}
              aria-label="Chọn tháng"
            >
              <option value={0}>Cả năm</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>

            {/* Bộ lọc theo ngày: chỉ hiện khi xem theo tháng */}
            {isMonthView && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Ngày</span>
                <select
                  className={SELECT_CLS + " min-w-[84px]"}
                  value={dayFrom}
                  onChange={(e) => handleFromChange(Number(e.target.value))}
                  aria-label="Từ ngày"
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">–</span>
                <select
                  className={SELECT_CLS + " min-w-[84px]"}
                  value={effectiveTo}
                  onChange={(e) => setDayTo(Number(e.target.value))}
                  aria-label="Đến ngày"
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1)
                    .filter((d) => d >= dayFrom)
                    .map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </select>
                {isDayFiltered && (
                  <button
                    type="button"
                    onClick={resetDayFilter}
                    className="h-9 rounded-full border px-3 text-sm font-medium text-muted-foreground shadow-sm hover:bg-accent"
                  >
                    Tất cả
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 2 cột: chart bên trái + stats bên phải. Không dùng absolute, không margin “ảo” */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Chart */}
          <div className="lg:col-span-8">
            {/* khung cố định chiều cao để Chart.js fill vào (nhờ maintainAspectRatio:false) */}
            <div className="h-[280px] sm:h-[320px] lg:h-[360px] w-full">
              {!isMonthView ? (
                <MixedChart type="bar" data={barData as any} options={barOptions} />
              ) : (
                <Line data={lineData} options={lineOptions} />
              )}
            </div>
          </div>

          {/* Stats nhỏ bên phải — 4 thẻ đồng nhất */}
          <div className="lg:col-span-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:sticky lg:top-3">
              <StatCard
                label={`Doanh thu ${scopeLabel}`}
                value={formatCurrency(summary.totalRevenue)}
                valueClass="text-emerald-600"
                accentClass="bg-emerald-500"
              />
              <StatCard
                label={`Lợi nhuận ${scopeLabel}`}
                value={formatCurrency(summary.totalProfit)}
                valueClass="text-orange-600"
                accentClass="bg-orange-500"
              />
              <StatCard
                label={`Đơn hàng ${scopeLabel}`}
                value={summary.totalOrders}
                valueClass="text-blue-600"
                accentClass="bg-blue-500"
              >
                <div className="mt-1 flex items-center gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-orange-700">Off: {summary.totalOrdersOff}</span>
                  <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-green-700">Onl: {summary.totalOrdersOnl}</span>
                </div>
              </StatCard>
              <StatCard
                label={`Khách hàng ${scopeLabel}`}
                value={summary.totalCustomers}
                valueClass="text-purple-600"
                accentClass="bg-purple-500"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const BarChart = React.memo(BarChartComponent)
