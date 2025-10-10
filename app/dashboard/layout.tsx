import type React from "react"
import { DashboardLayout as ResponsiveLayout } from "@/components/layout/dashboard-layout"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ResponsiveLayout title="Dashboard">{children}</ResponsiveLayout>
}
