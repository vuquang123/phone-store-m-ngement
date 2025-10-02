// app/api/dashboard/route.ts
import { NextResponse, type NextRequest } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

export const dynamic = "force-dynamic"

const SHEETS = {
  BAN_HANG: "Ban_Hang",
  KHO_HANG: "Kho_Hang",
  KHACH_HANG: "Khach_Hang",
} as const

/* ================= Helpers ================= */

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .toLowerCase()

function colIndex(header: string[], ...names: string[]) {
  // match chính xác trước
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  // fallback: chuẩn hoá không dấu
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

// Parse đa dạng: ISO, hoặc dd/mm/yyyy [hh:mm[:ss]]
function parseToEpoch(s: any): number {
  if (!s) return 0
  const str = String(s)
  const t = Date.parse(str)
  if (!Number.isNaN(t)) return t
  const m = str.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  )
  if (m) {
    const [_, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m
    return new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss).getTime()
  }
  return 0
}

// Lấy "bắt đầu hôm nay" và "bắt đầu tháng" theo múi giờ VN (xấp xỉ tốt)
function getVNTimeAnchors() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  )
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startOfTodayTs: startOfToday.getTime(), startOfMonthTs: startOfMonth.getTime() }
}

function inSameDay(ts: number, startOfDayTs: number) {
  return ts >= startOfDayTs && ts < startOfDayTs + 24 * 60 * 60 * 1000
}
function inSameMonth(ts: number, startOfMonthTs: number) {
  const d = new Date(startOfMonthTs)
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  return ts >= startOfMonthTs && ts < nextMonth
}

// Chuyển giá VN "1.234.567" -> number
function toNumber(x: any): number {
  if (typeof x === "number") return x
  const digits = String(x || "").replace(/[^\d]/g, "")
  return digits ? Number(digits) : 0
}

/* ================= Route ================= */

