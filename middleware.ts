// ---------------------------------------------------------------------------
// Chốt chặn xác thực TẬP TRUNG cho toàn hệ thống.
//
// - Mọi /dashboard/* và /api/* (trừ danh sách công khai bên dưới) đều phải có
//   cookie phiên hợp lệ. Thiếu/sai => API trả 401, trang web redirect về login.
// - Khi hợp lệ: TIÊM danh tính đã xác thực vào header (ghi đè mọi giá trị client
//   tự gửi) => các route cũ đang đọc `x-user-email` giờ nhận giá trị ĐÁNG TIN,
//   không cần sửa từng route.
//
// Chạy ở Edge runtime nên chỉ verify JWT (jose) — nhanh, không gọi Sheets.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server"
import {
  SESSION_COOKIE,
  HDR_EMAIL,
  HDR_ROLE,
  HDR_NAME,
  HDR_EMPLOYEE,
  verifySession,
} from "@/lib/auth"

// API công khai (không cần đăng nhập):
const PUBLIC_API_EXACT = ["/api/login", "/api/logout", "/api/health"]

function isPublicApi(pathname: string): boolean {
  // Catalog cho Zalo Mini App — tự xác thực bằng API key riêng trong route.
  if (pathname.startsWith("/api/public")) return true
  return PUBLIC_API_EXACT.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith("/api")

  if (isApi && isPublicApi(pathname)) {
    return NextResponse.next()
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verifySession(token) : null

  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = new URL("/auth/login", req.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // HTTP header phải là ByteString (Latin1 0-255). Tên tiếng Việt có ký tự >255
  // (vd "Nguyễn") sẽ làm headers.set() throw -> encode khi cần (ASCII giữ nguyên).
  const headerSafe = (v: string) => {
    for (let i = 0; i < v.length; i++) if (v.charCodeAt(i) > 255) return encodeURIComponent(v)
    return v
  }

  // Hợp lệ: ghi đè TẤT CẢ header danh tính bằng giá trị từ token đã verify
  // (kể cả khi client cố gửi header giả, giá trị thật vẫn thắng).
  const headers = new Headers(req.headers)
  headers.set(HDR_EMAIL, headerSafe(user.email))
  headers.set(HDR_ROLE, headerSafe(user.role || ""))
  headers.set(HDR_NAME, headerSafe(user.name || ""))
  headers.set(HDR_EMPLOYEE, headerSafe(user.employeeId || ""))

  return NextResponse.next({ request: { headers } })
}

export const config = {
  // Chỉ chạy middleware cho 2 nhóm này; các route công khai loại trừ trong code.
  matcher: ["/dashboard/:path*", "/api/:path*"],
}
