"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Smartphone } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
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

    if (!res.ok || !data.success || !data.user?.role) throw new Error("Đã xảy ra lỗi")

    // Lưu thông tin user vào localStorage (nếu cần)
    localStorage.setItem("auth_user", JSON.stringify(data.user))
    localStorage.setItem("user_email", data.user.email)
    // Lưu ID Nhân Viên nếu có
    if (data.user.id_nhan_vien) {
      localStorage.setItem("employeeId", data.user.id_nhan_vien)
    } else {
      localStorage.removeItem("employeeId")
    }

    // Điều hướng: luôn vào kho hàng sau đăng nhập
    router.push("/dashboard/kho-hang")
  } catch (error: unknown) {
    setError(error instanceof Error ? error.message : "Đã xảy ra lỗi")
  } finally {
    setIsLoading(false)
  }
}

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute top-10 right-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-1000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-2000"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-200 bg-white">
              <img
                src="/apple-touch-icon.png"
                alt="DEV PỒ Logo"
                className="h-full w-full object-cover scale-[1.2]"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-2">
            DEV PỒ 
          </h1>
          <p className="text-gray-600 text-lg">Hệ thống quản lý cửa hàng chuyên nghiệp</p>
        </div>

        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl animate-slide-up">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-semibold text-gray-800">Đăng nhập hệ thống</CardTitle>
            <CardDescription className="text-gray-600">Nhập thông tin để truy cập vào hệ thống quản lý</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Địa chỉ Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Nhập tài khoản email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Mật khẩu
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Nhập mật khẩu"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg animate-shake">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang đăng nhập...
                  </div>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>


              <p>
              </p>
              <p>
              </p>
            </div>
          </div>
  )
}
