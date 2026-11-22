// app/api/quan-tri/tong-quan/route.ts
// Số liệu cho trang "Tổng quan" (Quản trị dữ liệu): tồn kho, tuổi kho, tốc độ bán,
// các dòng cần kiểm tra, bán hàng hôm nay, và nợ phải trả (nợ đầu hàng) / khách còn nợ.
// Chỉ QUẢN LÝ. Tính trực tiếp từ dữ liệu hiện tại mỗi lần mở trang.
import { type NextRequest, NextResponse } from "next/server"
import { DateTime } from "luxon"
import { getServerUser } from "@/lib/auth"
import { readFromGoogleSheets, colIndex } from "@/lib/google-sheets"
import { parseVietnameseNumber } from "@/lib/number"
import { createCashFlowPayable, payCashFlowPayable, updateCashFlowPayable } from "@/lib/cash-flow/sheets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ZONE = "Asia/Ho_Chi_Minh"
const num = (v: unknown) => parseVietnameseNumber(v)
const str = (v: unknown) => String(v ?? "").trim()
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim()

function today() {
  return DateTime.now().setZone(ZONE).startOf("day")
}

/** Đọc ngày kiểu Sheet: 8/10/2026, 08/10/2026, 2026-10-08, "16:45:12 22/11/2026", ISO. */
function parseDay(raw: unknown): DateTime | null {
  const s = str(raw)
  if (!s) return null
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const d = DateTime.fromObject({ day: +m[1], month: +m[2], year: +m[3] }, { zone: ZONE })
    return d.isValid ? d.startOf("day") : null
  }
  const iso = DateTime.fromISO(s.slice(0, 10), { zone: ZONE })
  return iso.isValid ? iso.startOf("day") : null
}

const PRO_129_YEARS: Record<number, number> = { 1: 2015, 2: 2017, 3: 2018, 4: 2020, 5: 2021, 6: 2022 }
const PRO_11_YEARS: Record<number, number> = { 1: 2018, 2: 2020, 3: 2021, 4: 2022 }

/** Gom các cách gõ tên khác nhau về một tên: "iPad Air (3rd generation)" -> "iPad Air 3". */
function normName(raw: string) {
  let s = str(raw).replace(/\s+/g, " ")
  s = s.replace(/\b(MDM|TEST)\b/gi, "").replace(/\s+/g, " ").trim()
  s = s.replace(/^iphone/i, "iPhone").replace(/^ipad/i, "iPad")
  s = s.replace(/(\d)(Plus|Pro|Max|Mini)\b/gi, "$1 $2")
  s = s.replace(/\bpro max\b/i, "Pro Max").replace(/\bplus\b/i, "Plus").replace(/\bmini\b/i, "mini").replace(/\bair\b/i, "Air")
  if (/^iPad Pro/i.test(s)) {
    const size = /12[.,]9/.test(s) ? "12.9" : /\b11\b/.test(s) ? "11" : /10[.,]5/.test(s) ? "10.5" : /9[.,]7/.test(s) ? "9.7" : ""
    let year = Number((s.match(/\b(20\d\d)\b/) || [])[1] || 0)
    const gen = Number((s.match(/\((\d)(st|nd|rd|th) generation\)/i) || [])[1] || 0)
    if (!year && gen) year = (size === "11" ? PRO_11_YEARS : PRO_129_YEARS)[gen] || 0
    if (size) return `iPad Pro ${size}${year ? ` (${year})` : ""}`
  }
  s = s.replace(/^iPad (Air|mini) \((\d+)(st|nd|rd|th) generation\)/i, (_, a, n) => `iPad ${a} ${n}`)
  s = s.replace(/^iPad \((\d+)(st|nd|rd|th) generation\)/i, (_, n) => `iPad Gen ${n}`)
  return s.trim()
}

function normCap(raw: string) {
  return str(raw).toUpperCase().replace(/\s+/g, "")
}

function iphoneType(raw: string) {
  const f = fold(raw)
  if (!f) return ""
  if (f.includes("lock")) return "Lock"
  if (f.includes("quoc te") || f === "qt") return "Quốc tế"
  return str(raw)
}

function categoryOf(name: string) {
  if (/^iphone/i.test(name)) return "iPhone"
  if (/^ipad/i.test(name)) return "iPad"
  return "Khác"
}

function groupKey(name: string, cap: string, type: string) {
  const cat = categoryOf(name)
  return [name, cap, cat === "iPhone" ? iphoneType(type) : ""].filter(Boolean).join(" ")
}

function guard(req: NextRequest) {
  const user = getServerUser(req)
  if (!user) return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) }
  if (user.role !== "quan_ly") return { error: NextResponse.json({ error: "Chỉ quản lý mới xem được" }, { status: 403 }) }
  return { user }
}

