"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Plus, Edit, Trash2, UserCheck, UserX } from "lucide-react"
import { EmployeeDialog } from "@/components/nhan-vien/employee-dialog"
import { useToast } from "@/hooks/use-toast"

interface Employee {
  id: string
  email: string
  ho_ten: string
  so_dien_thoai: string
  vai_tro: "quan_ly" | "nhan_vien"
  trang_thai: "hoat_dong" | "ngung_hoat_dong"
  created_at?: string
  updated_at?: string
}

/** Lấy headers xác thực từ localStorage để gửi lên API (phù hợp sheets-auth) */
function getAuthHeaders(extra?: Record<string, string>) {
  try {
    const raw = localStorage.getItem("auth_user")
    const data = raw ? JSON.parse(raw) : {}
    const h: Record<string, string> = {}
    if (data?.id && data?.key) {
      h["x-user-id"] = data.id
      h["x-user-key"] = data.key
    }
    if (data?.email) {
      h["authorization"] = `Bearer ${data.email}`
    }
    // Bổ sung header x-user-email cho xác thực API /me
    const userEmail = localStorage.getItem("user_email") || data?.email || ""
    if (userEmail) {
      h["x-user-email"] = userEmail
    }
    return { ...(extra || {}), ...h }
  } catch {
    return extra || {}
  }
}

export default function NhanVienPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<"quan_ly" | "nhan_vien" | "">("")
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    checkUserRole()
    fetchEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = searchTerm.toLowerCase()
    const filtered = employees.filter((e) => {
      const name = (e.ho_ten || "").toLowerCase()
      const email = (e.email || "").toLowerCase()
      const phone = e.so_dien_thoai || ""
      return name.includes(q) || email.includes(q) || phone.includes(searchTerm)
    })
    setFilteredEmployees(filtered)
  }, [employees, searchTerm])

  /** Kiểm tra quyền từ API /api/auth/me (hoặc trả về từ sheets-auth) */
  const checkUserRole = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) {
        router.push("/dashboard")
        return
      }
      const me = await res.json()
      if (me?.role !== "quan_ly") {
        router.push("/dashboard")
        return
      }
      setUserRole("quan_ly")
    } catch {
      router.push("/dashboard")
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/nhan-vien", {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data: Employee[] = await response.json()
        setEmployees(Array.isArray(data) ? data : [])
      } else {
        toast({
          title: "Lỗi",
          description: "Không thể tải danh sách nhân viên",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi tải dữ liệu",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEmployee = async (employeeData: Partial<Employee>) => {
    try {
      const url = selectedEmployee ? `/api/nhan-vien/${selectedEmployee.id}` : "/api/nhan-vien"
      const method = selectedEmployee ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(employeeData),
      })

      if (response.ok) {
        toast({
          title: "Thành công",
          description: selectedEmployee ? "Đã cập nhật thông tin nhân viên" : "Đã tạo tài khoản nhân viên mới",
        })
        fetchEmployees()
        setIsDialogOpen(false)
        setSelectedEmployee(null)
      } else {
        const error = await response.json().catch(() => ({}))
        toast({
          title: "Lỗi",
          description: error?.error || "Có lỗi xảy ra",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi lưu dữ liệu",
        variant: "destructive",
      })
    }
  }

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên ${employee.ho_ten}?`)) return
    try {
      const response = await fetch(`/api/nhan-vien/${employee.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        toast({ title: "Thành công", description: "Đã xóa nhân viên" })
        fetchEmployees()
      } else {
        const error = await response.json().catch(() => ({}))
        toast({
          title: "Lỗi",
          description: error?.error || "Có lỗi xảy ra",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi xóa nhân viên",
        variant: "destructive",
      })
    }
  }

  const getRoleBadge = (role: string) =>
    role === "quan_ly" ? <Badge variant="default">Quản lý</Badge> : <Badge variant="secondary">Nhân viên</Badge>

  const getStatusBadge = (status: string) =>
    status === "hoat_dong" ? (
      <Badge variant="default" className="bg-green-500">
        <UserCheck className="w-3 h-3 mr-1" />
        Hoạt động
      </Badge>
    ) : (
      <Badge variant="destructive">
        <UserX className="w-3 h-3 mr-1" />
        Ngưng hoạt động
      </Badge>
    )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Quản lý Nhân viên</h1>
          <p className="text-muted-foreground">Quản lý tài khoản và phân quyền nhân viên</p>
        </div>
        {userRole === "quan_ly" && (
          <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Thêm nhân viên
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách nhân viên</CardTitle>
          <CardDescription>Tổng cộng {employees.length} nhân viên</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Tìm kiếm theo tên, email hoặc số điện thoại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-sm"
            />
          </div>

          <div className="space-y-3 sm:space-y-4">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className="relative p-4 border rounded-lg hover:bg-muted/50 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3 pr-16 sm:pr-0 w-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {(employee.ho_ten || "NV")
                        .split(" ")
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <h3 className="font-medium truncate max-w-[200px] sm:max-w-none">{employee.ho_ten}</h3>
                      {getRoleBadge(employee.vai_tro)}
                      {getStatusBadge(employee.trang_thai)}
                    </div>
                    <p className="text-sm text-muted-foreground break-words">{employee.email}</p>
                    <p className="text-sm text-muted-foreground">{employee.so_dien_thoai}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:self-auto sm:ml-auto absolute right-4 top-4 sm:static">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setSelectedEmployee(employee)
                      setIsDialogOpen(true)
                    }}
                  >
                    <Edit className="w-4 h-4" />
                    <span className="sr-only">Sửa nhân viên</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDeleteEmployee(employee)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="sr-only">Xóa nhân viên</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Không tìm thấy nhân viên nào</p>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        employee={selectedEmployee}
        onSave={handleSaveEmployee}
      />
    </div>
  )
}
