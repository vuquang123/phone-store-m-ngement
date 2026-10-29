import type React from "react"
import { DashboardLayout as ResponsiveLayout } from "@/components/layout/dashboard-layout"

// Dùng chung khung sidebar + header với /dashboard, nếu không trang này sẽ hiện
// trần trụi không có thanh điều hướng.
export default function NhanVienLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ResponsiveLayout title="Tổng kết ca">{children}</ResponsiveLayout>
}
