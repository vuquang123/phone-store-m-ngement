import { NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"
import {
  collectCashFlowReceivable,
  createCashFlowAccount,
  createCashFlowPayable,
  createCashFlowReceivable,
  createLongTermDebt,
  deleteCashFlowPayable,
  deleteCashFlowReceivable,
  deleteLongTermDebt,
  getCashFlowReportBySlug,
  getCashFlowDashboardDataFromSheets,
  maybeCreateDailyCashFlowReport,
  payCashFlowPayable,
  payLongTermDebt,
  updateCashFlowAccount,
  updateCashFlowPayable,
  updateCashFlowReceivable,
  updateLongTermDebt,
} from "@/lib/cash-flow/sheets"
import { getServerUser } from "@/lib/auth"

const ALLOWED_EMAIL = "dung8ahxh@gmail.com"
const REQUIRED_OTP = "216917"

function normalize(input: string) {
  return (input || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

async function isAllowedManager(email: string) {
  const { header, rows } = await readFromGoogleSheets("USERS")
  const normalizedHeader = header.map((item) => normalize(String(item)))
  const emailIdx = normalizedHeader.findIndex((item) => item === "email" || item === "e-mail")
  const roleIdx = normalizedHeader.findIndex((item) => item === "vai tro" || item === "role" || item === "quyen")
  if (emailIdx === -1 || roleIdx === -1) return false
  const user = rows.find((row) => normalize(String(row[emailIdx] || "")) === normalize(email))
  if (!user) return false
  return normalize(String(user[roleIdx] || "")) === "quan_ly"
}

async function authorize(request: NextRequest) {
  const user = getServerUser(request) || {
    email: request.headers.get("x-user-email") || "",
    role: request.headers.get("x-user-role") || "",
    name: request.headers.get("x-user-name") || "",
  }
  const otp = request.headers.get("x-dongtien-otp") || ""
  if (normalize(user.email || "") !== normalize(ALLOWED_EMAIL)) {
    throw new Error("Tài khoản không được phép truy cập module dòng tiền.")
  }
  if (otp !== REQUIRED_OTP) {
    throw new Error("OTP không hợp lệ.")
  }
  const ok = await isAllowedManager(user.email)
  if (!ok) {
    throw new Error("Chỉ quản lý mới được truy cập module dòng tiền.")
  }
  return user
}

export async function GET(request: NextRequest) {
  try {
    await authorize(request)
    const reportSlug = String(request.nextUrl.searchParams.get("reportSlug") || "").trim()
    if (reportSlug) {
      const report = await getCashFlowReportBySlug(reportSlug)
      if (!report) {
        return NextResponse.json({ error: "Chưa có báo cáo cho ngày này." }, { status: 404 })
      }
      return NextResponse.json({ success: true, report })
    }
    const data = await getCashFlowDashboardDataFromSheets()
    const latestReport = await maybeCreateDailyCashFlowReport(data)
    return NextResponse.json({ success: true, data, latestReportSlug: latestReport?.slug || null })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tải được dữ liệu dòng tiền"
    const status = message.includes("OTP") ? 401 : 403
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authorize(request)
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || "").trim()

    if (action === "create_account") {
      await createCashFlowAccount({
        name: String(body.name || "").trim(),
        type: String(body.type || "other").trim(),
        balance: Number(body.balance || 0),
        availability: String(body.availability || "AVAILABLE").trim(),
        note: String(body.note || "").trim(),
      })
    } else if (action === "update_account") {
      await updateCashFlowAccount({
        id: String(body.id || "").trim(),
        name: body.name,
        type: body.type,
        balance: body.balance !== undefined ? Number(body.balance) : undefined,
        availability: body.availability,
        note: body.note,
      })
    } else if (action === "create_receivable") {
      await createCashFlowReceivable({
        counterparty: String(body.counterparty || "").trim(),
        phone: String(body.phone || "").trim(),
        description: String(body.description || "").trim(),
        totalAmount: Number(body.totalAmount || 0),
        dueDate: String(body.dueDate || "").trim(),
        collectability: String(body.collectability || "medium").trim(),
        note: String(body.note || "").trim(),
        accountId: String(body.accountId || "").trim(),
      })
    } else if (action === "update_receivable") {
      await updateCashFlowReceivable({
        id: String(body.id || "").trim(),
        counterparty: body.counterparty,
        phone: body.phone,
        description: body.description,
        totalAmount: body.totalAmount !== undefined ? Number(body.totalAmount) : undefined,
        dueDate: body.dueDate,
        collectability: body.collectability,
        note: body.note,
      })
    } else if (action === "delete_receivable") {
      await deleteCashFlowReceivable(String(body.id || "").trim())
    } else if (action === "collect_receivable") {
      await collectCashFlowReceivable({
        id: String(body.id || "").trim(),
        amount: Number(body.amount || 0),
        accountId: String(body.accountId || "").trim(),
        note: String(body.note || "").trim(),
        actor: user.email,
      })
    } else if (action === "create_payable") {
      await createCashFlowPayable({
        creditor: String(body.creditor || "").trim(),
        type: String(body.type || "other").trim(),
        description: String(body.description || "").trim(),
        principalAmount: Number(body.principalAmount || 0),
        dueDate: String(body.dueDate || "").trim(),
        priority: String(body.priority || "medium").trim(),
        note: String(body.note || "").trim(),
        hasInterest: Boolean(body.hasInterest),
      })
    } else if (action === "update_payable") {
      await updateCashFlowPayable({
        id: String(body.id || "").trim(),
        creditor: body.creditor,
        type: body.type,
        description: body.description,
        principalAmount: body.principalAmount !== undefined ? Number(body.principalAmount) : undefined,
        dueDate: body.dueDate,
        priority: body.priority,
        note: body.note,
      })
    } else if (action === "delete_payable") {
      await deleteCashFlowPayable(String(body.id || "").trim())
    } else if (action === "pay_payable") {
      await payCashFlowPayable({
        id: String(body.id || "").trim(),
        amount: Number(body.amount || 0),
        accountId: String(body.accountId || "").trim(),
        note: String(body.note || "").trim(),
        actor: user.email,
      })
    } else if (action === "create_long_term_debt") {
      await createLongTermDebt({
        creditor: String(body.creditor || "").trim(),
        description: String(body.description || "").trim(),
        principalAmount: Number(body.principalAmount || 0),
        dueDate: String(body.dueDate || "").trim(),
        priority: String(body.priority || "medium").trim(),
        note: String(body.note || "").trim(),
      })
    } else if (action === "update_long_term_debt") {
      await updateLongTermDebt({
        id: String(body.id || "").trim(),
        creditor: body.creditor,
        description: body.description,
        principalAmount: body.principalAmount !== undefined ? Number(body.principalAmount) : undefined,
        dueDate: body.dueDate,
        priority: body.priority,
        note: body.note,
      })
    } else if (action === "delete_long_term_debt") {
      await deleteLongTermDebt(String(body.id || "").trim())
    } else if (action === "pay_long_term_debt") {
      await payLongTermDebt({
        id: String(body.id || "").trim(),
        amount: Number(body.amount || 0),
        note: String(body.note || "").trim(),
        actor: user.email,
      })
    } else {
      return NextResponse.json({ error: "Action không hợp lệ." }, { status: 400 })
    }

    const data = await getCashFlowDashboardDataFromSheets()
    return NextResponse.json({ success: true, by: user.email, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xử lý được yêu cầu dòng tiền"
    const status = message.includes("OTP") ? 401 : message.includes("không") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
