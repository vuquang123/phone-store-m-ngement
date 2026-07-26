import { NextResponse, type NextRequest } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"
import { parseVietnameseNumber } from "@/lib/number"

export const dynamic = "force-dynamic"

const SHEETS = {
  BAN_HANG: "Ban_Hang",
  KHO_HANG: "Kho_Hang",
  KHACH_HANG: "Khach_Hang",
} as const

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .trim()

function colIndex(header: string[], ...names: string[]) {
  for (const n of names) {
    const i = header.indexOf(n)
    if (i !== -1) return i
  }
  const hh = header.map((h) => norm(h))
  for (const n of names) {
    const i = hh.indexOf(norm(n))
    if (i !== -1) return i
  }
  return -1
}

function toNumber(x: any): number {
  return parseVietnameseNumber(x)
}

function parseVNDateParts(s: any) {
  const str = String(s ?? "").trim()
  if (!str) return null

  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) }
  }

  const iso = new Date(str)
  if (!Number.isNaN(iso.getTime())) {
    return {
      day: iso.getDate(),
      month: iso.getMonth() + 1,
      year: iso.getFullYear(),
    }
  }

  return null
}

function statusExcluded(raw: any) {
  const s = norm(String(raw || ""))
  return s.includes("hoan_tra") || s.includes("huy")
}

function isOnlineOrder(raw: any) {
  const s = norm(String(raw || ""))
  return s.includes("onl")
}

function isInventoryInStock(raw: any) {
  const s = norm(String(raw || ""))
  return s === "con_hang" || s === "available" || s === ""
}

type DayAgg = {
  revenue: number
  profit: number
  orders: Set<string>
  ordersOnl: Set<string>
  ordersOff: Set<string>
}

type MonthAgg = DayAgg

function makeAgg(): DayAgg {
  return {
    revenue: 0,
    profit: 0,
    orders: new Set<string>(),
    ordersOnl: new Set<string>(),
    ordersOff: new Set<string>(),
  }
}

