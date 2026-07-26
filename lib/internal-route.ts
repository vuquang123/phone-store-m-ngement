import { timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"
import { getServerUser } from "./auth"
import { serverEnv } from "./env"

const ALLOWED_MANAGER_EMAIL = "dung8ahxh@gmail.com"

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function isInternalRequestAuthorized(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return true
  }

  const authHeader = request.headers.get("authorization") || ""
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim()
    const secret = serverEnv.cronSecret
    if (token && secret && safeCompare(token, secret)) {
      return true
    }
  }

  const user = getServerUser(request)
  return Boolean(
    user &&
    user.role === "quan_ly" &&
    String(user.email || "").trim().toLowerCase() === ALLOWED_MANAGER_EMAIL,
  )
}
