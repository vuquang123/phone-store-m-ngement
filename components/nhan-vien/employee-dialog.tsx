"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Role = "quan_ly" | "nhan_vien"
type Status = "hoat_dong" | "ngung_hoat_dong"

export interface Employee {
  id: string
  email: string
  ho_ten: string
  so_dien_thoai: string
  vai_tro: Role
  trang_thai: Status
}

type FormState = {
  email: string
  password: string
  ho_ten: string
  so_dien_thoai: string
  vai_tro: Role
  trang_thai: Status
}

interface EmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  onSave: (data: FormState) => Promise<void> | void
}

export function EmployeeDialog({ open, onOpenChange, employee, onSave }: EmployeeDialogProps) {
  const [formData, setFormData] = useState<FormState>({
    email: "",
    password: "",
    ho_ten: "",
    so_dien_thoai: "",
    vai_tro: "nhan_vien",
    trang_thai: "hoat_dong",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (employee) {
      setFormData({
        email: employee.email,
        password: "",
        ho_ten: employee.ho_ten,
        so_dien_thoai: employee.so_dien_thoai,
        vai_tro: employee.vai_tro,
        trang_thai: employee.trang_thai,
      })
    } else {
      setFormData({
        email: "",
        password: "",
        ho_ten: "",
        so_dien_thoai: "",
        vai_tro: "nhan_vien",
        trang_thai: "hoat_dong",
      })
    }
  }, [employee, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      await onSave(formData)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-[425px] bg-white">
        <DialogHeader>
          <DialogTitle>{employee ? "Chỉnh sửa nhân viên" : "Thêm nhân viên mới"}</DialogTitle>
          <DialogDescription>
            {employee ? "Cập nhật thông tin nhân viên" : "Tạo tài khoản mới cho nhân viên"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ho_ten" className="text-right">
                Họ tên
              </Label>
              <Input
                id="ho_ten"
                value={formData.ho_ten}
                onChange={(e) => handleChange("ho_ten", e.target.value)}
                className="col-span-3"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="col-span-3"
                required
                disabled={!!employee || loading}
                autoComplete="email"
              />
            </div>

            {!employee && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  Mật khẩu
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className="col-span-3"
                  required
                  minLength={6}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="so_dien_thoai" className="text-right">
                Số điện thoại
              </Label>
              <Input
                id="so_dien_thoai"
                value={formData.so_dien_thoai}
                onChange={(e) => handleChange("so_dien_thoai", e.target.value)}
                className="col-span-3"
                required
                disabled={loading}
                inputMode="tel"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Vai trò</Label>
              <Select
                value={formData.vai_tro}
                onValueChange={(value) => handleChange("vai_tro", value as Role)}
                disabled={loading}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nhan_vien">Nhân viên</SelectItem>
                  <SelectItem value="quan_ly">Quản lý</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Trạng thái</Label>
              <Select
                value={formData.trang_thai}
                onValueChange={(value) => handleChange("trang_thai", value as Status)}
                disabled={loading}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoat_dong">Hoạt động</SelectItem>
                  <SelectItem value="ngung_hoat_dong">Ngưng hoạt động</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
