"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, Settings, User, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
}

type Me = {
  id: string
  email: string
  name?: string
  role?: "quan_ly" | "nhan_vien"
  status?: string
}

/** Lấy headers xác thực (khớp sheets-auth) từ localStorage */
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("auth_user")
    const data = raw ? JSON.parse(raw) : {}
    if (typeof data?.email === "string") {
      return { "x-user-email": data.email }
    }
    return {}
  } catch {
    return {}
  }
}

export function Header({ title }: HeaderProps) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
        if (!res.ok) {
          router.replace("/auth/login")
          return
        }
        const data = (await res.json()) as Me
        if (mounted) setMe(data)
      } catch (e) {
        router.replace("/auth/login")
      } finally {
        if (mounted) setIsLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [router])

  const handleLogout = async () => {
    // Xóa thông tin đăng nhập cục bộ (tùy bạn muốn giữ store_settings hay không)
    localStorage.removeItem("auth_user")
    router.push("/auth/login")
  }

  const todayStr = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date())

  const initials =
    (me?.name &&
      me.name
        .split(" ")
        .filter(Boolean)
        .map((s) => s[0])
        .join("")
        .toUpperCase()) ||
    me?.email?.[0]?.toUpperCase() ||
    "U"

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{todayStr}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 rounded-full hover:bg-slate-100 transition-colors"
            disabled={isLoading}
          >
            <Bell className="h-5 w-5 text-slate-600" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-slate-100" disabled={isLoading}>
                <Avatar className="h-9 w-9 ring-2 ring-emerald-500/20">
                  <AvatarImage src="/placeholder.svg" alt="Avatar" />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-64 p-2 z-50" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-2">
                  <p className="text-sm font-semibold leading-none text-slate-900">{me?.name || "Người dùng"}</p>
                  <p className="text-xs leading-none text-slate-500">{me?.email}</p>
                  {me?.role && (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                          me.role === "quan_ly" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800",
                        )}
                      >
                        {me.role === "quan_ly" ? "Quản lý" : "Nhân viên"}
                      </span>
                      <span className="text-xs text-slate-400">({me.role})</span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard/cai-dat")} className="cursor-pointer hover:bg-slate-50">
                <User className="mr-3 h-4 w-4" />
                <span>Hồ sơ cá nhân</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/cai-dat")} className="cursor-pointer hover:bg-slate-50">
                <Settings className="mr-3 h-4 w-4" />
                <span>Cài đặt hệ thống</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span>Đăng xuất</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
