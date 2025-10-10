"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  BookOpen,
  Users,
  ShoppingCart,
  Package,
  Bell,
  UserCheck,
  Smartphone,
  Shield,
  RotateCcw,
  RefreshCcw,
  Repeat,
} from "lucide-react"

type Role = "quan_ly" | "nhan_vien" | undefined

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("auth_user")
    const data = raw ? JSON.parse(raw) : {}
    if (typeof data?.email === "string") return { "x-user-email": data.email }
  } catch {}
  return {}
}

export default function HuongDanPage() {
  const [role, setRole] = useState<Role>()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
        if (res.ok) {
          const me = await res.json()
          if (mounted) setRole(me?.role as Role)
        }
      } catch {}
    })()
    return () => {
      mounted = false
    }
  }, [])

  const VisibleIf = ({ allow, children }: { allow?: Role[]; children: React.ReactNode }) => {
    if (!allow || allow.includes(role as Role)) return <>{children}</>
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hướng dẫn sử dụng</h1>
        <p className="text-muted-foreground">Hướng dẫn phù hợp với vai trò: {role === "quan_ly" ? "Quản lý" : role === "nhan_vien" ? "Nhân viên" : "—"}</p>
      </div>

      <div className="grid gap-6">
        {/* Giới thiệu hệ thống (cập nhật theo kiến trúc hiện tại) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Giới thiệu hệ thống
            </CardTitle>
            <CardDescription>Quản lý bán hàng iPhone/Phụ kiện dựa trên Google Sheets, đồng bộ theo thời gian thực</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Tính năng chính</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• POS bán hàng hợp nhất: hàng trong kho + hàng đối tác</li>
                  <li>• Quản lý kho theo IMEI, nhập hàng, trả hàng</li>
                  <li>• Hợp đồng bảo hành, tính ngày còn lại</li>
                  <li>• Hoàn trả: nhập lại kho, hủy bảo hành, thông báo Telegram</li>
                  <li>• Quản lý khách hàng, tổng mua tự động</li>
                  <li>• Tải logo cửa hàng và hiển thị toàn hệ thống</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Công nghệ</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Next.js App Router, TypeScript, Tailwind + shadcn/ui</li>
                  <li>• Google Sheets: đọc/ghi có cache TTL, fallback khi quota</li>
                  <li>• Telegram Bot: thông báo đơn mới và hoàn trả</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dành cho Nhân viên */}
        <VisibleIf allow={["nhan_vien", "quan_ly"]}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Hướng dẫn cho Nhân viên
              </CardTitle>
              <CardDescription>Quy trình công việc hằng ngày</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Bán hàng (POS)
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Tìm sản phẩm theo IMEI hoặc tên phụ kiện, chọn khách hàng</li>
                    <li>• Hàng đối tác sẽ tự xác định nguồn, xóa khỏi sheet đối tác sau khi bán</li>
                    <li>• Phí bảo hành (nếu có) tự cộng vào tổng, hợp đồng được tạo sau khi thanh toán</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <Link href="/dashboard/ban-hang"><Button size="sm">Mở POS</Button></Link>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Nhập hàng vào kho
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Điền đủ thông tin máy và IMEI, hệ thống tự tính ID Máy</li>
                    <li>• Sau khi thêm, danh sách tự refresh</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <Link href="/dashboard/kho-hang"><Button size="sm" variant="outline">Tới Kho hàng</Button></Link>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Repeat className="h-4 w-4" /> Hoàn trả
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Thực hiện ngay trong chi tiết đơn: chọn IMEI, số tiền hoàn, hệ thống tự nhập kho lại</li>
                    <li>• Bảo hành sẽ được hủy theo IMEI; hàng đối tác không nhập lại kho shop</li>
                    <li>• Có thể tạo nhanh tại Dashboard → Hoàn trả</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <Link href="/dashboard/hoan-tra"><Button size="sm" variant="outline">Xem danh sách hoàn trả</Button></Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </VisibleIf>

        {/* Dành cho Quản lý */}
        <VisibleIf allow={["quan_ly"]}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Hướng dẫn cho Quản lý
              </CardTitle>
              <CardDescription>Thiết lập hệ thống và giám sát hoạt động</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Cài đặt hệ thống</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Tải logo cửa hàng, hiển thị tức thì ở Header</li>
                    <li>• Đồng bộ Google Sheets: chú ý hạn mức quota; hệ thống có cache TTL và fallback</li>
                    <li>• Kiểm tra kết nối đối tác (sheet tên có dấu/không dấu đều được hỗ trợ)</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <Link href="/dashboard/cai-dat"><Button size="sm">Mở Cài đặt</Button></Link>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Quản lý nhân viên</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Cấp quyền nhan_vien/quan_ly, ẩn các mục nhạy cảm với nhân viên</li>
                    <li>• Theo dõi lịch sử bán hàng/hoàn trả qua Telegram và Dashboard</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Hoàn trả và bảo hành</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Mỗi hoàn trả chỉ áp dụng cho đúng IMEI; tự động nhập kho lại và ghi trạng thái “Còn hàng”</li>
                    <li>• Tổng Mua của khách sẽ trừ đi số tiền hoàn</li>
                    <li>• Hủy hợp đồng bảo hành theo IMEI</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </VisibleIf>

        {/* Bảo mật & Thông báo chung */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Bảo mật và thông báo
            </CardTitle>
            <CardDescription>Nguyên tắc hoạt động và kênh cảnh báo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Bảo mật</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Mọi thao tác ghi/đọc đều qua API nội bộ; không public token</li>
                  <li>• Header x-user-email từ LocalStorage để xác định người dùng hiện tại</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Thông báo</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Gửi Telegram cho đơn mới và hoàn trả (theo thread)</li>
                  <li>• Nên kiểm tra bot khi thay đổi nhóm/ID</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hỗ trợ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Hỗ trợ kỹ thuật</CardTitle>
            <CardDescription>Liên hệ khi cần trợ giúp hoặc báo lỗi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Hệ thống dùng Next.js + Google Sheets. Khi gặp sự cố quota hoặc lỗi sheet, vui lòng thử lại sau vài phút hoặc liên hệ bộ phận kỹ thuật.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
