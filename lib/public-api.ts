import { NextResponse } from "next/server"

const LOCALHOST_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
])

function isZaloOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin)
    if (protocol !== "https:") return false
    return hostname === "zalo.me" || hostname.endsWith(".zalo.me")
  } catch {
    return false
  }
}

export function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  if (LOCALHOST_ORIGINS.has(origin)) return origin
  if (isZaloOrigin(origin)) return origin
  return null
}

export function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = resolveAllowedOrigin(origin)
  const headers: HeadersInit = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-KEY",
    "Access-Control-Max-Age": "86400",
  }

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin
  }

  return headers
}

export function isValidApiKey(requestApiKey: string | null): boolean {
  const expectedApiKey = process.env.PUBLIC_API_KEY || process.env.ZALO_PUBLIC_API_KEY || ""
  if (!expectedApiKey) return false
  return requestApiKey === expectedApiKey
}

export function withCors(response: NextResponse, origin: string | null): NextResponse {
  const headers = corsHeaders(origin)
  Object.entries(headers).forEach(([key, value]) => {
    if (typeof value === "string") {
      response.headers.set(key, value)
    }
  })
  return response
}
