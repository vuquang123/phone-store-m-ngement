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

// Cache thông tin /api/auth/me để tránh gọi lại mỗi lần mở Drawer
const ME_CACHE_KEY = "auth_me_cache_v1"
const ME_CACHE_TTL = 5 * 60 * 1000 // 5 phút

type MeCache = { role: Role; name?: string; ts: number }

function readMeCache(): MeCache | null {
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw) as MeCache
    if (!obj || typeof obj.ts !== "number") return null
    if (Date.now() - obj.ts > ME_CACHE_TTL) return null
    return obj
  } catch {
    return null
  }
}

function writeMeCache(data: { role: Role; name?: string }) {
  try {
    const payload: MeCache = { role: data.role, name: data.name, ts: Date.now() }
    localStorage.setItem(ME_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
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
  const [logoUrl, setLogoUrl] = useState<string>("")

  // lấy role từ API /api/auth/me
  useEffect(() => {
    let mounted = true
    // 1) Dùng cache nếu còn hạn để hiển thị ngay
    const cached = readMeCache()
    if (cached && mounted) {
      setRole(cached.role)
      if (cached.name) setUserName(cached.name)
      setRoleLoading(false)
      // 2) Làm mới cache nền (không chặn UI) nếu gần hết hạn
      ;(async () => {
        try {
          const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
          if (!res.ok) return
          const me = await res.json()
          if (!mounted) return
          // Cập nhật cache nếu role hoặc name thay đổi
          writeMeCache({ role: (me?.role as Role) || "nhan_vien", name: typeof me?.name === "string" ? me.name : undefined })
          // Không cần set state lần nữa để tránh nháy UI; chỉ cập nhật nếu khác biệt lớn
        } catch {
          // ignore trong nền
        }
      })()
    } else {
      // 3) Không có cache: gọi API rồi lưu cache
      ;(async () => {
        try {
          const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
          if (!res.ok) {
            router.replace("/auth/login")
            return
          }
          const me = await res.json()
          if (mounted) {
            const nextRole = (me?.role as Role) || "nhan_vien"
            const nextName = typeof me?.name === "string" && me.name.trim() ? me.name.trim() : undefined
            setRole(nextRole)
            if (nextName) setUserName(nextName)
            writeMeCache({ role: nextRole, name: nextName })
          }
        } catch {
          router.replace("/auth/login")
        } finally {
          if (mounted) setRoleLoading(false)
        }
      })()
    }

    const loadStore = () => {
      try {
        const saved = localStorage.getItem("store_settings")
        if (saved) {
          const s = JSON.parse(saved)
          if (s?.ten_cua_hang) setStoreName(s.ten_cua_hang)
          if (s && typeof s.logo_url === "string") {
            let url = s.logo_url as string
            if (url.startsWith("/public/")) url = url.replace(/^\/public/, "")
            setLogoUrl(url)
          } else {
            setLogoUrl("")
          }
        } else {
          setLogoUrl("")
        }
      } catch {
        setLogoUrl("")
      }
    }

    // load lần đầu
    loadStore()

    const onStorage = (e: StorageEvent) => {
      if (e.key === "store_settings") loadStore()
    }
    const onCustom = () => loadStore()
    window.addEventListener("storage", onStorage)
    window.addEventListener("store_settings_changed", onCustom as EventListener)

    return () => {
      mounted = false
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("store_settings_changed", onCustom as EventListener)
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
    localStorage.removeItem(ME_CACHE_KEY)
    router.push("/auth/login")
  }

  return (
    <div className={cn("pb-12 w-64 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center gap-3 mb-8 p-3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl shadow-lg">
            <div className="h-9 w-9 rounded-md overflow-hidden bg-white shadow-sm">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <img src="/apple-touch-icon.png" alt="DEV PỒ Logo" className="h-full w-full object-cover" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{storeName}</h2>
              <p className="text-xs text-white/80">
                {role === "quan_ly" ? "Quản lý cửa hàng" : (userName || "Nhân viên")}
              </p>
              <p className="text-xs text-white/60">{roleLoading ? "Đang tải..." : `Role: ${role}`}</p>
            </div>
          </div>

          <ScrollArea className="h-[calc(100dvh-180px)]">
            <div
              className="space-y-6 pb-28"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
            >
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
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
