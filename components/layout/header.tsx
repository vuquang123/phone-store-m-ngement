"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, User, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthMe } from "@/hooks/use-auth-me"
import { useToast } from "@/hooks/use-toast"
import { ModeToggle } from "./mode-toggle"
import { NotificationsBell } from "./notifications-bell"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface HeaderProps {
  title: string
  onMenuClick?: () => void
}

// Tiêu đề hiển thị theo route (khớp tên mục sidebar) — khớp prefix cụ thể nhất trước
const PAGE_TITLES: [string, string][] = [
  ["/dashboard/ban-hang/don-hang", "Đơn hàng"],
  ["/dashboard/kho-hang", "Kho hàng"],
  ["/dashboard/ban-hang", "Bán hàng"],
  ["/dashboard/khach-hang", "Khách hàng"],
  ["/dashboard/hoan-tra", "Hoàn trả"],
  ["/dashboard/tien-mat", "Quỹ tiền mặt"],
  ["/dashboard/nhan-vien", "Nhân viên"],
  ["/dashboard/thong-bao", "Thông báo"],
  ["/dashboard/cai-dat", "Cài đặt"],
  ["/dashboard/huong-dan", "Hướng dẫn"],
  ["/dashboard", "Dashboard"],
]

export function Header({ title, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { me, isLoading, error } = useAuthMe()
  const [logoUrl, setLogoUrl] = useState<string>("")
  const { toast } = useToast()

  const pageTitle = useMemo(() => {
    const found = PAGE_TITLES.find(([p]) => pathname === p || pathname.startsWith(p + "/"))
    return found ? found[1] : title || "Dashboard"
  }, [pathname, title])

  useEffect(() => {
    if (!isLoading && (!me || error)) {
      toast({ title: "Phiên đăng nhập đã hết hạn", description: "Vui lòng đăng nhập lại" })
      router.replace("/auth/login")
    }
  }, [isLoading, me, error, router, toast])

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
    try { await fetch("/api/logout", { method: "POST" }) } catch {}
    localStorage.removeItem("auth_user")
    router.push("/auth/login")
  }

  const todayStr = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date())

  return (
    <header className="border-b border-border bg-sidebar/80 backdrop-blur-md supports-[backdrop-filter]:bg-sidebar/60 shadow-sm">
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Toggle sidebar: thu gọn ở desktop, mở drawer ở mobile */}
          <SidebarTrigger className="-ml-1 h-9 w-9 text-muted-foreground" />
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo cửa hàng"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-contain border border-border bg-background"
            />
          ) : null}
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              {pageTitle}
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">{todayStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ModeToggle />

          <NotificationsBell disabled={isLoading} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-accent" disabled={isLoading}>
                <UserAvatar
                  name={me?.name}
                  email={me?.email}
                  className="h-8 w-8 sm:h-9 sm:w-9 ring-2 ring-emerald-500/20"
                />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-64 p-2 z-[60]" align="end" forceMount sideOffset={8}>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-2">
                  <p className="text-sm font-semibold leading-none text-foreground">{me?.name || "Người dùng"}</p>
                  <p className="text-xs leading-none text-muted-foreground">{me?.email}</p>
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
                      <span className="text-xs text-muted-foreground">({me.role})</span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>

              {me?.role !== "nhan_vien" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/cai-dat")}
                    className="cursor-pointer hover:bg-accent"
                  >
                    <User className="mr-3 h-4 w-4" />
                    <span>Hồ sơ cá nhân</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/cai-dat")}
                    className="cursor-pointer hover:bg-accent"
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    <span>Cài đặt hệ thống</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
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
