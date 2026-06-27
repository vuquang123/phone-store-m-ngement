"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshButton } from "@/components/ui/refresh-button"
import { Bell, AlertCircle, Info, ShoppingCart, CheckCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { cn } from "@/lib/utils"

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

  const fetchNotifications = async (force = false) => {
    try {
      const response = await fetchWithTimeout(`/api/thong-bao${force ? "?refresh=1" : ""}`)
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
        return <ShoppingCart className="h-4 w-4 text-blue-500" />
      case "kho_hang":
        return <Info className="h-4 w-4 text-green-500" />
      case "canh_bao":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />
    }
  }

  // Hiển thị thời gian tương đối an toàn (ISO / timestamp / chuỗi vi-VN)
  const formatTime = (raw: any): string => {
    let d: Date | null = null
    if (typeof raw === "number") d = new Date(raw)
    else if (typeof raw === "string") {
      if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        const p = parseISO(raw)
        if (!isNaN(p.getTime())) d = p
      }
      if (!d) {
        const num = Number(raw)
        if (!isNaN(num) && num > 0) d = new Date(num)
      }
      if (!d) {
        const p = new Date(raw)
        if (!isNaN(p.getTime())) d = p
      }
    }
    if (!d || isNaN(d.getTime())) return "--"
    return formatDistanceToNow(d, { addSuffix: true, locale: vi })
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => n.trang_thai === "chua_doc")
    for (const n of unread) await markAsRead(n.id)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Thông báo</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} chưa đọc` : "Tất cả đã đọc"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-2" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4" /> Đánh dấu đã đọc
            </Button>
          )}
          <RefreshButton onRefresh={() => fetchNotifications(true)} loading={loading} label />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Chưa có thông báo nào</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const unread = n.trang_thai === "chua_doc"
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => unread && markAsRead(n.id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                        unread && "bg-accent/40",
                      )}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        {getNotificationIcon(n.loai)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("truncate text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>
                            {n.tieu_de}
                          </span>
                          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                        </div>
                        {n.noi_dung && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.noi_dung}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {getNotificationBadge(n.loai)}
                          <span className="text-xs text-muted-foreground">{formatTime(n.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
