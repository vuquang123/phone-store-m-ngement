"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Smartphone, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
const [expired, setExpired] = useState(false)
useEffect(() => {
  setExpired(new URLSearchParams(window.location.search).get("expired") === "1")
}, [])
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setError(null)
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Đăng nhập thất bại")
    }
    if (!data.user?.role) {
      throw new Error("Tài khoản chưa được cấp quyền, liên hệ quản lý.")
    }

    // Lưu thông tin user vào localStorage (nếu cần)
    localStorage.setItem("auth_user", JSON.stringify(data.user))
    localStorage.setItem("user_email", data.user.email)
    // Lưu ID Nhân Viên nếu có
    if (data.user.id_nhan_vien) {
      localStorage.setItem("employeeId", data.user.id_nhan_vien)
    } else {
      localStorage.removeItem("employeeId")
    }

    // Điều hướng: dùng location.href (hard redirect) thay vì router.push để đảm bảo
    // cookie session đã được trình duyệt lưu trước khi request tiếp theo đi (quan trọng trên mobile).
    const nextParam = new URLSearchParams(window.location.search).get("next")
    const dest = nextParam && nextParam.startsWith("/dashboard") ? nextParam : "/dashboard/ban-hang"
    window.location.href = dest
  } catch (error: unknown) {
    setError(error instanceof Error ? error.message : "Đã xảy ra lỗi")
  } finally {
    setIsLoading(false)
  }
}

  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-50 text-foreground dark:bg-slate-950">
      {/* Nền động nhẹ nhàng: mảng màu mờ trôi chậm + lưới chấm */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="login-aurora">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="login-grid" />
      </div>

      <main className="relative flex min-h-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="login-rise mb-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
              <Smartphone className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Đăng nhập</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hệ thống quản lý cửa hàng</p>
          </div>

          <div
            className="login-rise rounded-2xl border border-white/70 bg-white/75 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-7 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/30"
            style={{ animationDelay: "80ms" }}
          >
            {expired ? (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-200">
                Phiên đăng nhập đã hết 4 tiếng. Vui lòng đăng nhập lại.
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ten@email.com"
                    required
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-lg border-slate-200 bg-white/90 pl-9 text-[15px] focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-950/60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Mật khẩu
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    required
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-lg border-slate-200 bg-white/90 pl-9 pr-10 text-[15px] focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-950/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-300"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-lg bg-emerald-600 text-[15px] font-medium text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:shadow-lg active:scale-[0.99] disabled:opacity-70"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang đăng nhập...
                  </span>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>
          </div>

          <p className="login-rise mt-6 text-center text-xs text-slate-400 dark:text-slate-500" style={{ animationDelay: "160ms" }}>
            Quên mật khẩu? Liên hệ chủ shop hoặc quản lý để được cấp lại.
          </p>
        </div>
      </main>
    </div>
  )
}