export async function GET(_req: NextRequest) {
  try {
    // Đọc sheet Thong_Ke
    const { header, rows } = await readFromGoogleSheets("Thong_Ke")
    const now = new Date()
    const todayStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`
    const monthStr = `${now.getMonth() + 1}/${now.getFullYear()}`

    // Vùng ngày: cột A-K (0-10)
    const idxNgay = 0
    const idxDonHangOnl = 1
    const idxDoanhThuOnl = 2
    const idxLoiNhuanOnl = 3
    const idxDonHangOff = 4
    const idxDoanhThuOff = 5
    const idxLoiNhuanOff = 6
    const idxTongDon = 7
    const idxTongDoanhThu = 8
    const idxTongLoiNhuan = 9
    const idxTongKhachHangMoi = 10

    // Vùng tháng: cột M-W (12-22)
    const idxThang = 12
    const idxDonHangOnlThang = 13
    const idxDoanhThuOnlThang = 14
    const idxLoiNhuanOnlThang = 15
    const idxDonHangOffThang = 16
    const idxDoanhThuOffThang = 17
    const idxLoiNhuanOffThang = 18
    const idxTongDonThang = 19
    const idxTongDoanhThuThang = 20
    const idxTongLoiNhuanThang = 21
    const idxTongKhachHangMoiThang = 22

    // Tách vùng ngày
    const rowsNgay = rows.filter(r => r[idxNgay] && String(r[idxNgay]).trim() !== "")
    // Tách vùng tháng
    const rowsThang = rows.filter(r => r[idxThang] && String(r[idxThang]).trim() !== "")

    // Giả sử bạn đã có biến header là mảng tiêu đề cột của sheet
    const idxKhachHangMoi = colIndex(header, "Tổng khách hàng mới", "Khách hàng mới", "newCustomers");

    // Tạo dailyStats từ vùng ngày
    const dailyStats = rowsNgay.map(row => ({
      date: row[idxNgay],
      revenue: toNumber(row[idxTongDoanhThu]),
      profit: toNumber(row[idxTongLoiNhuan]),
      orders: Number(row[idxTongDon] || 0),
      ordersOnl: Number(row[idxDonHangOnl] || 0),
      ordersOff: Number(row[idxDonHangOff] || 0),
      revenueOnl: toNumber(row[idxDoanhThuOnl] || 0),
      profitOnl: toNumber(row[idxLoiNhuanOnl] || 0),
      revenueOff: toNumber(row[idxDoanhThuOff] || 0),
      profitOff: toNumber(row[idxLoiNhuanOff] || 0),
      newCustomers: Number(row[idxKhachHangMoi] || 0), // <-- Tự động bổ sung trường khách hàng mới
    }))

    // Tạo mảng thống kê theo tháng cho năm hiện tại
    const year = now.getFullYear()
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    let totalCustomersYear = 0
    let totalOrdersOnlYear = 0
    let totalOrdersOffYear = 0
    const monthlyStats = months.map(m => {
      const monthStr = `${m}/${year}`;
      const row = rowsThang.find(r => {
        const cell = String(r[idxThang]).trim();
        const [mm, yyyy] = cell.split("/");
        return Number(mm) === m && Number(yyyy) === year;
      });
      const customers = Number(row?.[idxTongKhachHangMoiThang] ?? 0)
      const ordersOnl = Number(row?.[idxDonHangOnlThang] ?? 0)
      const ordersOff = Number(row?.[idxDonHangOffThang] ?? 0)
      totalCustomersYear += customers
      totalOrdersOnlYear += ordersOnl
      totalOrdersOffYear += ordersOff
      return {
        month: monthStr,
        revenue: toNumber(row?.[idxTongDoanhThuThang] ?? 0),
        profit: toNumber(row?.[idxTongLoiNhuanThang] ?? 0),
        orders: Number(row?.[idxTongDonThang] ?? 0),
        customers,
        ordersOnl,
        ordersOff
      }
    })

    // Dòng thống kê tháng hiện tại
    let monthlyRow = rowsThang.find(r => r[idxThang] && String(r[idxThang]).trim() === `${now.getMonth() + 1}/${year}`)
    if (!monthlyRow) monthlyRow = rowsThang[0] || []

    // Trả về đúng shape cho dashboard
    const result = {
      revenue: {
        monthly: toNumber(monthlyRow[idxTongDoanhThuThang]),
        today: dailyStats.find(d => d.date === todayStr)?.revenue || 0,
        yearly: monthlyStats.reduce((s, m) => s + (m.revenue || 0), 0),
      },
      profit: {
        monthly: toNumber(monthlyRow[idxTongLoiNhuanThang]),
        today: dailyStats.find(d => d.date === todayStr)?.profit || 0,
        yearly: monthlyStats.reduce((s, m) => s + (m.profit || 0), 0),
        lastYear: 0,
      },
      margin: {
        monthly: toNumber(monthlyRow[idxTongDoanhThuThang]) > 0 ? Math.round(toNumber(monthlyRow[idxTongLoiNhuanThang]) / toNumber(monthlyRow[idxTongDoanhThuThang]) * 100) : 0,
        yearly: 0,
      },
      orders: {
        monthly: Number(monthlyRow[idxTongDonThang] || 0),
        today: dailyStats.find(d => d.date === todayStr)?.orders || 0,
        yearly: monthlyStats.reduce((s, m) => s + (m.orders || 0), 0),
        onlYear: totalOrdersOnlYear,
        offYear: totalOrdersOffYear,
      },
      products: {
        total: 0,
        lowStock: 0,
        lowStockThreshold: 5,
      },
      customers: {
        total: totalCustomersYear,
        new: Number(monthlyRow[idxTongKhachHangMoiThang] || 0),
      },
      dailyStats,
      monthlyStats,
    }
    const res = NextResponse.json(result)
    // Cache nhẹ trong 60s cho Vercel Edge (s-maxage) nhưng vẫn cho revalidate thủ công nếu cần
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30")
    return res
  } catch (error) {
    console.error("[dashboard] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
