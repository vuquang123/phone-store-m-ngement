"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Bar, Line, Chart as MixedChart } from "react-chartjs-2"
// Import auto bundle to ensure all controllers/elements are registered (avoids 'bar is not a registered controller')
import { Chart as ChartJS } from "chart.js/auto"

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



import { useMemo } from "react"

import React from "react"

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

  // Tóm tắt “nhẹ” để đổ UI card bên phải (nếu không có thì mặc định 0)
  const summary = useMemo(() => {
    const totalRevenue = (data.values ?? []).reduce((s, x) => s + (x || 0), 0)
    const totalProfit = (data.profit ?? []).reduce((s, x) => s + (x || 0), 0)
    const totalOrders = (data.orders ?? []).reduce((s, x) => s + (x || 0), 0)
    // Đọc đúng nguồn cho chế độ năm/tháng
    const totalOrdersOnl = selectedMonth === 0
      ? (data.totalOrdersOnlYear ?? 0)
      : (data.ordersOnl ?? []).reduce((s: number, x: number) => s + (x || 0), 0)
    const totalOrdersOff = selectedMonth === 0
      ? (data.totalOrdersOffYear ?? 0)
      : (data.ordersOff ?? []).reduce((s: number, x: number) => s + (x || 0), 0)
    const totalCustomers = selectedMonth === 0
      ? (data.totalCustomersYear ?? 0)
      : (data.customers ?? []).reduce((s, x) => s + (x || 0), 0)
    return { totalRevenue, totalProfit, totalOrders, totalOrdersOnl, totalOrdersOff, totalCustomers }
  }, [data])

  // ----- CHART DATA (chỉ phục vụ hiển thị)
  // Nếu là biểu đồ từng ngày trong tháng thì chỉ lấy số ngày
  const simpleDayLabels = selectedMonth !== 0
    ? (data.labels || []).map(label => {
        // Nếu label dạng '1/10/2025' thì lấy phần đầu tiên
        const parts = label.split("/");
        return parts[0];
      })
    : data.labels;

  const lineData = {
    labels: simpleDayLabels,
    datasets: [
      {
        label: "Doanh thu theo ngày (VND)",
        data: data.values,
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
            const idx = ctx.dataIndex;
            const doanhThu = formatCurrency(data.values[idx] ?? 0);
            const loiNhuan = data.profit ? formatCurrency(data.profit[idx] ?? 0) : "N/A";
            const khachHang = data.customers ? data.customers[idx] ?? 0 : "N/A"; // <-- Hiển thị đúng khách hàng mới
            const donOnl = data.ordersOnl ? data.ordersOnl[idx] ?? 0 : "N/A";
            const donOff = data.ordersOff ? data.ordersOff[idx] ?? 0 : "N/A";
            const donHang = data.orders ? data.orders[idx] ?? 0 : "N/A";
            return [
              `Doanh thu: ${doanhThu}`,
              `Lợi nhuận: ${loiNhuan}`,
              `Khách hàng: ${khachHang}`,
              `Đơn hàng: ${donHang}`,
              `Đơn onl: ${donOnl}`,
              `Đơn off: ${donOff}`,
            ];
          },
        },
      },
    },
    layout: { padding: 0 },
    scales: {
      x: {
        grid: { color: "#eef2f7" },
        ticks: { color: "#475569" },
        title: { display: true, text: "Ngày", color: "#0f172a", font: { weight: "bold" as const } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#eef2f7" },
        ticks: {
          color: "#475569",
          callback: (v: any) => (v >= 1_000_000 ? `${v / 1_000_000} triệu` : v),
        },
        title: { display: true, text: "Doanh thu", color: "#0f172a", font: { weight: "bold" as const } },
      },
    },
  } as const

  const profitLineData = (data.profit ?? []).map(v => v > 0 ? v : null);

  const barData = {
    labels: selectedMonth === 0
      ? data.labels
      : simpleDayLabels,
    datasets: [
      {
        label: "Doanh thu theo tháng (VND)",
        data: data.values,
        backgroundColor: data.values.map(v => v > 0 ? "#4A90E2" : "transparent"),
        borderRadius: 6,
        barPercentage: 0.8,
        categoryPercentage: 0.8,
        yAxisID: "y",
        type: "bar" as const,
        order: 2,
      },
      ...(selectedMonth === 0 && data.profit
        ? [{
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
          }]
        : []
      ),
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
            return "";
          },
        },
      },
    },
    layout: { padding: 0 },
    scales: {
      x: {
        grid: { color: "#eef2f7" },
        ticks: { color: "#475569" },
        title: { display: true, text: "Tháng", color: "#0f172a", font: { weight: "bold" as const } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#eef2f7" },
        ticks: {
          color: "#475569",
          callback: (v: any) => (v >= 1_000_000 ? `${v / 1_000_000} triệu` : v),
        },
        title: { display: true, text: "Doanh thu / Lợi nhuận", color: "#0f172a", font: { weight: "bold" as const } },
      },
    },
  } as const

  return (
    <Card className="w-full rounded-2xl border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-2xl">Biểu đồ thống kê</CardTitle>

          <div className="flex items-center gap-3">
            <select
              className="px-3 py-1.5 rounded-full border text-sm font-semibold bg-white shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={selectedYear}
              onChange={(e) => onYearChange?.(Number(e.target.value))}
            >
              {Array.from({ length: 6 }, (_, i) => 2020 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select
              className="px-3 py-1.5 rounded-full border text-sm font-semibold bg-white shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={selectedMonth}
              onChange={(e) => onMonthChange?.(Number(e.target.value))}
            >
              <option value={0}>Cả năm</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
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
              {selectedMonth === 0 ? (
                <MixedChart type="bar" data={barData as any} options={barOptions} />
              ) : (
                <Line data={lineData} options={lineOptions} />
              )}
            </div>
          </div>

          {/* Stats nhỏ bên phải */}
          <div className="lg:col-span-4">
            <div className="space-y-3 lg:sticky lg:top-3">
              <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm">
                <span className="font-semibold">{selectedMonth === 0 ? "Doanh thu năm" : "Doanh thu tháng"}</span>
                <span className="font-extrabold text-emerald-600">{formatCurrency(summary.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm">
                <span className="font-semibold">{selectedMonth === 0 ? "Lợi nhuận năm" : "Lợi nhuận tháng"}</span>
                <span className="font-extrabold text-orange-600">{formatCurrency(summary.totalProfit)}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border bg-white px-4 py-3 shadow-sm">
                <span className="font-semibold">{selectedMonth === 0 ? "Đơn hàng năm" : "Đơn hàng tháng"}</span>
                <span className="font-extrabold text-blue-600">
                  Tổng: {summary.totalOrders}
                </span>
                <span className="text-sm">
                  <span className="text-orange-700 font-semibold">Off: {summary.totalOrdersOff}</span>
                  {' | '}
                  <span className="text-green-700 font-semibold">Onl: {summary.totalOrdersOnl}</span>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm">
                <span className="font-semibold">{selectedMonth === 0 ? "Khách hàng năm" : "Khách hàng tháng"}</span>
                <span className="font-extrabold text-purple-600">{summary.totalCustomers}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const BarChart = React.memo(BarChartComponent)
