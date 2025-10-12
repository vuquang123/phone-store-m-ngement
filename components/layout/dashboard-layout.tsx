"use client"

import type React from "react"

import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { useEffect, useState } from "react"
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle, DrawerClose } from "@/components/ui/drawer"
import { X } from "lucide-react"
import { usePathname } from "next/navigation"

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Đóng Drawer khi điều hướng sang route khác (close-on-navigate)
  useEffect(() => {
    if (open) setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  return (
    <div className="flex h-dvh bg-background">{/* use dynamic viewport height to avoid iOS chrome */}
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow border-r bg-card">
          <Sidebar />
        </div>
      </div>
      {/* Mobile drawer sidebar */}
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (next) {
            // Blur any currently focused element before Drawer modifies aria-hidden on the page
            try { (document.activeElement as HTMLElement | null)?.blur() } catch {}
          }
          setOpen(next)
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="p-0 md:hidden top-0 h-dvh rounded-none">
          <div className="h-full overflow-auto no-scrollbar relative pb-safe overscroll-none">
            {/* Radix/vaul yêu cầu có Title trong Content để đảm bảo a11y */}
            <DrawerTitle className="sr-only">Menu</DrawerTitle>
            {/* Nút đóng ở góc phải */}
            <div className="absolute top-3 right-3 z-10">
              <DrawerClose asChild>
                <button aria-label="Đóng menu" className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/90 shadow border hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
              </DrawerClose>
            </div>
            <Sidebar className="w-full" />
          </div>
        </DrawerContent>
        <div className="flex flex-col flex-1 overflow-hidden w-full">
          <Header title={title} onMenuClick={() => setOpen(true)} />
          <main className="flex-1 overflow-y-auto no-scrollbar overscroll-none p-3 sm:p-6">{children}</main>
        </div>
      </Drawer>
    </div>
  )
}
