"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Customer {
  id: string
  ho_ten: string
  so_dien_thoai: string
  email?: string
}

interface CustomerDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (customer: Customer) => void
}

export function CustomerDialog({ isOpen, onClose, onSuccess }: CustomerDialogProps) {
  const [formData, setFormData] = useState({
    ho_ten: "",
    so_dien_thoai: "",
    ghi_chu: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      const response = await fetch("/api/khach-hang", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ten_khach: formData.ho_ten,
          sdt: formData.so_dien_thoai,
          ghi_chu: formData.ghi_chu,
          created_at: now,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create customer")
      }

  const res = await response.json()
  onSuccess(res.customer)

      // Reset form
      setFormData({
        ho_ten: "",
        so_dien_thoai: "",
        ghi_chu: "",
      })
    } catch (error) {
      console.error("Error creating customer:", error)
      alert("Lỗi khi tạo khách hàng: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle>Thêm khách hàng mới</DialogTitle>
          <DialogDescription>Nhập thông tin khách hàng mới</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ho_ten">Họ tên *</Label>
              <Input
                id="ho_ten"
                value={formData.ho_ten}
                onChange={(e) => setFormData({ ...formData, ho_ten: e.target.value })}
                placeholder="Nhập tên khách hàng"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="so_dien_thoai">Số điện thoại *</Label>
              <Input
                id="so_dien_thoai"
                value={formData.so_dien_thoai}
                onChange={(e) => setFormData({ ...formData, so_dien_thoai: e.target.value })}
                placeholder="Nhập số điện thoại"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ghi_chu">Ghi chú</Label>
            <Textarea
              id="ghi_chu"
              value={formData.ghi_chu}
              onChange={(e) => setFormData({ ...formData, ghi_chu: e.target.value })}
              placeholder="Ghi chú về khách hàng..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Đang tạo..." : "Tạo khách hàng"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
