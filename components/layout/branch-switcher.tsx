"use client"

// Chọn chi nhánh đang xem. Chủ shop/quản lý: đổi được giữa DEV PỒ, T1s hoặc "Tất cả".
// Nhân viên: chỉ hiện tên chi nhánh của mình (không đổi được).
import { useState } from "react"
import { Store } from "lucide-react"
import { useAuthMe } from "@/hooks/use-auth-me"
import { BRANCHES } from "@/lib/branches"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const BRANCH_STYLE: Record<string, string> = {
  "1": "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  "2": "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  all: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
}

export function BranchSwitcher() {
  const { me, isLoading } = useAuthMe()
  const [saving, setSaving] = useState(false)
  if (isLoading || !me) return null

  const active = me.activeBranch || me.branch || "1"
  const branches = me.branches?.length ? me.branches : BRANCHES

  if (!me.canSwitchBranch) {
    const name = branches.find((b) => b.id === active)?.name || me.branchName || ""
    if (!name) return null
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          BRANCH_STYLE[active] || BRANCH_STYLE["1"],
        )}
        title="Chi nhánh của tài khoản"
      >
        <Store className="h-3.5 w-3.5" />
        {name}
      </span>
    )
  }

  const change = async (value: string) => {
    if (value === active) return
    setSaving(true)
    try {
      const res = await fetch("/api/branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: value }),
      })
      if (!res.ok) throw new Error()
      // Giỏ hàng đang soạn thuộc chi nhánh cũ -> bỏ đi khi đổi chi nhánh
      try {
        localStorage.removeItem("cart_draft_v1")
        localStorage.removeItem("cart_warranty_sel_v1")
        localStorage.removeItem("auth_me_cache_v1")
      } catch {}
      window.location.reload()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Select value={active} onValueChange={change} disabled={saving}>
      <SelectTrigger
        aria-label="Chọn chi nhánh"
        className={cn(
          "h-8 sm:h-9 w-auto sm:min-w-[7.5rem] gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-3 text-xs sm:text-sm font-medium shadow-none",
          BRANCH_STYLE[active] || BRANCH_STYLE["1"],
        )}
      >
        <Store className="h-3.5 w-3.5 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="z-[70]">
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
        <SelectItem value="all">Tất cả chi nhánh</SelectItem>
      </SelectContent>
    </Select>
  )
}
