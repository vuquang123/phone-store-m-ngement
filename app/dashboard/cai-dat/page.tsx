"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, Smartphone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function CaiDatPage() {
  const router = useRouter()
  const [storeSettings, setStoreSettings] = useState({
    ten_cua_hang: "DEV PỒ",
    dia_chi: "3/39A Bình Giã, Phường Tân Bình, TP.Hồ Chí Minh",
    so_dien_thoai: "0399208037 -  0909097177",
    email: "devpo@example.com",
    logo_url: "",
  })
  const [loading, setLoading] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let mounted = true
    try {
      const saved = localStorage.getItem("store_settings")
      if (saved) setStoreSettings(JSON.parse(saved))
    } catch (e) {
      console.error("Error loading settings:", e)
    }
    // Kiểm tra role người dùng
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" })
        if (!res.ok) return router.replace("/auth/login")
        const me = await res.json()
        if (mounted && me?.role !== "quan_ly") {
          router.replace("/dashboard")
        }
      } catch (e) {
        router.replace("/auth/login")
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleSaveSettings = async () => {
    setLoading(true)
    try {
      let logoUrl = storeSettings.logo_url

      // Upload logo (nếu có)
      if (logoFile) {
        if (logoFile.size > 2 * 1024 * 1024) {
          throw new Error("Logo vượt quá 2MB")
        }
        const form = new FormData()
        form.append("file", logoFile)
        form.append("prefix", "logo")

        const res = await fetch("/api/upload/logo", { method: "POST", body: form })
        if (!res.ok) throw new Error("Upload thất bại")
        const data = await res.json()
        logoUrl = data.url as string
      }

      const next = { ...storeSettings, logo_url: logoUrl }
      setStoreSettings(next)
      localStorage.setItem("store_settings", JSON.stringify(next))

      toast({ title: "Thành công", description: "Đã lưu cài đặt cửa hàng" })
    } catch (err: any) {
      toast({
        title: "Lỗi",
        description: err?.message || "Có lỗi xảy ra khi lưu cài đặt",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setStoreSettings((prev) => ({ ...prev, logo_url: (ev.target?.result as string) || "" }))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground">Quản lý thông tin và cài đặt cửa hàng</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin cửa hàng</CardTitle>
            <CardDescription>Cập nhật thông tin cơ bản của cửa hàng</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ten_cua_hang">Tên cửa hàng</Label>
                <Input
                  id="ten_cua_hang"
                  value={storeSettings.ten_cua_hang}
                  onChange={(e) => setStoreSettings((p) => ({ ...p, ten_cua_hang: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="so_dien_thoai">Số điện thoại</Label>
                <Input
                  id="so_dien_thoai"
                  value={storeSettings.so_dien_thoai}
                  onChange={(e) => setStoreSettings((p) => ({ ...p, so_dien_thoai: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dia_chi">Địa chỉ</Label>
              <Input
                id="dia_chi"
                value={storeSettings.dia_chi}
                onChange={(e) => setStoreSettings((p) => ({ ...p, dia_chi: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={storeSettings.email}
                onChange={(e) => setStoreSettings((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logo cửa hàng</CardTitle>
            <CardDescription>Tải lên logo cho cửa hàng của bạn</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-muted-foreground rounded-lg">
                {storeSettings.logo_url ? (
                  <img
                    src={storeSettings.logo_url || "/placeholder.svg"}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <Smartphone className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Chọn logo</Label>
                <Input id="logo" type="file" accept="image/*" onChange={handleLogoChange} />
                <p className="text-sm text-muted-foreground">Định dạng: JPG, PNG. Tối đa: 2MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Đang lưu..." : "Lưu cài đặt"}
          </Button>
        </div>
      </div>
    </div>
  )
}
