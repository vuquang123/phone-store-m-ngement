// Phiên đăng nhập tập trung: JWT ký HS256 (jose) lưu trong cookie httpOnly.
// Dùng chung cho middleware (verify ở Edge) + /api/login (ký) + /api/logout (xoá).
import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "session"

// Tên header danh tính được middleware TIÊM vào request (ghi đè giá trị client gửi).
// HDR_EMAIL trùng "x-user-email" để các route cũ đang đọc header này nhận giá trị tin cậy.
export const HDR_EMAIL = "x-user-email"
export const HDR_ROLE = "x-user-role"
export const HDR_NAME = "x-user-name"
export const HDR_EMPLOYEE = "x-employee-id"

export interface SessionUser {
  email: string
  role?: string
  name?: string
  employeeId?: string
}

const ALG = "HS256"
const MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 ngày

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Thiếu SESSION_SECRET — không thể ký/verify phiên đăng nhập.")
    }
    // Fallback CHỈ cho dev local (đặt SESSION_SECRET trong .env.local để an toàn).
    return new TextEncoder().encode("dev-insecure-session-secret-change-me-32++")
  }
  return new TextEncoder().encode(s)
}

export async function signSession(user: SessionUser): Promise<string> {
  return await new SignJWT({
    email: user.email,
    role: user.role ?? "",
    name: user.name ?? "",
    employeeId: user.employeeId ?? "",
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] })
    const email = typeof payload.email === "string" ? payload.email : ""
    if (!email) return null
    return {
      email,
      role: typeof payload.role === "string" ? payload.role : "",
      name: typeof payload.name === "string" ? payload.name : "",
      employeeId: typeof payload.employeeId === "string" ? payload.employeeId : "",
    }
  } catch {
    return null
  }
}

// Tham số cookie cho NextResponse.cookies.set(...)
export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  }
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }
}