export async function GET(req: NextRequest) {
  try {
    const nowVN = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
    )
    const reqYear = Number(req.nextUrl.searchParams.get("year")) || nowVN.getFullYear()
    const reqMonth = Number(req.nextUrl.searchParams.get("month")) || (nowVN.getMonth() + 1)
    const monthForView = reqMonth > 0 ? reqMonth : nowVN.getMonth() + 1
    const todayKey = `${nowVN.getDate()}/${nowVN.getMonth() + 1}/${nowVN.getFullYear()}`

    let inventoryInStock = 0
    let inventoryCost = 0
    try {
      const { header: khoHeader, rows: khoRows } = await readFromGoogleSheets(SHEETS.KHO_HANG)
      const idxGiaNhap = colIndex(khoHeader, "Giá Nhập", "Gia Nhap", "GiaNhap")
      const idxTrangThai = colIndex(khoHeader, "Trạng Thái", "Trang Thai")
      for (const row of khoRows) {
        const status = idxTrangThai !== -1 ? row[idxTrangThai] : ""
        if (!isInventoryInStock(status)) continue
        inventoryInStock += 1
        if (idxGiaNhap !== -1) inventoryCost += toNumber(row[idxGiaNhap])
      }
    } catch (e) {
      console.warn("[dashboard] Không đọc được tồn kho:", e)
    }

    const dayAgg = new Map<string, DayAgg>()
    const monthAgg = new Map<string, MonthAgg>()

    try {
      const { header: bhHeader, rows: bhRows } = await readFromGoogleSheets(SHEETS.BAN_HANG)
      const idxIdDon = colIndex(bhHeader, "ID Đơn Hàng", "Mã Đơn Hàng", "ID", "Id", "id")
      const idxNgay = colIndex(bhHeader, "Ngày Bán", "Ngày bán", "Ngày Xuất", "ngay_ban")
      const idxTongThu = colIndex(bhHeader, "Tổng Thu", "Tong Thu")
      const idxGiaBan = colIndex(bhHeader, "Giá Bán", "Gia Ban")
      const idxLai = colIndex(bhHeader, "Lãi", "Lai")
      const idxLoaiDon = colIndex(bhHeader, "Loại Đơn", "Loai Don")
      const idxTrangThai = colIndex(bhHeader, "Trạng Thái", "Trang Thai", "trang_thai")

      for (const row of bhRows) {
        if (idxIdDon === -1 || idxNgay === -1) break
        if (idxTrangThai !== -1 && statusExcluded(row[idxTrangThai])) continue

        const orderId = String(row[idxIdDon] || "").trim()
        if (!orderId) continue

        const dateParts = parseVNDateParts(row[idxNgay])
        if (!dateParts) continue

        const dayKey = `${dateParts.day}/${dateParts.month}/${dateParts.year}`
        const monthKey = `${dateParts.month}/${dateParts.year}`
        const revenue =
          idxTongThu !== -1 && String(row[idxTongThu] || "").trim() !== ""
            ? toNumber(row[idxTongThu])
            : toNumber(row[idxGiaBan])
        const profit = idxLai !== -1 ? toNumber(row[idxLai]) : 0
        const isOnline = idxLoaiDon !== -1 ? isOnlineOrder(row[idxLoaiDon]) : false

        if (!dayAgg.has(dayKey)) dayAgg.set(dayKey, makeAgg())
        if (!monthAgg.has(monthKey)) monthAgg.set(monthKey, makeAgg())

        const dayEntry = dayAgg.get(dayKey)!
        const monthEntry = monthAgg.get(monthKey)!

        dayEntry.revenue += revenue
        dayEntry.profit += profit
        monthEntry.revenue += revenue
        monthEntry.profit += profit

        dayEntry.orders.add(orderId)
        monthEntry.orders.add(orderId)

        if (isOnline) {
          dayEntry.ordersOnl.add(orderId)
          monthEntry.ordersOnl.add(orderId)
        } else {
          dayEntry.ordersOff.add(orderId)
          monthEntry.ordersOff.add(orderId)
        }
      }
    } catch (e) {
      console.warn("[dashboard] Không đọc được Ban_Hang:", e)
    }

    const dailyNewCustomers = new Map<string, number>()
    const monthlyNewCustomers = new Map<string, number>()
    let totalCustomersAllTime = 0

    try {
      const { header: khHeader, rows: khRows } = await readFromGoogleSheets(SHEETS.KHACH_HANG)
      const idxNgayTao = colIndex(
        khHeader,
        "Ngày tạo",
        "Ngày Tạo",
        "Ngay Tao",
        "Ngay_Tao",
        "Created At",
        "created_at",
      )

      totalCustomersAllTime = khRows.filter((row) =>
        row.some((cell) => String(cell || "").trim() !== ""),
      ).length

      if (idxNgayTao !== -1) {
        for (const row of khRows) {
          const dateParts = parseVNDateParts(row[idxNgayTao])
          if (!dateParts) continue
          const dayKey = `${dateParts.day}/${dateParts.month}/${dateParts.year}`
          const monthKey = `${dateParts.month}/${dateParts.year}`
          dailyNewCustomers.set(dayKey, (dailyNewCustomers.get(dayKey) || 0) + 1)
          monthlyNewCustomers.set(monthKey, (monthlyNewCustomers.get(monthKey) || 0) + 1)
        }
      }
    } catch (e) {
      console.warn("[dashboard] Không đọc được Khach_Hang:", e)
    }

    const monthlyStats = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const key = `${month}/${reqYear}`
      const agg = monthAgg.get(key) || makeAgg()
      return {
        month: key,
        revenue: agg.revenue,
        profit: agg.profit,
        orders: agg.orders.size,
        customers: monthlyNewCustomers.get(key) || 0,
        ordersOnl: agg.ordersOnl.size,
        ordersOff: agg.ordersOff.size,
      }
    })

    const daysInMonth = new Date(reqYear, monthForView, 0).getDate()
    const dailyStats = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const key = `${day}/${monthForView}/${reqYear}`
      const agg = dayAgg.get(key) || makeAgg()
      return {
        date: key,
        revenue: agg.revenue,
        profit: agg.profit,
        orders: agg.orders.size,
        ordersOnl: agg.ordersOnl.size,
        ordersOff: agg.ordersOff.size,
        revenueOnl: 0,
        profitOnl: 0,
        revenueOff: 0,
        profitOff: 0,
        newCustomers: dailyNewCustomers.get(key) || 0,
      }
    })

    const selectedMonthKey = `${monthForView}/${reqYear}`
    const selectedMonthAgg = monthAgg.get(selectedMonthKey) || makeAgg()
    const todayAgg = dayAgg.get(todayKey) || makeAgg()
    const revenueYear = monthlyStats.reduce((sum, item) => sum + item.revenue, 0)
    const profitYear = monthlyStats.reduce((sum, item) => sum + item.profit, 0)
    const ordersYear = monthlyStats.reduce((sum, item) => sum + item.orders, 0)
    const customersYear = monthlyStats.reduce((sum, item) => sum + item.customers, 0)
    const onlYear = monthlyStats.reduce((sum, item) => sum + item.ordersOnl, 0)
    const offYear = monthlyStats.reduce((sum, item) => sum + item.ordersOff, 0)

    const result = {
      revenue: {
        monthly: selectedMonthAgg.revenue,
        today: todayAgg.revenue,
        yearly: revenueYear,
      },
      profit: {
        monthly: selectedMonthAgg.profit,
        today: todayAgg.profit,
        yearly: profitYear,
        lastYear: 0,
      },
      margin: {
        monthly: selectedMonthAgg.revenue > 0 ? Math.round((selectedMonthAgg.profit / selectedMonthAgg.revenue) * 100) : 0,
        yearly: revenueYear > 0 ? Math.round((profitYear / revenueYear) * 100) : 0,
      },
      orders: {
        monthly: selectedMonthAgg.orders.size,
        today: todayAgg.orders.size,
        yearly: ordersYear,
        onlYear,
        offYear,
      },
      products: {
        total: inventoryInStock,
        lowStock: 0,
        lowStockThreshold: 5,
      },
      inventory: {
        inStock: inventoryInStock,
        totalCost: inventoryCost,
      },
      customers: {
        total: totalCustomersAllTime,
        new: dailyNewCustomers.get(todayKey) || 0,
        yearly: customersYear,
      },
      dailyStats,
      monthlyStats,
    }

    const res = NextResponse.json(result)
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30")
    return res
  } catch (error) {
    console.error("[dashboard] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
