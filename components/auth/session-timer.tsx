"use client"
// Tự đăng xuất khi phiên đăng nhập hết hạn (4 tiếng sau khi đăng nhập) và đưa về trang đăng nhập.
// Kiểm tra cả khi quay lại tab / mở máy sau khi ngủ, vì hẹn giờ của trình duyệt có thể bị trễ.
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthMe } from "@/hooks/use-auth-me"
import { useToast } from "@/hooks/use-toast"

const WARN_BEFORE_MS = 5 * 60 * 1000

export function SessionTimer() {
  const { me } = useAuthMe()
  const router = useRouter()
  const { toast } = useToast()
  const done = useRef(false)
  const exp = me?.sessionExpiresAt || 0

  useEffect(() => {
    if (!exp) return
    const logout = async () => {
      if (done.current) return
      done.current = true
      try { await fetch("/api/logout", { method: "POST" }) } catch {}
      try {
        localStorage.removeItem("auth_user")
        localStorage.removeItem("auth_me_cache_v1")
      } catch {}
      window.location.replace("/auth/login?expired=1")
    }
    const check = () => {
      if (Date.now() >= exp) logout()
    }
    check()
    const left = exp - Date.now()
    const timers: ReturnType<typeof setTimeout>[] = []
    if (left > 0) timers.push(setTimeout(logout, Math.min(left, 2_147_000_000)))
    if (left > WARN_BEFORE_MS) {
      timers.push(setTimeout(() => toast({ title: "Sắp hết phiên đăng nhập", description: "Còn 5 phút nữa sẽ tự đăng xuất. Lưu lại việc đang làm." }), left - WARN_BEFORE_MS))
    }
    const iv = setInterval(check, 60_000)
    window.addEventListener("focus", check)
    document.addEventListener("visibilitychange", check)
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(iv)
      window.removeEventListener("focus", check)
      document.removeEventListener("visibilitychange", check)
    }
  }, [exp, router, toast])

  return null
}