async function safeRead(sheet: string) {
  try {
    return await readFromGoogleSheets(sheet, undefined, { force: true })
  } catch {
    return { header: [] as string[], rows: [] as string[][] }
  }
}

const PAYABLE_TYPE_LABEL: Record<string, string> = {
  inventory_payable: "Nợ đầu hàng",
  supplier: "Nhà cung cấp",
  external_debt: "Nợ ngoài",
  loan: "Vay",
  interest: "Lãi vay",
  rent: "Tiền nhà",
  salary: "Lương",
  operating_cost: "Chi phí",
  other: "Khác",
}

/* ================================ GET ================================ */
export async function GET(req: NextRequest) {
  const g = guard(req)
  if (g.error) return g.error
  try {
    const [kho, ban, pay, recv, acc] = await Promise.all([
      safeRead("Kho_Hang"),
      safeRead("Ban_Hang"),
      safeRead("DongTien_PhaiTra"),
      safeRead("DongTien_CongNoThu"),
      safeRead("DongTien_NguonTien"),
    ])
    const now = today()

    /* ---------- bán hàng ---------- */
    const B = ban.header
    const bi = {
      code: colIndex(B, "Mã đơn hàng", "Mã Đơn Hàng"),
      date: colIndex(B, "Ngày bán"),
      name: colIndex(B, "Tên Sản Phẩm"),
      type: colIndex(B, "Loại Máy"),
      cap: colIndex(B, "Dung Lượng"),
      imei: colIndex(B, "IMEI"),
      serial: colIndex(B, "Serial"),
      price: colIndex(B, "Giá Bán"),
      total: colIndex(B, "Tổng Thu"),
      profit: colIndex(B, "Lãi"),
      status: colIndex(B, "Trạng Thái"),
    }
    const at = (r: string[], i: number) => (i === -1 ? "" : str(r[i]))
    const sales = ban.rows
      .filter((r) => at(r, bi.name) && !fold(at(r, bi.status)).includes("hoan tra"))
      .map((r) => {
        const d = parseDay(at(r, bi.date))
        const name = normName(at(r, bi.name))
        return {
          code: at(r, bi.code),
          day: d,
          age: d ? Math.round(now.diff(d, "days").days) : null,
          key: groupKey(name, normCap(at(r, bi.cap)), at(r, bi.type)),
          ids: [at(r, bi.imei), at(r, bi.serial)].map((x) => x.toUpperCase()).filter((x) => x.length >= 5),
          revenue: num(at(r, bi.total)) || num(at(r, bi.price)),
          profit: num(at(r, bi.profit)),
        }
      })
    const salesSummary = (days: number) => {
      const l = sales.filter((s) => s.age !== null && s.age >= 0 && s.age < days)
      return { orders: l.length, revenue: l.reduce((a, s) => a + s.revenue, 0), profit: l.reduce((a, s) => a + s.profit, 0) }
    }
    const sold30 = new Map<string, number>()
    for (const s of sales) if (s.age !== null && s.age >= 0 && s.age < 30) sold30.set(s.key, (sold30.get(s.key) || 0) + 1)
    const soldById = new Map<string, { code: string; day: DateTime | null }>()
    for (const s of sales) for (const id of s.ids) soldById.set(id, { code: s.code, day: s.day })

    /* ---------- kho ---------- */
    const K = kho.header
    const ki = {
      id: colIndex(K, "ID Máy"),
      date: colIndex(K, "Ngày Nhập"),
      name: colIndex(K, "Tên Sản Phẩm"),
      type: colIndex(K, "Loại Máy"),
      cap: colIndex(K, "Dung Lượng"),
      pin: colIndex(K, "Pin (%)"),
      color: colIndex(K, "Màu Sắc"),
      imei: colIndex(K, "IMEI"),
      serial: colIndex(K, "Serial"),
      cond: colIndex(K, "Tình Trạng Máy"),
      cost: colIndex(K, "Giá nhập", "Giá Nhập"),
      price: colIndex(K, "Giá Bán"),
      status: colIndex(K, "Trạng Thái"),
      source: colIndex(K, "Nguồn nhập"),
    }
    const stockRows = kho.rows.filter((r) => {
      if (!at(r, ki.name)) return false
      const st = fold(at(r, ki.status))
      return st === "" || st === "con hang"
    })
    const idCount = new Map<string, Set<string>>()
    const serialCount = new Map<string, number>()
    for (const r of stockRows) {
      const id = at(r, ki.id)
      const ser = (at(r, ki.imei) || at(r, ki.serial)).toUpperCase()
      if (id) idCount.set(id, (idCount.get(id) || new Set()).add(ser || Math.random().toString()))
      if (ser) serialCount.set(ser, (serialCount.get(ser) || 0) + 1)
    }
    const items = stockRows.map((r) => {
      const d = parseDay(at(r, ki.date))
      const name = normName(at(r, ki.name))
      const cat = categoryOf(name)
      const cap = normCap(at(r, ki.cap))
      const cond = at(r, ki.cond)
      let type = at(r, ki.type)
      if (cat === "iPhone") type = iphoneType(type)
      else if (!type) type = /4g|cellular/i.test(cond) ? "4G" : /wifi/i.test(cond) ? "Wifi" : ""
      else if (/cellular/i.test(type)) type = "4G"
      const cost = num(at(r, ki.cost))
      const priceRaw = at(r, ki.price)
      const price = priceRaw ? num(priceRaw) : null
      const imei = at(r, ki.imei)
      const serial = at(r, ki.serial)
      const flags: string[] = []
      if (!at(r, ki.status)) flags.push("Trống cột Trạng Thái")
      if (!price) flags.push("Chưa có giá bán")
      if (!cost) flags.push("Chưa có giá nhập")
      if (!d) flags.push("Thiếu/sai Ngày Nhập")
      if (price && cost && price < cost) flags.push("Giá bán thấp hơn giá nhập")
      const id = at(r, ki.id)
      if (id && (idCount.get(id)?.size || 0) > 1) flags.push("Trùng ID Máy với máy khác")
      const ser = (imei || serial).toUpperCase()
      if (ser && (serialCount.get(ser) || 0) > 1) flags.push("IMEI/Serial nhập 2 lần (có thể trùng dòng)")
      for (const x of [imei, serial].map((v) => v.toUpperCase()).filter((v) => v.length >= 5)) {
        const sold = soldById.get(x)
        if (sold && (!d || !sold.day || sold.day >= d)) {
          flags.push(`Đã có đơn bán ${sold.code || ""}${sold.day ? ` ngày ${sold.day.toFormat("d/M/yyyy")}` : ""} nhưng vẫn nằm trong kho`.replace(/\s+/g, " "))
          break
        }
      }
      return {
        id,
        date: d ? d.toISODate() : "",
        age: d ? Math.max(0, Math.round(now.diff(d, "days").days)) : 0,
        name,
        cat,
        type,
        cap,
        pin: at(r, ki.pin),
        color: at(r, ki.color),
        imei,
        serial,
        cond,
        cost,
        price,
        source: at(r, ki.source),
        key: groupKey(name, cap, at(r, ki.type)),
        flags,
      }
    })

    const groupsMap = new Map<string, any>()
    for (const it of items) {
      const g0 = groupsMap.get(it.key) || { key: it.key, cat: it.cat, n: 0, cost: 0, price: 0, priced: 0, pricedCost: 0, ageSum: 0, maxAge: 0 }
      g0.n++
      g0.cost += it.cost
      if (it.price) {
        g0.price += it.price
        g0.priced++
        g0.pricedCost += it.cost
      }
      g0.ageSum += it.age
      g0.maxAge = Math.max(g0.maxAge, it.age)
      groupsMap.set(it.key, g0)
    }
    const groups = [...groupsMap.values()].map((g0) => {
      const s30 = sold30.get(g0.key) || 0
      return {
        key: g0.key,
        cat: g0.cat,
        n: g0.n,
        cost: g0.cost,
        price: g0.price,
        profit: g0.price - g0.pricedCost,
        avgAge: Math.round(g0.ageSum / g0.n),
        maxAge: g0.maxAge,
        sold30: s30,
        cover: s30 ? Math.round((g0.n / s30) * 30) : null,
      }
    })

    /* ---------- nợ phải trả ---------- */
    const P = pay.header
    const pi = (n: string) => colIndex(P, n)
    const payables = pay.rows
      .filter((r) => str(r[pi("ID")]))
      .map((r) => {
        const principal = num(r[pi("Số Tiền Gốc")])
        const paid = num(r[pi("Đã Thanh Toán")])
        const remaining = Math.max(0, principal - paid)
        const due = parseDay(r[pi("Hạn Thanh Toán")])
        const daysLeft = due ? Math.round(due.diff(now, "days").days) : null
        const type = str(r[pi("Loại Nợ")]) || "other"
        const stored = str(r[pi("Trạng Thái")]).toUpperCase()
        const closed = remaining <= 0 || stored === "PAID"
        let state: "paid" | "overdue" | "today" | "soon" | "later" | "nodate"
        if (closed) state = "paid"
        else if (daysLeft === null) state = "nodate"
        else if (daysLeft < 0) state = "overdue"
        else if (daysLeft === 0) state = "today"
        else if (daysLeft <= 7) state = "soon"
        else state = "later"
        return {
          id: str(r[pi("ID")]),
          creditor: str(r[pi("Chủ Nợ")]) || "(chưa ghi tên)",
          type,
          typeLabel: PAYABLE_TYPE_LABEL[type] || type,
          description: str(r[pi("Nội Dung")]),
          principal,
          paid,
          remaining: closed ? 0 : remaining,
          incurredAt: parseDay(r[pi("Ngày Phát Sinh")])?.toISODate() || "",
          dueDate: due?.toISODate() || "",
          daysLeft,
          state,
          hasInterest: ["true", "1", "x", "có"].includes(fold(str(r[pi("Có Tính Lãi")]))),
          note: str(r[pi("Ghi Chú")]),
        }
      })

    /* ---------- khách còn nợ ---------- */
    const R = recv.header
    const ri = (n: string) => colIndex(R, n)
    const receivables = recv.rows
      .filter((r) => str(r[ri("ID")]))
      .map((r) => {
        const total = num(r[ri("Tổng Phải Thu")])
        const got = num(r[ri("Đã Thu")])
        const st = str(r[ri("Trạng Thái")]).toUpperCase()
        const remaining = st === "COLLECTED" || st === "CANCELLED" ? 0 : Math.max(0, total - got)
        const due = parseDay(r[ri("Ngày Hẹn Thanh Toán")])
        return {
          id: str(r[ri("ID")]),
          who: str(r[ri("Đối Tượng")]) || "(chưa ghi tên)",
          phone: str(r[ri("Số Điện Thoại")]),
          content: str(r[ri("Nội Dung")]),
          remaining,
          dueDate: due?.toISODate() || "",
          daysLeft: due ? Math.round(due.diff(now, "days").days) : null,
        }
      })
      .filter((x) => x.remaining > 0)

    /* ---------- nguồn tiền ---------- */
    const A = acc.header
    const ai = (n: string) => colIndex(A, n)
    const accounts = acc.rows
      .filter((r) => str(r[ai("ID")]))
      .map((r) => ({ id: str(r[ai("ID")]), name: str(r[ai("Tên Nguồn")]), balance: num(r[ai("Số Dư")]) }))

    return NextResponse.json({
      asOf: now.toISODate(),
      generatedAt: new Date().toISOString(),
      sales: { today: salesSummary(1), d7: salesSummary(7), d30: salesSummary(30) },
      items,
      groups,
      payables,
      receivables,
      accounts,
    })
  } catch (e: any) {
    console.error("[tong-quan]", e)
    return NextResponse.json({ error: e?.message || "Không tải được số liệu" }, { status: 500 })
  }
}

