"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { Bell, AlertCircle, Info, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

interface Notification {
  id: string
  tieu_de: string
  noi_dung: string
  loai: "ban_hang" | "kho_hang" | "he_thong" | "canh_bao"
  trang_thai: "chua_doc" | "da_doc"
  created_at: string
}

// Icon theo loại thông báo (khớp trang /dashboard/thong-bao)
function NotifIcon({ loai }: { loai: Notification["loai"] }) {
  switch (loai) {
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

function timeAgo(iso?: string): string {
  if (!iso) return ""
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: vi })
  } catch {
    return ""
  }
}

interface NotificationsBellProps {
  disabled?: boolean
}

export function NotificationsBell({ disabled }: NotificationsBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithTimeout("/api/thong-bao")
      if (res.ok) {
        const data: Notification[] = await res.json()
        const list = Array.isArray(data) ? data : []
        const sorted = [...list].sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        )
        setItems(sorted.slice(0, 5))
        setUnread(list.filter((n) => n.trang_thai === "chua_doc").length)
        setLoaded(true)
      }
    } catch {
      // im lặng — Popover vẫn mở, hiện trạng thái rỗng
    } finally {
      setLoading(false)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) load()
  }

  const goAll = () => {
    setOpen(false)
    router.push("/dashboard/thong-bao")
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-accent transition-colors"
          disabled={disabled}
          aria-label="Thông báo"
          title="Thông báo"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-sidebar">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 p-0 z-[60]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Thông báo</p>
          {unread > 0 && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
              {unread} chưa đọc
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && !loaded ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Chưa có thông báo nào</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={goAll}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                      n.trang_thai === "chua_doc" && "bg-accent/40",
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <NotifIcon loai={n.loai} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{n.tieu_de}</span>
                        {n.trang_thai === "chua_doc" && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.noi_dung}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/70">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-2">
          <Button variant="ghost" className="w-full justify-center text-sm" onClick={goAll}>
            Xem tất cả
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
