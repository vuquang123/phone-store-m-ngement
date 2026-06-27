"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-accent"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Đổi giao diện sáng/tối"
      title="Sáng / Tối"
    >
      {/* Tránh nhydration mismatch: trước khi mounted hiển thị icon mặc định */}
      {mounted && isDark ? (
        <Sun className="h-5 w-5 text-muted-foreground" />
      ) : (
        <Moon className="h-5 w-5 text-muted-foreground" />
      )}
    </Button>
  )
}
