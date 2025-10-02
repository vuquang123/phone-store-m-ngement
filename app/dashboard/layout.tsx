import type React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[100dvh] bg-slate-50 overflow-hidden">
      {/* Sidebar là client component tự xử lý toggle nếu có */}
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Dashboard" />
        <main id="main" className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
