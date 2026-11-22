"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthMe } from "@/hooks/use-auth-me"
import { useToast } from "@/hooks/use-toast"
import { isManagerRole, isOwnerRole } from "@/lib/roles"

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Nếu truyền, chỉ cho phép role này truy cập.
   *  "quan_ly" = quản lý hoặc chủ shop; "chu_shop" = chỉ chủ shop. */
  requiredRole?: "chu_shop" | "quan_ly" | "nhan_vien"
  /** Trang chuyển tới khi không đủ quyền (mặc định /dashboard, có báo lỗi). Truyền thì chuyển êm, không báo. */
  redirectTo?: string
}

function hasRole(role: unknown, required: "chu_shop" | "quan_ly" | "nhan_vien") {
  if (required === "chu_shop") return isOwnerRole(role)
  if (required === "quan_ly") return isManagerRole(role)
  return String(role ?? "") === required
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

export function ProtectedRoute({ children, requiredRole, redirectTo }: ProtectedRouteProps) {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { me, isLoading, error } = useAuthMe()

  useEffect(() => {
    if (isLoading) return
    if (!me || error) {
      toast({ title: "Phiên đăng nhập đã hết hạn", description: "Vui lòng đăng nhập lại" })
      router.replace("/auth/login")
      return
    }

    if (me?.status && String(me.status).toLowerCase() !== "hoat_dong") {
      toast({ title: "Tài khoản bị khóa", description: "Liên hệ quản lý để mở khóa" })
      router.replace("/auth/login")
      return
    }

    if (requiredRole && !hasRole(me?.role, requiredRole)) {
      if (redirectTo) {
        router.replace(redirectTo)
        return
      }
      toast({ title: "Không đủ quyền", description: "Bạn không thể truy cập trang này" })
      router.replace("/dashboard")
      return
    }

    setIsAuthorized(true)
  }, [isLoading, me, error, toast, router, requiredRole, redirectTo])

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
