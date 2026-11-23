"use client"
// Hai tab của mục "Quản trị dữ liệu": Tổng quan (xem mỗi ngày) và Sửa dữ liệu (bảng tính).
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuthMe } from "@/hooks/use-auth-me"
import { isOwnerRole } from "@/lib/roles"

const TABS = [
  { href: "/dashboard/quan-tri", label: "Tổng quan", ownerOnly: true },
  { href: "/dashboard/quan-tri/du-lieu", label: "Sửa dữ liệu" },
  { href: "/dashboard/quan-tri/nhap-lo", label: "Nhập lô từ Excel" },
]

export function QuanTriTabs() {
  const pathname = usePathname()
  const { me } = useAuthMe()
  const tabs = TABS.filter((t) => !t.ownerOnly || isOwnerRole(me?.role))
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            pathname === t.href ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
