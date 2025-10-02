"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, Clock, AlertCircle, Info, ShoppingCart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

interface Notification {
  id: string
  tieu_de: string
  noi_dung: string
  loai: "ban_hang" | "kho_hang" | "he_thong" | "canh_bao"
  trang_thai: "chua_doc" | "da_doc"
  nguoi_gui_id: string
  nguoi_nhan_id: string
  created_at: string
  updated_at: string
}

export default function ThongBaoPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/thong-bao")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      } else {
        toast({
          title: "Lỗi",
          description: "Không thể tải danh sách thông báo",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi tải dữ liệu",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/thong-bao/${notificationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trang_thai: "da_doc" }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => (notif.id === notificationId ? { ...notif, trang_thai: "da_doc" } : notif)),
        )
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ban_hang":
        return <ShoppingCart className="h-5 w-5 text-blue-500" />
      case "kho_hang":
        return <Info className="h-5 w-5 text-green-500" />
      case "canh_bao":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case "ban_hang":
        return <Badge variant="default">Bán hàng</Badge>
      case "kho_hang":
        return <Badge variant="secondary">Kho hàng</Badge>
      case "canh_bao":
        return <Badge variant="destructive">Cảnh báo</Badge>
      default:
        return <Badge variant="outline">Hệ thống</Badge>
    }
  }

  const unreadCount = notifications.filter((n) => n.trang_thai === "chua_doc").length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Thông báo</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Tất cả thông báo đã được đọc"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Chưa có thông báo</h3>
              <p className="text-muted-foreground text-center">
                Các thông báo về hoạt động bán hàng và quản lý kho sẽ hiển thị tại đây
              </p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-colors ${
                notification.trang_thai === "chua_doc" ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => {
                if (notification.trang_thai === "chua_doc") {
                  markAsRead(notification.id)
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {getNotificationIcon(notification.loai)}
                    <div>
                      <CardTitle className="text-base">{notification.tieu_de}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        {getNotificationBadge(notification.loai)}
                        {notification.trang_thai === "chua_doc" && (
                          <Badge variant="default" className="bg-blue-500">
                            Mới
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {(() => {
                        const raw = notification.created_at
                        let d: Date | null = null
                        if (typeof raw === "number") d = new Date(raw)
                        else if (typeof raw === "string") {
                          // Thử ISO trước
                          if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
                            const parsed = parseISO(raw)
                            if (!isNaN(parsed.getTime())) d = parsed
                          }
                          if (!d) {
                            // Thử dạng timestamp số trong chuỗi
                            const num = Number(raw)
                            if (!isNaN(num) && num > 0) d = new Date(num)
                          }
                          if (!d) {
                            // Thử parse tự do (có thể là định dạng vi-VN)
                            const parsed = new Date(raw)
                            if (!isNaN(parsed.getTime())) d = parsed
                          }
                        }
                        if (!d || isNaN(d.getTime())) return "--"
                        return formatDistanceToNow(d, { addSuffix: true, locale: vi })
                      })()}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{notification.noi_dung}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
