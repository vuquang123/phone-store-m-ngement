"use client"
// Tab "Đơn đặt cọc" — tách verbatim từ app/dashboard/ban-hang/page.tsx (refactor thuần, GIỮ NGUYÊN hành vi).
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search } from "lucide-react"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
import type { CartItem, Customer } from "@/lib/types/ban-hang"

dayjs.extend(customParseFormat)

interface DepositOrdersTabProps {
  depositOrdersState: any[]
  depositSearch: string
  setDepositSearch: (v: string) => void
  depositLoading: boolean
  setCart: (items: CartItem[]) => void
  setSelectedCustomer: (c: Customer | null) => void
  setCurrentDepositOrderId: (v: string | null) => void
  setDepositAmountAlreadyPaid: (v: number) => void
  setLoaiThanhToan: (v: string) => void
  toast: (props: any) => void
  setActiveTab: (v: string) => void
  handleCancelDeposit: (maDon: string) => void
}

export function DepositOrdersTab({
  depositOrdersState,
  depositSearch,
  setDepositSearch,
  depositLoading,
  setCart,
  setSelectedCustomer,
  setCurrentDepositOrderId,
  setDepositAmountAlreadyPaid,
  setLoaiThanhToan,
  toast,
  setActiveTab,
  handleCancelDeposit,
}: DepositOrdersTabProps) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <CardTitle>Đơn đặt cọc</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Chỉ hiển thị đơn đặt cọc</p>
        </div>
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm mã đơn, tên KH, SDT..." value={depositSearch} onChange={(e) => setDepositSearch(e.target.value)} className="pl-9 w-full" />
        </div>
      </CardHeader>
      <CardContent>
        {(() => {
           const filtered = depositOrdersState.filter(o => {
              const status = (o["Trạng Thái"] || o["trang_thai"] || o["Trạng thái"] || o["status"] || "").toString().trim().toLowerCase();
              if (status !== "đặt cọc") return false;
              const m = o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"] || "";
              const k = o["Tên Khách Hàng"] || o["ten_khach_hang"] || "";
              return String(m).toLowerCase().includes(depositSearch.toLowerCase()) || String(k).toLowerCase().includes(depositSearch.toLowerCase());
           });
           if (depositLoading) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;
           if (filtered.length === 0) return <div className="p-8 text-center text-muted-foreground">Không tìm thấy đơn nào.</div>;
           return (
             <div className="overflow-x-auto">
               <Table>
                 <TableHeader>
                   <TableRow className="bg-muted">
                     <TableHead>
                       <div className="flex items-center gap-2">
                         Mã Đơn Hàng
                         <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 py-0 leading-none h-5">
                           {filtered.length}
                         </Badge>
                       </div>
                     </TableHead>
                     <TableHead>Khách</TableHead>
                     <TableHead>Sản phẩm</TableHead>
                     <TableHead>IMEI</TableHead>
                     <TableHead>Trạng thái máy</TableHead>
                     <TableHead>Tổng đã cọc</TableHead>
                     <TableHead>Tổng còn lại</TableHead>
                     <TableHead>Ngày cọc</TableHead>
                     <TableHead>Hạn TT</TableHead>
                     <TableHead>Thao tác</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filtered.map((order, i) => {
                     const maDon = order["Mã Đơn Hàng"] || order["ID Đơn Hàng"] || order["ma_don_hang"] || "-";
                     const tenKhach = order["Tên Khách Hàng"] || order["ten_khach_hang"] || "-";
                     const sdtKhach = order["Số Điện Thoại"] || order["so_dien_thoai"] || "";
                     const sanPhamBase = order["Tên Sản Phẩm"] || order["ten_san_pham"] || "-";
                     const mauSac = order["Màu Sắc"] || order["mau_sac"] || "";
                     const sanPham = mauSac ? `${sanPhamBase} (${mauSac})` : sanPhamBase;
                     const imei = order["IMEI"] || order["imei"] || "-";
                     const trangThaiMay = order["Tình Trạng Máy"] || order["tinh_trang_may"] || "-";

                     let tongDaCoc = order["Số Tiền Cọc"] || order["so_tien_coc"] || 0;
                     if (typeof tongDaCoc === 'string') tongDaCoc = Number(tongDaCoc.replace(/[^\d]/g, '')) || 0;

                     let tongConLai = order["Số Tiền Còn Lại"] || order["Còn Lại"] || order["so_tien_con_lai"] || 0;
                     if (typeof tongConLai === 'string') tongConLai = Number(tongConLai.replace(/[^\d]/g, '')) || 0;

                     const ngayCocRaw = order["Ngày Đặt Cọc"] || order["Ngày Cọc"] || order["Ngày Xuất"] || order["ngay_xuat"];
                     let ngayCoc = "-";
                     if (ngayCocRaw) {
                       const d = dayjs(ngayCocRaw, ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD"]);
                       ngayCoc = d.isValid() ? d.format("DD/MM/YYYY") : ngayCocRaw;
                     }

                     const hanRaw = order["Hạn Thanh Toán"] || order["han_thanh_toan"];
                     let han = "-";
                     if (hanRaw) {
                       const d = dayjs(hanRaw, ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD"]);
                       han = d.isValid() ? d.format("DD/MM/YYYY") : hanRaw;
                     }

                     return (
                       <TableRow key={i}>
                         <TableCell className="font-medium whitespace-nowrap">{maDon}</TableCell>
                         <TableCell>
                            <div className="font-medium">{tenKhach}</div>
                            <div className="text-xs text-muted-foreground">{sdtKhach}</div>
                         </TableCell>
                         <TableCell className="min-w-[200px]">{sanPham}</TableCell>
                         <TableCell className="whitespace-nowrap">{imei}</TableCell>
                         <TableCell>
                            <span className="bg-muted text-foreground px-2 py-1 rounded text-xs whitespace-nowrap">{trangThaiMay}</span>
                         </TableCell>
                         <TableCell className="text-blue-600 font-semibold whitespace-nowrap align-middle">
                            <span>₫{tongDaCoc.toLocaleString('vi-VN')}</span>
                         </TableCell>
                         <TableCell className="text-emerald-600 font-semibold whitespace-nowrap align-middle">
                            <span className="border-b border-emerald-600/30 pb-0.5">₫{tongConLai.toLocaleString('vi-VN')}</span>
                         </TableCell>
                         <TableCell className="whitespace-nowrap">{ngayCoc}</TableCell>
                         <TableCell className="whitespace-nowrap">{han}</TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white whitespace-nowrap h-8 px-3" onClick={() => {
                                const allRows = depositOrdersState.filter(o => (o["Mã Đơn Hàng"] || o["ID Đơn Hàng"] || o["ma_don_hang"]) === maDon);
                                const products: CartItem[] = allRows.map((o: any) => ({
                                  id: o["IMEI"] || o["Serial"] || o["ID Máy"] || o["Tên Sản Phẩm"] || o["ten_san_pham"] || o["imei"] || o["serial"] || o["id"],
                                  type: "product",
                                  ten_san_pham: o["Tên Sản Phẩm"] || o["ten_san_pham"] || "",
                                  gia_ban: typeof o["Giá Bán"] === "string" ? parseInt(o["Giá Bán"].replace(/[^\d]/g, "")) || 0 : o["Giá Bán"] || 0,
                                  gia_nhap: typeof o["Giá Nhập"] === "string" ? parseInt(o["Giá Nhập"].replace(/[^\d]/g, "")) || 0 : o["Giá Nhập"] || 0,
                                  so_luong: 1,
                                  max_quantity: 1,
                                  imei: o["IMEI"] || "",
                                  serial: o["Serial"] || "",
                                  trang_thai: o["Tình Trạng Máy"] || o["tinh_trang_may"] || "",
                                  loai_may: o["Loại Máy"] || o["loai_may"] || "",
                                  dung_luong: o["Dung Lượng"] || o["dung_luong"] || "",
                                  mau_sac: o["Màu Sắc"] || o["mau_sac"] || "",
                                  pin: o["Pin (%)"] || o["pin"] || "",
                                  tinh_trang: o["Tình Trạng Máy"] || o["tinh_trang_may"] || ""
                                }));
                                setCart(products);
                                setSelectedCustomer({
                                  id: sdtKhach,
                                  ho_ten: tenKhach,
                                  so_dien_thoai: sdtKhach
                                });
                                 // Tính tổng tiền đã cọc từ tất cả các dòng của đơn này
                                 const totalPaid = allRows.reduce((sum, o: any) => {
                                   let val = o["Số Tiền Cọc"] || o["so_tien_coc"] || 0;
                                   if (typeof val === 'string') val = Number(String(val).replace(/[^\d]/g, '')) || 0;
                                   return sum + (Number(val) || 0);
                                 }, 0);

                                 setCurrentDepositOrderId(maDon || null);
                                 setDepositAmountAlreadyPaid(totalPaid || 0);
                                 setLoaiThanhToan("Thanh toán đủ");
                                 toast({ title: 'Đã tải đơn đặt cọc', description: `Đã cọc: ₫${(totalPaid || 0).toLocaleString('vi-VN')}. Vui lòng thanh toán số còn lại.` });

                                setActiveTab("ban-hang");
                             }}>Thanh toán tiếp</Button>
                             <Button size="sm" variant="destructive" className="bg-red-500 hover:bg-red-600 whitespace-nowrap h-8 px-3" onClick={async () => {
                                if (!confirm(`Bạn có chắc muốn hủy đơn đặt cọc ${maDon}?`)) return;
                                handleCancelDeposit(maDon);
                             }}>Hủy đặt cọc</Button>
                           </div>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                 </TableBody>
               </Table>
             </div>
           );
        })()}
      </CardContent>
    </Card>
  )
}
