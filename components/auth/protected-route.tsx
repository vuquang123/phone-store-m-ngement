"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Nếu truyền, chỉ cho phép role này truy cập */
  requiredRole?: "quan_ly" | "nhan_vien"
}

/** Lấy headers xác thực từ localStorage (phù hợp sheets-auth của bạn) */
export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const userRaw = localStorage.getItem("auth_user")
  let email = ""
  try {
    const user = JSON.parse(userRaw || "{}")
    email = user?.email || ""
  } catch {
    email = ""
  }
  return email ? { "x-user-email": String(email) } : {}
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        // gọi API xác thực
        const res = await fetch("/api/auth/me", {
          headers: getAuthHeaders(),
          cache: "no-store",
        })

        if (!res.ok) {
          router.replace("/auth/login")
          return
        }

        const me = await res.json() // { id, email, role, status, ... }

        // chặn user bị disable
        if (me?.status && String(me.status).toLowerCase() !== "hoat_dong") {
          router.replace("/auth/login")
          return
        }

        // kiểm tra role nếu yêu cầu
        if (requiredRole && me?.role !== requiredRole) {
          router.replace("/dashboard")
          return
        }

        if (mounted) setIsAuthorized(true)
      } catch (e) {
        router.replace("/auth/login")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    checkAuth()
    return () => {
      mounted = false
    }
  }, [router, requiredRole])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAuthorized) return null

  return <>{children}</>
}
