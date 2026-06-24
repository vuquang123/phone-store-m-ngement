"use client"

import type React from "react"

import { AppSidebar } from "./sidebar"
import { Header } from "./header"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <SidebarProvider className="h-dvh">
      <AppSidebar />
      <SidebarInset className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto no-scrollbar overscroll-none p-3 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
