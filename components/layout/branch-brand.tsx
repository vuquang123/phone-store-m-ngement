"use client"

// Tên shop + logo theo chi nhánh đang xem (sidebar và header dùng chung).
// - DEV PỒ: tên/logo trong Cài đặt cửa hàng (như trước).
// - T1s: logo T1s (nét trắng, nên đặt trên nền tối).
// - Tất cả chi nhánh: chỉ hiện chữ QUẢN LÝ.
import { useAuthMe } from "@/hooks/use-auth-me"

export const T1S_LOGO = "/branches/t1s-logo.svg"

export type BranchBrand =
  | { kind: "loading" }
  | { kind: "devpo" }
  | { kind: "t1s"; name: string; logo: string }
  | { kind: "all"; name: string }

export function useBranchBrand(): BranchBrand {
  const { me } = useAuthMe()
  // Chưa biết tài khoản thuộc chi nhánh nào -> chưa hiện tên/logo (tránh nháy "DEV PỒ" với tài khoản T1s)
  if (!me) return { kind: "loading" }
  const active = me?.activeBranch || me?.branch || "1"
  if (active === "all") return { kind: "all", name: "QUẢN LÝ" }
  if (active === "2") return { kind: "t1s", name: me?.branches?.find((b) => b.id === "2")?.name || "T1s", logo: T1S_LOGO }
  return { kind: "devpo" }
}
