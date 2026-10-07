// Trang Kho hàng đã được GỘP vào /dashboard/ban-hang: một trang, một bảng máy, một bộ lọc.
// Giữ lại route này để link/bookmark cũ và các chỗ điều hướng trong app không bị 404.
import { redirect } from "next/navigation"

export default function KhoHangRedirectPage() {
  redirect("/dashboard/ban-hang")
}
