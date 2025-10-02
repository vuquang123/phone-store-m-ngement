"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Bell,
  LogOut,
  Smartphone,
  PackageOpen,
  UserCheck,
  RotateCcw,
  BookOpen,
} from "lucide-react"

type Role = "quan_ly" | "nhan_vien"

const getNavigation = () => [
  {
    title: "Tổng quan",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["quan_ly"] as Role[] }],
  },
  {
    title: "Quản lý kho",
    items: [
      { title: "Kho hàng", href: "/dashboard/kho-hang", icon: Package, roles: ["quan_ly", "nhan_vien"] as Role[] },
    ],
  },
  {
    title: "Bán hàng",
    items: [
      { title: "Bán hàng", href: "/dashboard/ban-hang", icon: ShoppingCart, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Đơn hàng", href: "/dashboard/ban-hang/don-hang", icon: ShoppingCart, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Khách hàng", href: "/dashboard/khach-hang", icon: Users, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Hoàn trả", href: "/dashboard/hoan-tra", icon: RotateCcw, roles: ["quan_ly", "nhan_vien"] as Role[] },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { title: "Nhân viên", href: "/dashboard/nhan-vien", icon: UserCheck, roles: ["quan_ly"] as Role[] },
      { title: "Thông báo", href: "/dashboard/thong-bao", icon: Bell, roles: ["quan_ly", "nhan_vien"] as Role[] },
  { title: "Cài đặt", href: "/dashboard/cai-dat", icon: Settings, roles: ["quan_ly"] as Role[] },
      { title: "Hướng dẫn", href: "/dashboard/huong-dan", icon: BookOpen, roles: ["quan_ly", "nhan_vien"] as Role[] },
    ],
  },
]

/** Lấy headers xác thực từ localStorage (phù hợp sheets-auth) */
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

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [role, setRole] = useState<Role>("nhan_vien")
  const [userName, setUserName] = useState<string>("")
  const [roleLoading, setRoleLoading] = useState(true)
  const [navLoading, setNavLoading] = useState(false)
  const [storeName, setStoreName] = useState("iPhone Lock Store")

  // lấy role từ API /api/auth/me
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
        if (!res.ok) {
          router.replace("/auth/login")
          return
        }
        const me = await res.json()
        if (mounted) {
          setRole((me?.role as Role) || "nhan_vien")
          if (typeof me?.name === "string" && me.name.trim()) setUserName(me.name.trim())
        }
      } catch {
        router.replace("/auth/login")
      } finally {
        if (mounted) setRoleLoading(false)
      }
    })()

    // load tên cửa hàng từ localStorage (nếu có)
    try {
      const saved = localStorage.getItem("store_settings")
      if (saved) {
        const s = JSON.parse(saved)
        if (s?.ten_cua_hang) setStoreName(s.ten_cua_hang)
      }
    } catch {}

    return () => {
      mounted = false
    }
  }, [router])

  const navigation = useMemo(() => {
    const base = getNavigation()
    return base
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles.includes(role)),
      }))
      .filter((s) => s.items.length > 0)
  }, [role])

  const handleLogout = () => {
    localStorage.removeItem("auth_user")
    router.push("/auth/login")
  }

  return (
    <div className={cn("pb-12 w-64 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center gap-3 mb-8 p-3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl shadow-lg">
            <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
              <Smartphone className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{storeName}</h2>
              <p className="text-xs text-white/80">
                {role === "quan_ly" ? "Quản lý cửa hàng" : (userName || "Nhân viên")}
              </p>
              <p className="text-xs text-white/60">{roleLoading ? "Đang tải..." : `Role: ${role}`}</p>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-6">
              {navigation.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <Button
                        key={item.href}
                        variant={pathname === item.href ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3 h-11 text-sm font-medium transition-all duration-200",
                          pathname === item.href
                            ? "bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-md hover:shadow-lg transform scale-[1.02]"
                            : "text-slate-700 hover:bg-slate-200/60 hover:text-slate-900 hover:translate-x-1",
                        )}
                        asChild
                        onClick={() => {
                          if (pathname !== item.href) {
                            setNavLoading(true)
                            setTimeout(() => setNavLoading(false), 120)
                          }
                        }}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-5 w-5" />
                          {item.title}
                          {navLoading && pathname !== item.href && (
                            <div className="ml-auto animate-spin rounded-full h-3 w-3 border-b border-current" />
                          )}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Separator className="my-4 bg-slate-300" />

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-11 text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 font-medium"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </Button>
        </div>
      </div>
    </div>
  )
}
