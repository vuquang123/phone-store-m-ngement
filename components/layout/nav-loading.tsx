// components/layout/nav-loading.tsx
// Overlay làm mờ vùng content + spinner khi đang điều hướng giữa các tab sidebar.
// Dùng useLinkStatus (Next 15.3+) để biết một <Link> đang "pending" (đang tải route).

"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"

interface NavLoadingCtx {
  inc: () => void
  dec: () => void
  pending: boolean
}

const Ctx = createContext<NavLoadingCtx>({ inc: () => {}, dec: () => {}, pending: false })

export function NavLoadingProvider({ children }: { children: React.ReactNode }) {
  // Đếm số link đang pending (thường chỉ 1 tại một thời điểm).
  const [count, setCount] = useState(0)
  const inc = useCallback(() => setCount((c) => c + 1), [])
  const dec = useCallback(() => setCount((c) => Math.max(0, c - 1)), [])
  return <Ctx.Provider value={{ inc, dec, pending: count > 0 }}>{children}</Ctx.Provider>
}

/** Đặt BÊN TRONG mỗi <Link> của sidebar: báo lên context khi link đó đang tải. */
export function NavPendingReporter() {
  const { inc, dec } = useContext(Ctx)
  const { pending } = useLinkStatus()
  useEffect(() => {
    if (!pending) return
    inc()
    return () => dec()
  }, [pending, inc, dec])
  return null
}

/** Lớp phủ mờ + spinner, hiển thị khi có điều hướng đang chờ. Đặt trong vùng content. */
export function NavLoadingOverlay() {
  const { pending } = useContext(Ctx)
  if (!pending) return null
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/45 backdrop-blur-sm transition-opacity">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card/85 px-8 py-6 shadow-lg">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Đang tải dữ liệu…</span>
      </div>
    </div>
  )
}
