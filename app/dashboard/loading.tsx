// app/dashboard/loading.tsx
// Loading UI cho vùng content khi điều hướng giữa các tab (sidebar + header vẫn giữ).
// Next.js tự hiển thị file này trong khi route/segment của tab đang được tải.

import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-9rem)] w-full items-center justify-center bg-background/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card/80 px-8 py-6 shadow-lg">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Đang tải dữ liệu…</span>
      </div>
    </div>
  )
}



