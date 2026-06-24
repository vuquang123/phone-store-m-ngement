"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>
  loading?: boolean
  className?: string
  /** Hiện chữ "Làm mới" bên cạnh icon (mặc định chỉ icon) */
  label?: boolean
}

/** Nút làm mới: gọi lại API để load data mới nhất từ Google Sheet. */
export function RefreshButton({ onRefresh, loading, className, label }: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={label ? "sm" : "icon"}
      onClick={() => onRefresh()}
      disabled={loading}
      aria-label="Làm mới dữ liệu"
      title="Làm mới dữ liệu từ sheet"
      className={cn(label ? "gap-2" : "h-9 w-9", className)}
    >
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      {label && <span>Làm mới</span>}
    </Button>
  )
}