/* ================================ POST ================================ */
// Thêm khoản nợ / sửa khoản nợ / ghi trả nợ. Dùng chung logic với module Dòng tiền
// (ghi vào DongTien_PhaiTra, trả nợ thì trừ tiền ở nguồn tiền và ghi DongTien_GiaoDich).
export async function POST(req: NextRequest) {
  const g = guard(req)
  if (g.error) return g.error
  const user = g.user!
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 })
  }
  const dueOk = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(str(s))
  try {
    if (body.action === "add_payable") {
      const creditor = str(body.creditor)
      const amount = Math.round(num(body.principalAmount))
      if (!creditor) return NextResponse.json({ error: "Nhập tên đầu hàng / chủ nợ" }, { status: 400 })
      if (amount <= 0) return NextResponse.json({ error: "Số tiền nợ phải lớn hơn 0" }, { status: 400 })
      if (!dueOk(body.dueDate)) return NextResponse.json({ error: "Chọn ngày trả dự kiến" }, { status: 400 })
      await createCashFlowPayable({
        creditor,
        type: str(body.type) || "inventory_payable",
        description: str(body.description),
        principalAmount: amount,
        dueDate: str(body.dueDate),
        note: str(body.note),
      })
      return NextResponse.json({ ok: true })
    }
    if (body.action === "update_payable") {
      const id = str(body.id)
      if (!id) return NextResponse.json({ error: "Thiếu mã khoản nợ" }, { status: 400 })
      if (body.dueDate !== undefined && !dueOk(body.dueDate)) {
        return NextResponse.json({ error: "Ngày trả không hợp lệ" }, { status: 400 })
      }
      await updateCashFlowPayable({
        id,
        creditor: body.creditor !== undefined ? str(body.creditor) : undefined,
        description: body.description !== undefined ? str(body.description) : undefined,
        principalAmount: body.principalAmount !== undefined ? Math.round(num(body.principalAmount)) : undefined,
        dueDate: body.dueDate !== undefined ? str(body.dueDate) : undefined,
        note: body.note !== undefined ? str(body.note) : undefined,
      })
      return NextResponse.json({ ok: true })
    }
    if (body.action === "pay_payable") {
      await payCashFlowPayable({
        id: str(body.id),
        amount: Math.round(num(body.amount)),
        accountId: str(body.accountId),
        note: str(body.note),
        actor: user.email,
      })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi máy chủ" }, { status: 400 })
  }
}
