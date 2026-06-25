// ---------------------------------------------------------------------------
// Lớp phiên đăng nhập (session) — KHÔNG import bcrypt để an toàn cho Edge runtime
// (middleware chạy ở Edge và chỉ cần verify JWT, không cần đụng tới bcrypt/Sheets).
//
// THIẾT KẾ:
// - Phiên = JWT ký HS256, đặt trong cookie httpOnly => JavaScript phía client
//   KHÔNG đọc/sửa được, và không thể giả mạo như header x-user-email trước đây.
// - Stateless: không cần lưu session vào Google Sheets.
// - middleware.ts verify cookie ở MỌI request rồi "tiêm" danh tính đã xác thực
//   vào header (x-user-email/x-user-role/...) để các route đọc an toàn.
// ---------------------------------------------------------------------------

import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "ps_session"

// Tên header chứa danh tính ĐÃ XÁC THỰC (do middleware tiêm vào).
export const HDR_EMAIL = "x-user-email"
export const HDR_ROLE = "x-user-role"
export const HDR_NAME = "x-user-name"
export const HDR_EMPLOYEE = "x-user-employee-id"

// Thời hạn phiên. Hạ xuống "1d" / "12h" nếu muốn việc khoá tài khoản có hiệu
// lực nhanh hơn (xem ghi chú "Cửa sổ khoá tài khoản" trong hướng dẫn).
export const TOKEN_TTL = "7d"
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

export type SessionUser = {
  email: string
  role: string
  name?: string
  employeeId?: string
}

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET || process.env.JWT_SECRET
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET chưa cấu hình (tối thiểu 16 ký tự). Thêm vào .env.local rồi khởi động lại server.",
    )
  }
  return new TextEncoder().encode(s)
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    role: user.role,
    name: user.name ?? "",
    employeeId: user.employeeId ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.email)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    const email = String(payload.sub || "")
    if (!email) return null
    return {
      email,
      role: String((payload as any).role || ""),
      name: String((payload as any).name || ""),
      employeeId: String((payload as any).employeeId || ""),
    }
  } catch {
    return null
  }
}

/**
 * Đọc danh tính đã được middleware xác thực + tiêm vào header. Dùng trong API
 * route handler khi cần biết "ai đang thao tác" (vd ghi log, gán người bán).
 *
 * Lưu ý: an toàn vì các header này LUÔN bị middleware ghi đè bằng giá trị lấy
 * từ JWT đã verify — client không thể tự gửi header giả để qua mặt.
 */
// Middleware encode header có ký tự >255 (tên tiếng Việt) bằng encodeURIComponent.
// Giải mã lại khi đọc để có giá trị gốc ("D%C5%A9ng" -> "Dũng").
function headerDecode(v: string | null): string | undefined {
  if (v == null) return undefined
  try {
    return /%[0-9A-Fa-f]{2}/.test(v) ? decodeURIComponent(v) : v
  } catch {
    return v
  }
}

export function getServerUser(req: { headers: Headers }): SessionUser | null {
  const email = headerDecode(req.headers.get(HDR_EMAIL))
  if (!email) return null
  return {
    email,
    role: headerDecode(req.headers.get(HDR_ROLE)) || "",
    name: headerDecode(req.headers.get(HDR_NAME)) || undefined,
    employeeId: headerDecode(req.headers.get(HDR_EMPLOYEE)) || undefined,
  }
}
