"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Settings,
  Bell,
  LogOut,
  UserCheck,
  RotateCcw,
  BookOpen,
  Receipt,
  Wallet,
  Truck,
  StickyNote,
  ClipboardList,
  Table2,
  Landmark,
} from "lucide-react"
import { useAuthMe } from "@/hooks/use-auth-me"
import { useBranchBrand } from "@/components/layout/branch-brand"
import { Layers2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { NavPendingReporter } from "./nav-loading"

type Role = "chu_shop" | "quan_ly" | "nhan_vien"

const getNavigation = () => [
  {
    title: "Tổng quan",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["quan_ly"] as Role[] },
      // Bàn giao ca: nhân viên mở đầu ca để biết ca trước làm gì, còn việc gì.
      { title: "Tổng kết ca", href: "/nhanvien/dashboard", icon: ClipboardList, roles: ["quan_ly", "nhan_vien"] as Role[] },
    ],
  },
  {
    title: "Bán hàng",
    items: [
      // Kho hàng đã gộp vào trang Bán hàng (1 bảng máy + 1 bộ lọc dùng chung).
      { title: "Bán hàng & Kho", href: "/dashboard/ban-hang", icon: ShoppingCart, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Đơn hàng", href: "/dashboard/ban-hang/don-hang", icon: Receipt, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Đơn online", href: "/dashboard/don-online", icon: Truck, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Khách hàng", href: "/dashboard/khach-hang", icon: Users, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Quỹ tiền mặt", href: "/dashboard/tien-mat", icon: Wallet, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Hoàn trả", href: "/dashboard/hoan-tra", icon: RotateCcw, roles: ["quan_ly", "nhan_vien"] as Role[] },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { title: "Ghi chú", href: "/dashboard/ghi-chu", icon: StickyNote, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Quản trị dữ liệu", href: "/dashboard/quan-tri", icon: Table2, roles: ["quan_ly"] as Role[] },
      // Lô hàng, công nợ đầu hàng, chi phí ngoài, báo cáo 21h: chỉ chủ shop.
      { title: "Tài chính", href: "/dashboard/tai-chinh", icon: Landmark, roles: ["chu_shop"] as Role[] },
      { title: "Nhân viên", href: "/dashboard/nhan-vien", icon: UserCheck, roles: ["quan_ly"] as Role[] },
      { title: "Thông báo", href: "/dashboard/thong-bao", icon: Bell, roles: ["quan_ly", "nhan_vien"] as Role[] },
      { title: "Cài đặt", href: "/dashboard/cai-dat", icon: Settings, roles: ["quan_ly"] as Role[] },
      { title: "Hướng dẫn", href: "/dashboard/huong-dan", icon: BookOpen, roles: ["quan_ly", "nhan_vien"] as Role[] },
    ],
  },
]

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

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { setOpenMobile } = useSidebar()

  const { me, isLoading, error } = useAuthMe()
  const { toast } = useToast()

  const [role, setRole] = useState<Role>("nhan_vien")
  const [userName, setUserName] = useState<string>("")
  const [storeName, setStoreName] = useState("DEV PỒ")
  const [logoUrl, setLogoUrl] = useState<string>("")
  const brand = useBranchBrand()

  // Đóng sidebar (mobile) khi điều hướng
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  // đồng bộ thông tin tài khoản
  useEffect(() => {
    if (isLoading) return
    if (!me || error) {
      toast({ title: "Phiên đăng nhập đã hết hạn", description: "Vui lòng đăng nhập lại" })
      router.replace("/auth/login")
      return
    }
    const nextRole = (me.role as Role) || readMeCache()?.role || "nhan_vien"
    const nextName = me.name?.trim() || readMeCache()?.name || ""
    setRole(nextRole)
    setUserName(nextName)
    writeMeCache({ role: nextRole, name: nextName })
  }, [isLoading, me, error, toast, router])

  // load store settings & logo
  useEffect(() => {
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
    loadStore()
    const onStorage = (e: StorageEvent) => {
      if (e.key === "store_settings") loadStore()
    }
    const onCustom = () => loadStore()
    window.addEventListener("storage", onStorage)
    window.addEventListener("store_settings_changed", onCustom as EventListener)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("store_settings_changed", onCustom as EventListener)
    }
  }, [])

  const navigation = useMemo(() => {
    const base = getNavigation()
    return base
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          // Chủ shop có mọi quyền của quản lý
          if (!item.roles.includes(role) && !(role === "chu_shop" && item.roles.includes("quan_ly"))) return false
          return true
        }),
      }))
      .map((section) => ({
        ...section,
        // Quản lý không xem Tổng quan: vào thẳng tab Sửa dữ liệu
        items: section.items.map((item) =>
          item.href === "/dashboard/quan-tri" && role !== "chu_shop" ? { ...item, href: "/dashboard/quan-tri/du-lieu" } : item,
        ),
      }))
      .filter((s) => s.items.length > 0)
  }, [role, me?.email])

  const handleLogout = async () => {
    try { await fetch("/api/logout", { method: "POST" }) } catch {}
    localStorage.removeItem("auth_user")
    localStorage.removeItem(ME_CACHE_KEY)
    router.push("/auth/login")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center mt-1 gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          {brand.kind === "loading" ? (
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-muted" />
          ) : brand.kind === "all" ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center text-sidebar-foreground/80">
              <Layers2 className="h-5 w-5" strokeWidth={1.75} />
            </div>
          ) : brand.kind === "t1s" ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-900 p-1 dark:border dark:border-zinc-700">
              <img src={brand.logo} alt="Logo T1s" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
              <img
                src={logoUrl || "/apple-touch-icon.png"}
                alt="Logo"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            {brand.kind === "loading" ? (
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
            ) : brand.kind === "all" ? (
              <p className="truncate text-sm font-semibold tracking-wide text-sidebar-foreground">{brand.name}</p>
            ) : (
              <>
                <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
                  {brand.kind === "t1s" ? brand.name : storeName}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {role === "chu_shop" ? "Chủ shop" : role === "quan_ly" ? "Quản lý cửa hàng" : userName || "Nhân viên"}
                </p>
              </>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                      <NavPendingReporter />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Đăng xuất"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive"
            >
              <LogOut />
              <span>Đăng xuất</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
