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
import { Bell, Settings, User, LogOut, Menu } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeaderProps {
  title: string
  onMenuClick?: () => void
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

export function Header({ title, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState<string>("")

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

  const loadLogoFromStorage = () => {
    try {
      const saved = localStorage.getItem("store_settings")
      if (saved) {
        const s = JSON.parse(saved)
        if (s && typeof s.logo_url === "string") {
          let url = s.logo_url as string
          if (url.startsWith("/public/")) url = url.replace(/^\/public/, "")
          setLogoUrl(url)
          return
        }
      }
      setLogoUrl("")
    } catch {
      setLogoUrl("")
    }
  }

  // Load logo URL from localStorage (store_settings) and subscribe to changes
  useEffect(() => {
    loadLogoFromStorage()
    const onStorage = (e: StorageEvent) => {
      if (e.key === "store_settings") loadLogoFromStorage()
    }
    const onCustom = () => loadLogoFromStorage()
    window.addEventListener("storage", onStorage)
    window.addEventListener("store_settings_changed", onCustom as EventListener)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("store_settings_changed", onCustom as EventListener)
    }
  }, [])

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
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          {onMenuClick && (
            <button
              aria-label="Mở menu"
              className="mr-1 inline-flex sm:hidden items-center justify-center h-9 w-9 rounded-md border border-slate-200 hover:bg-slate-50 active:scale-95 transition"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </button>
          )}
          {logoUrl && title !== "Dashboard" ? (
            <img
              src={logoUrl}
              alt="Logo cửa hàng"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-contain border border-slate-200 bg-white"
            />
          ) : null}
          <div>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="hidden sm:block text-xs text-slate-500 mt-0.5">{todayStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-slate-100 transition-colors"
            disabled={isLoading}
          >
            <Bell className="h-5 w-5 text-slate-600" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-slate-100" disabled={isLoading}>
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 ring-2 ring-emerald-500/20">
                  <AvatarImage src="/placeholder.svg" alt="Avatar" />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-blue-500 text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-64 p-2 z-[60]" align="end" forceMount sideOffset={8}>
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

              {me?.role !== "nhan_vien" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/cai-dat")}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <User className="mr-3 h-4 w-4" />
                    <span>Hồ sơ cá nhân</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/cai-dat")}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    <span>Cài đặt hệ thống</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
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
