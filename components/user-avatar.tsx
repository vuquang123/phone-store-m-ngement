"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// Chữ cái đầu của tên (fallback email -> "U")
function getInitial(name?: string, email?: string): string {
  const n = (name || "").trim()
  if (n) return n[0].toUpperCase()
  const e = (email || "").trim()
  if (e) return e[0].toUpperCase()
  return "U"
}

// Màu nền ỔN ĐỊNH theo chuỗi (cùng tên -> cùng màu) — đủ tối để chữ trắng đọc rõ.
function colorFromString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) % 360
  if (h < 0) h += 360
  return `hsl(${h} 60% 42%)`
}

interface UserAvatarProps {
  name?: string
  email?: string
  src?: string
  className?: string
}

/**
 * Avatar mỗi user: hiện ẢNH nếu có, ngược lại hiện "hình" = nền màu riêng theo tên
 * + CHỮ CÁI ĐẦU của tên. Mỗi user một màu cố định, dễ phân biệt.
 */
export function UserAvatar({ name, email, src, className }: UserAvatarProps) {
  const seed = (name || email || "user").trim().toLowerCase()
  const bg = colorFromString(seed)
  const ch = getInitial(name, email)
  const hasImg = !!src && src !== "/placeholder.svg"

  return (
    <Avatar className={cn("select-none", className)}>
      {hasImg && <AvatarImage src={src} alt={name || email || "Avatar"} />}
      <AvatarFallback className="font-semibold text-white" style={{ backgroundColor: bg }}>
        {ch}
      </AvatarFallback>
    </Avatar>
  )
}
