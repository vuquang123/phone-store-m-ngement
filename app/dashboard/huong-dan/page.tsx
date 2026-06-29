"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BookOpen,
  ShoppingCart,
  Package,
  Bell,
  UserCheck,
  Smartphone,
  Repeat,
  Wallet,
  Truck,
  ClipboardCheck,
  ClipboardX,
  Users,
  Settings,
  CreditCard,
  Search,
  RefreshCw,
  Hammer,
  CircleUserRound,
  ListChecks,
  StickyNote,
  CheckCircle2,
} from "lucide-react"

type Role = "quan_ly" | "nhan_vien" | undefined

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("auth_user")
    const data = raw ? JSON.parse(raw) : {}
    if (typeof data?.email === "string") return { "x-user-email": data.email }
  } catch {}
  return {}
}

export default function HuongDanPage() {
  const [role, setRole] = useState<Role>()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
        if (res.ok) {
          const me = await res.json()
          if (mounted) setRole(me?.role as Role)
        }
      } catch {}
    })()
    return () => {
      mounted = false
    }
  }, [])

  const VisibleIf = ({ allow, children }: { allow?: Role[]; children: React.ReactNode }) => {
    if (!allow || allow.includes(role as Role)) return <>{children}</>
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Hướng dẫn sử dụng</h1>
        <p className="text-muted-foreground">
          Cách dùng hệ thống cho{" "}
          {role === "quan_ly" ? "Quản lý" : role === "nhan_vien" ? "Nhân viên" : "bạn"} — đọc một
          lượt là làm được việc.
        </p>
      </div>

      {/* ============== QUY TRÌNH MỘT CA LÀM VIỆC ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            Quy trình một ca làm việc
          </CardTitle>
          <CardDescription>Làm theo thứ tự này mỗi ca là đủ</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              {
                t: "Đăng nhập",
                d: "Vào hệ thống bằng email + mật khẩu được cấp.",
              },
              {
                t: "Check-in đầu ca",
                d: "Bấm avatar (góc trên phải) → Check-in đầu ca → đếm số máy 2 kho, đối chiếu web, đính ảnh, Gửi.",
              },
              {
                t: "Xem Ghi chú bàn giao ca",
                d: "Mở tab Ghi chú → đọc bảng \"Chưa xử lý\" để biết việc ca trước để lại; làm xong việc nào bấm Hoàn thành việc đó.",
              },
              {
                t: "Bán hàng trong ca",
                d: "Vào Bán hàng (POS): tìm máy → thêm vào giỏ → chọn khách → chọn phương thức thanh toán → Thanh toán.",
              },
              {
                t: "Theo dõi đơn / kho",
                d: "Đơn online giao GHTK xem ở tab Đơn online; nhập hàng mới / gửi CNC ở Kho hàng.",
              },
              {
                t: "Báo cáo cuối ca (Check-out)",
                d: "Bấm avatar → Báo cáo cuối ca → chốt lại số máy + tài chính (bán ra, thu vào, tiền mặt bàn giao), Gửi. Còn việc dang dở → tạo Ghi chú bàn giao cho ca sau.",
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <div className="font-medium">{s.t}</div>
                  <div className="text-sm text-muted-foreground">{s.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ============== ĐIỀU HƯỚNG ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Tìm chức năng ở đâu?
          </CardTitle>
          <CardDescription>2 nơi chính: thanh bên trái và menu avatar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <ListChecks className="h-4 w-4" /> Thanh bên trái (Sidebar)
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <b>Kho hàng</b> · <b>Bán hàng</b> · <b>Đơn hàng</b> · <b>Khách hàng</b></li>
                <li>• <b>Hoàn trả</b> · <b>Quỹ tiền mặt</b> · <b>Đơn online</b></li>
                <li>• <b>Ghi chú</b> (bàn giao ca) · <b>Thông báo</b></li>
                <li>• (Quản lý) Dashboard · Nhân viên · Cài đặt</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Trên điện thoại: bấm nút ☰ ở góc trên trái để mở/đóng menu.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <CircleUserRound className="h-4 w-4" /> Menu avatar (góc trên phải)
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <b>Check-in đầu ca</b> · <b>Báo cáo cuối ca</b></li>
                <li>• Hồ sơ cá nhân · Cài đặt (Quản lý)</li>
                <li>• Đăng xuất</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                🔔 Chuông cạnh avatar: xem nhanh 5 thông báo mới nhất.
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <b>Mẹo:</b> Các trang có bảng/danh sách đều có nút{" "}
            <RefreshCw className="inline h-3.5 w-3.5" /> <b>Làm mới</b> để tải lại dữ liệu mới nhất
            từ Google Sheet khi nghi ngờ dữ liệu cũ.
          </div>
        </CardContent>
      </Card>

      {/* ============== CHECK-IN ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            Check-in đầu ca
          </CardTitle>
          <CardDescription>Avatar → Check-in đầu ca</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="space-y-1">
            <li>1. Chọn <b>Ca</b> (1/2/3).</li>
            <li>2. Đếm và nhập số máy cho <b>KHO NGOÀI</b> và <b>KHO TRONG</b>: Website, Thực tế, 17/16/15 Series, Ipad, Khác. (Dòng &quot;Tổng theo dòng máy&quot; giúp bạn tự đối chiếu.)</li>
            <li>3. Chọn <b>Trạng thái</b>: Khớp hoặc Không khớp (nếu không khớp → ghi <b>Lý do</b>).</li>
            <li>4. Đính kèm ảnh (tối đa 6) nếu cần minh chứng.</li>
            <li>5. Bấm <b>Gửi check-in</b> → báo cáo tự gửi vào nhóm Telegram và lưu lịch sử ngay trên trang.</li>
          </ul>
        </CardContent>
      </Card>

      {/* ============== BÁN HÀNG (POS) ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Bán hàng (POS)
          </CardTitle>
          <CardDescription>Trái: tìm sản phẩm · Phải: giỏ hàng & thanh toán</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="mb-1 flex items-center gap-2 font-medium">
              <Search className="h-4 w-4" /> 1. Tìm & thêm sản phẩm
            </h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Gõ <b>tên máy / IMEI / Serial / tên phụ kiện</b> để tìm.</li>
              <li>• Lọc nhanh theo <b>Nguồn</b> (Kho trong / Kho ngoài) và <b>Loại</b> (iPhone / iPad / Phụ kiện).</li>
              <li>• <b>Máy tính:</b> bấm vào dòng (máy tính bàn) hoặc <b>icon giỏ</b> trên card (điện thoại) để thêm vào giỏ.</li>
              <li>• Mỗi máy hiện: màu, dung lượng, loại (Quốc tế/Lock), pin %, tình trạng, nguồn kho — kiểm tra trước khi thêm.</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-1 font-medium">2. Giỏ hàng</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Sửa giá bán từng máy nếu cần; chọn <b>gói bảo hành</b> (phí tự cộng vào tổng).</li>
              <li>• Máy <b>kho ngoài</b>: nhập đúng IMEI rồi bấm xác nhận trước khi bán.</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-1 flex items-center gap-2 font-medium">
              <CreditCard className="h-4 w-4" /> 3. Thanh toán
            </h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Chọn <b>khách hàng</b> (hoặc để Khách lẻ).</li>
              <li>• <b>Loại đơn:</b> Đơn off (tại quầy) hoặc <b>Đơn onl</b>. Nếu Đơn onl + đơn vị <b>GHTK</b> → nhập <b>Mã đơn hàng GHTK</b> và Địa chỉ nhận.</li>
              <li>• <b>Phương thức:</b> Tiền mặt / Chuyển khoản / Thẻ / Trả góp — có thể chia nhiều phương thức trên cùng đơn.</li>
              <li>• <b>Loại thanh toán:</b> Thanh toán đủ hoặc <b>Đặt cọc</b> (nhập số cọc; tất toán sau ở tab Đơn đặt cọc).</li>
              <li>• Bấm <b>Thanh toán</b>. Sau khi thành công, các ô thanh toán tự xoá để bán đơn tiếp theo.</li>
              <li>• 💵 Phần trả <b>tiền mặt</b> tự động <b>cộng vào Quỹ tiền mặt</b> (Nguồn: khách offline/online).</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/ban-hang"><Button size="sm">Mở POS bán hàng</Button></Link>
          </div>
        </CardContent>
      </Card>

      {/* ============== KHO HÀNG ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kho hàng
          </CardTitle>
          <CardDescription>Sản phẩm · Phụ kiện · CNC · Bảo hành · Đối tác</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="space-y-1">
            <li>• <b>Nhập hàng:</b> bấm <b>Nhập hàng</b>, điền thông tin + IMEI — hệ thống tự sinh ID Máy, danh sách tự cập nhật.</li>
            <li>• Đọc badge nhanh: <span className="font-medium text-emerald-600">Quốc tế</span> / <span className="font-medium text-amber-600">Lock</span>, màu pin theo % (xanh tốt → đỏ yếu), Kho trong/Kho ngoài, Dạng Sim.</li>
            <li>• <b>Thao tác nhiều máy:</b> bấm icon <Hammer className="inline h-3.5 w-3.5" /> chế độ chọn → tick các máy → <b>Gửi CNC</b> / <b>Giao đối tác</b> / <b>Chuyển kho</b>.</li>
            <li>• Trên điện thoại, mỗi máy hiển thị dạng <b>thẻ</b> đủ thông tin (không cần kéo ngang).</li>
            <li>• Dùng bộ lọc (nguồn, loại máy, giá, pin) + ô tìm kiếm để thu hẹp danh sách.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/kho-hang"><Button size="sm" variant="outline">Tới Kho hàng</Button></Link>
          </div>
        </CardContent>
      </Card>

      {/* ============== ĐƠN HÀNG & HOÀN TRẢ ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Đơn hàng & Hoàn trả
          </CardTitle>
          <CardDescription>Tra cứu đơn đã bán và xử lý trả hàng</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <h4 className="mb-1 font-medium text-foreground">Đơn hàng</h4>
            <ul className="space-y-1">
              <li>• Cột Trạng thái: <span className="font-medium text-emerald-600">Thành công</span> · <span className="font-medium text-amber-600">Đã hoàn</span> · <span className="font-medium text-red-600">Đã hủy</span>.</li>
              <li>• Đơn online (GHTK) hiển thị thêm badge trạng thái vận chuyển ngay tại dòng.</li>
              <li>• Bấm icon 👁 để xem chi tiết: sản phẩm, bảo hành, thanh toán, tra cứu GHTK và <b>Hoàn trả</b>.</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-1 font-medium text-foreground">Hoàn trả (trong chi tiết đơn)</h4>
            <ul className="space-y-1">
              <li>• Chọn <b>IMEI máy cần hoàn</b>, nhập <b>số tiền hoàn</b> và <b>lý do</b> → <b>Xác nhận hoàn trả</b>.</li>
              <li>• Hệ thống khoá theo <b>Mã đơn hàng</b> (IMEI có thể trùng giữa nhiều đơn nên không dùng IMEI một mình).</li>
              <li>• Máy <b>tự về Kho hàng</b>: Trạng thái <b>Còn hàng</b>, Trạng thái kho <b>Kho ngoài</b>, giá bán = giá khách đã mua.</li>
              <li>• Bảo hành theo IMEI bị huỷ; Tổng Mua của khách trừ đi số tiền hoàn.</li>
              <li>• Đơn đã hoàn hiển thị ở trang <b>Hoàn trả</b> (kèm tên máy, màu, dung lượng).</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/ban-hang/don-hang"><Button size="sm" variant="outline">Xem đơn hàng</Button></Link>
            <Link href="/dashboard/hoan-tra"><Button size="sm" variant="outline">Danh sách hoàn trả</Button></Link>
          </div>
        </CardContent>
      </Card>

      {/* ============== QUỸ TIỀN MẶT ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            Quỹ tiền mặt
          </CardTitle>
          <CardDescription>Theo dõi thu/chi tiền mặt của cửa hàng</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="space-y-1">
            <li>• Xem <b>Số dư hiện tại</b> + biểu đồ thu/chi, lọc theo Ngày/Tháng/Năm.</li>
            <li>• <b>Nhập quỹ</b> (tiền vào) / <b>Xuất quỹ</b> (tiền ra): nhập số tiền, lý do, đính ảnh nếu cần minh bạch.</li>
            <li>• Bán hàng trả tiền mặt sẽ <b>tự ghi vào quỹ</b> — không cần nhập tay khoản đó.</li>
            <li>• Mọi giao dịch đều lưu lịch sử (phân trang) và gửi Telegram quỹ.</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/dashboard/tien-mat"><Button size="sm" variant="outline">Mở Quỹ tiền mặt</Button></Link>
          </div>
        </CardContent>
      </Card>

      {/* ============== ĐƠN ONLINE (GHTK) ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Đơn online (GHTK)
          </CardTitle>
          <CardDescription>Theo dõi giao hàng qua Giao Hàng Tiết Kiệm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="space-y-1">
            <li>• Chỉ hiển thị đơn đã nhập <b>Mã GHTK</b> lúc bán (Đơn onl + đơn vị GHTK).</li>
            <li>• Mỗi dòng cho biết: shipper đã <b>Lấy hàng</b> chưa, đã <b>Vận chuyển</b> chưa, <b>tiền COD</b> và trạng thái.</li>
            <li>• Bấm 👁 để xem chi tiết & tra cứu đầy đủ (ngày lấy/giao, người nhận, phí ship).</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/dashboard/don-online"><Button size="sm" variant="outline">Mở Đơn online</Button></Link>
          </div>
        </CardContent>
      </Card>

      {/* ============== KHÁCH HÀNG & THÔNG BÁO ============== */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Khách hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="space-y-1">
              <li>• Tìm khách theo tên / số điện thoại.</li>
              <li>• <b>Tổng Mua</b> tự cập nhật khi bán và khi hoàn trả.</li>
              <li>• Xem lịch sử mua của từng khách.</li>
            </ul>
            <Link href="/dashboard/khach-hang"><Button size="sm" variant="outline">Mở Khách hàng</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Thông báo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="space-y-1">
              <li>• 🔔 ở header: 5 thông báo mới nhất, bấm &quot;Xem tất cả&quot; để mở trang đầy đủ.</li>
              <li>• Bao gồm: đơn mới, hoàn trả, biến động kho, quỹ tiền mặt.</li>
              <li>• Bấm vào thông báo để đánh dấu đã đọc.</li>
            </ul>
            <Link href="/dashboard/thong-bao"><Button size="sm" variant="outline">Mở Thông báo</Button></Link>
          </CardContent>
        </Card>
      </div>

      {/* ============== CHECK-OUT ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardX className="h-5 w-5 text-orange-600" />
            Báo cáo cuối ca (Check-out)
          </CardTitle>
          <CardDescription>Avatar → Báo cáo cuối ca</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="space-y-1">
            <li>• Giống Check-in: chọn Ca, đếm lại số máy 2 kho, trạng thái Khớp/Không khớp.</li>
            <li>• Thêm khối <b>Tài chính & đơn hàng</b>: số đơn bán ra (Off/Onl), thu vào, <b>tiền mặt bàn giao</b>, ghi chú cho ca sau.</li>
            <li>• Đính ảnh (nếu cần) → <b>Gửi báo cáo</b> → vào nhóm Telegram + lưu lịch sử.</li>
          </ul>
        </CardContent>
      </Card>

      {/* ============== GHI CHÚ BÀN GIAO CA ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-600" />
            Ghi chú bàn giao ca
          </CardTitle>
          <CardDescription>Ca trước ghi việc cần làm — ca sau xem & đánh dấu hoàn thành</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h4 className="mb-1 font-medium text-foreground">Dùng để làm gì?</h4>
            <p>
              Nơi lưu các <b>việc còn dang dở / cần lưu ý</b> giữa các ca (vd: máy chờ CNC về, khách hẹn
              quay lại, đơn cần đối soát…). Ca sau mở tab này là biết ngay phải xử lý gì, không sót việc.
            </p>
          </div>
          <div>
            <h4 className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <StickyNote className="h-4 w-4" /> Tạo ghi chú
            </h4>
            <ul className="space-y-1">
              <li>• Nhập nội dung vào ô <b>Tạo ghi chú</b> ở đầu trang → bấm <b>Tạo ghi chú</b>.</li>
              <li>• Hệ thống tự lưu kèm <b>tên người tạo</b> và <b>thời gian</b>, đồng thời báo vào nhóm Telegram bàn giao ca.</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4" /> Đánh dấu hoàn thành
            </h4>
            <ul className="space-y-1">
              <li>• Ở bảng <b>Chưa xử lý</b>, bấm nút <b>Hoàn thành</b> trên dòng việc đã xong.</li>
              <li>• Hệ thống ghi lại <b>người hoàn thành</b> + <b>thời gian</b> và báo Telegram. Việc đã hoàn thành <b>không sửa lại được</b>.</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-1 font-medium text-foreground">3 bảng trên trang</h4>
            <ul className="space-y-1">
              <li>• <b>Chưa xử lý:</b> mọi việc còn tồn (mọi ngày), <b>việc cũ nhất lên đầu</b> để ưu tiên — có nút Hoàn thành.</li>
              <li>• <b>Hôm nay:</b> việc được <b>tạo hoặc hoàn thành trong hôm nay</b>, kèm badge <span className="font-medium text-orange-600">Chưa xử lý</span> / <span className="font-medium text-emerald-600">Hoàn thành</span>.</li>
              <li>• <b>Lịch sử:</b> các việc <b>đã hoàn thành</b> (mới nhất trước), đầy đủ người & ngày hoàn thành.</li>
            </ul>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <b>Mẹo:</b> Ghi ngắn gọn, rõ “việc gì + máy/đơn nào”. Bấm{" "}
            <RefreshCw className="inline h-3.5 w-3.5" /> <b>Làm mới</b> để cập nhật danh sách mới nhất.
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/ghi-chu"><Button size="sm" variant="outline">Mở Ghi chú bàn giao ca</Button></Link>
          </div>
        </CardContent>
      </Card>

      {/* ============== DÀNH CHO QUẢN LÝ ============== */}
      <VisibleIf allow={["quan_ly"]}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Dành riêng cho Quản lý
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h4 className="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <Users className="h-4 w-4" /> Nhân viên
                </h4>
                <ul className="space-y-1">
                  <li>• Thêm/sửa tài khoản, phân quyền <b>Quản lý / Nhân viên</b>.</li>
                  <li>• Nhân viên bị ẩn các mục nhạy cảm (Dashboard, Cài đặt).</li>
                </ul>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="mb-1 flex items-center gap-2 font-medium text-foreground">
                  <Settings className="h-4 w-4" /> Cài đặt & Dashboard
                </h4>
                <ul className="space-y-1">
                  <li>• Tải logo cửa hàng (hiển thị ngay ở header).</li>
                  <li>• Dashboard: doanh thu/lợi nhuận theo tháng, biểu đồ thống kê.</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/nhan-vien"><Button size="sm" variant="outline">Quản lý nhân viên</Button></Link>
              <Link href="/dashboard/cai-dat"><Button size="sm" variant="outline">Cài đặt</Button></Link>
              <Link href="/dashboard"><Button size="sm" variant="outline">Dashboard</Button></Link>
            </div>
          </CardContent>
        </Card>
      </VisibleIf>

      {/* ============== LƯU Ý ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Lưu ý quan trọng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• <b>Kiểm tra kỹ máy</b> (IMEI, pin, tình trạng, nguồn kho) trước khi thêm vào giỏ.</li>
            <li>• Mỗi <b>Mã đơn hàng là duy nhất</b>; một IMEI có thể xuất hiện ở nhiều đơn (máy bán lại) — luôn thao tác theo mã đơn.</li>
            <li>• Khi nghi ngờ dữ liệu cũ, bấm nút <RefreshCw className="inline h-3.5 w-3.5" /> <b>Làm mới</b> trên trang đó.</li>
            <li>• Nếu Telegram không nhận được báo cáo, dữ liệu <b>vẫn được lưu</b> trên hệ thống — báo Quản lý kiểm tra cấu hình bot.</li>
            <li>• Gặp lỗi/quá tải, thử lại sau ít phút hoặc liên hệ bộ phận kỹ thuật.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
