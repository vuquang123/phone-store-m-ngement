"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BookOpen, Users, ShoppingCart, Package, Bell, UserCheck, Smartphone, Database, Shield } from "lucide-react"

export default function HuongDanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hướng dẫn sử dụng</h1>
        <p className="text-muted-foreground">Hướng dẫn chi tiết cách sử dụng hệ thống quản lý cửa hàng iPhone Lock</p>
      </div>

      <div className="grid gap-6">
        {/* Giới thiệu hệ thống */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Giới thiệu hệ thống
            </CardTitle>
            <CardDescription>
              Hệ thống quản lý cửa hàng iPhone Lock được thiết kế để quản lý toàn bộ hoạt động kinh doanh
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Tính năng chính:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Quản lý kho hàng iPhone Lock với IMEI</li>
                  <li>• Hệ thống bán hàng POS hiện đại</li>
                  <li>• Quản lý khách hàng và đơn hàng</li>
                  <li>• Thống kê doanh thu theo thời gian thực</li>
                  <li>• Phân quyền quản lý và nhân viên</li>
                  <li>• Thông báo tự động khi có giao dịch</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Công nghệ sử dụng:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Next.js 14 với App Router</li>
                  <li>• Supabase Database & Authentication</li>
                  <li>• Tailwind CSS & shadcn/ui</li>
                  <li>• TypeScript cho type safety</li>
                  <li>• Row Level Security (RLS)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Thiết lập ban đầu */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Thiết lập ban đầu
            </CardTitle>
            <CardDescription>Các bước cần thiết để khởi động hệ thống</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  1
                </Badge>
                <div>
                  <h4 className="font-medium">Chạy các script database</h4>
                  <p className="text-sm text-muted-foreground">
                    Chạy tất cả các script từ 001 đến 006 để tạo bảng và dữ liệu mẫu
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  2
                </Badge>
                <div>
                  <h4 className="font-medium">Tạo tài khoản quản lý</h4>
                  <p className="text-sm text-muted-foreground">
                    Tạo tài khoản quản lý đầu tiên qua Supabase Auth với email: admin@iphonelock.com
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  3
                </Badge>
                <div>
                  <h4 className="font-medium">Cập nhật thông tin cửa hàng</h4>
                  <p className="text-sm text-muted-foreground">
                    Vào trang Cài đặt để cập nhật logo, tên cửa hàng và thông tin liên hệ
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hướng dẫn cho Quản lý */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Hướng dẫn cho Quản lý
            </CardTitle>
            <CardDescription>Các chức năng dành riêng cho quản lý cửa hàng</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Quản lý nhân viên
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Tạo tài khoản nhân viên mới với email và mật khẩu</li>
                  <li>• Phân quyền: Quản lý hoặc Nhân viên</li>
                  <li>• Cập nhật thông tin và trạng thái hoạt động</li>
                  <li>• Xóa tài khoản nhân viên (không thể xóa chính mình)</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Theo dõi thông báo
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Nhận thông báo khi nhân viên tạo đơn hàng mới</li>
                  <li>• Cảnh báo khi sản phẩm sắp hết hàng</li>
                  <li>• Thông báo về các hoạt động quan trọng</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hướng dẫn bán hàng */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Hướng dẫn bán hàng
            </CardTitle>
            <CardDescription>Quy trình bán hàng từ A đến Z</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  1
                </Badge>
                <div>
                  <h4 className="font-medium">Tìm kiếm sản phẩm</h4>
                  <p className="text-sm text-muted-foreground">
                    Sử dụng thanh tìm kiếm để tìm iPhone theo loai_phu_kien, IMEI hoặc phụ kiện theo tên
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  2
                </Badge>
                <div>
                  <h4 className="font-medium">Thêm vào giỏ hàng</h4>
                  <p className="text-sm text-muted-foreground">
                    Click vào sản phẩm để thêm vào giỏ hàng, điều chỉnh số lượng nếu cần
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  3
                </Badge>
                <div>
                  <h4 className="font-medium">Chọn khách hàng</h4>
                  <p className="text-sm text-muted-foreground">
                    Tìm khách hàng cũ hoặc tạo mới, có thể bỏ qua nếu khách vãng lai
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  4
                </Badge>
                <div>
                  <h4 className="font-medium">Thanh toán</h4>
                  <p className="text-sm text-muted-foreground">
                    Áp dụng giảm giá nếu có, chọn phương thức thanh toán và hoàn tất đơn hàng
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quản lý kho hàng */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quản lý kho hàng
            </CardTitle>
            <CardDescription>Hướng dẫn quản lý iPhone Lock và phụ kiện</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">iPhone Lock:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Mỗi máy có IMEI duy nhất</li>
                  <li>• Phân loại theo tình trạng: Mới, Cũ, Refurbished</li>
                  <li>• Trạng thái: Còn hàng, Đã bán, Lỗi</li>
                  <li>• Validation IMEI tự động</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Phụ kiện:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Quản lý theo số lượng tồn kho</li>
                  <li>• Tự động trừ khi bán</li>
                  <li>• Cảnh báo khi sắp hết hàng</li>
                  <li>• Phân loại theo danh mục</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bảo mật */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Bảo mật và phân quyền
            </CardTitle>
            <CardDescription>Hệ thống bảo mật và phân quyền người dùng</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Quản lý:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Truy cập tất cả chức năng</li>
                  <li>• Quản lý nhân viên</li>
                  <li>• Xem thống kê chi tiết</li>
                  <li>• Cài đặt hệ thống</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Nhân viên:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Bán hàng và quản lý kho</li>
                  <li>• Xem khách hàng và đơn hàng</li>
                  <li>• Không thể quản lý nhân viên</li>
                  <li>• Hạn chế một số thống kê</li>
                </ul>
              </div>
            </div>
            <Separator />
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Row Level Security (RLS):</h4>
              <p className="text-sm text-muted-foreground">
                Tất cả dữ liệu được bảo vệ bằng RLS policies, đảm bảo người dùng chỉ truy cập được dữ liệu được phép.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Liên hệ hỗ trợ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Hỗ trợ kỹ thuật
            </CardTitle>
            <CardDescription>Thông tin liên hệ khi cần hỗ trợ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Hệ thống được xây dựng bằng Next.js và Supabase. Để được hỗ trợ kỹ thuật hoặc báo lỗi, vui lòng liên hệ
                với đội ngũ phát triển.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
