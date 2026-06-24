"use client"
// Cột Thanh toán — tách verbatim từ app/dashboard/ban-hang/page.tsx (refactor thuần, GIỮ NGUYÊN hành vi).
// Component thuần trình bày: mọi handler chỉ gọi setter nhận từ prop. Tên prop = tên biến gốc để map 1:1.
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import ImagePicker from '@/components/tele/ImagePicker'

interface PaymentColumnProps {
  // Payment methods
  cashEnabled: boolean; setCashEnabled: (v: boolean) => void
  cashAmount: number; setCashAmount: (v: number) => void
  transferEnabled: boolean; setTransferEnabled: (v: boolean) => void
  transferAmount: number; setTransferAmount: (v: number) => void
  cardEnabled: boolean; setCardEnabled: (v: boolean) => void
  cardAmount: number; setCardAmount: (v: number) => void
  installmentEnabled: boolean; setInstallmentEnabled: (v: boolean) => void
  installmentType: string; setInstallmentType: (v: any) => void
  installmentDown: number; setInstallmentDown: (v: number) => void
  installmentLoan: number; setInstallmentLoan: (v: number) => void
  sumPayments: number
  expectedCollect: number
  // Discount
  handleDiscountPreset: (preset: string) => void
  giamGiaInput: string; setGiamGiaInput: (v: string) => void
  setGiamGia: (v: number) => void
  setDiscountParseMsg: (v: string) => void
  computedDiscountMsg: string
  discountParseMsg: string
  // Note
  ghiChu: string; setGhiChu: (v: string) => void
  // Totals
  tongTien: number
  warrantyTotal: number
  giamGiaToUse: number
  currentDepositOrderId: string | null
  depositAmountAlreadyPaid: number
  finalThanhToan: number
  // Order type
  loaiDon: string; setLoaiDon: (v: string) => void
  hinhThucVanChuyen: string; setHinhThucVanChuyen: (v: string) => void
  diaChiNhan: string; setDiaChiNhan: (v: string) => void
  // Payment type
  loaiThanhToan: string; setLoaiThanhToan: (v: string) => void
  soTienCoc: number; setSoTienCoc: (v: number) => void
  ngayHenTraDu: string; setNgayHenTraDu: (v: string) => void
  // Receipt
  receiptBlobs: Blob[] | null; setReceiptBlobs: (v: Blob[] | null) => void
  // Checkout
  isLoading: boolean
  cartCount: number
  handleCheckout: () => void
}

export function PaymentColumn(props: PaymentColumnProps) {
  const {
    cashEnabled, setCashEnabled, cashAmount, setCashAmount,
    transferEnabled, setTransferEnabled, transferAmount, setTransferAmount,
    cardEnabled, setCardEnabled, cardAmount, setCardAmount,
    installmentEnabled, setInstallmentEnabled, installmentType, setInstallmentType,
    installmentDown, setInstallmentDown, installmentLoan, setInstallmentLoan,
    sumPayments, expectedCollect,
    handleDiscountPreset, giamGiaInput, setGiamGiaInput, setGiamGia, setDiscountParseMsg,
    computedDiscountMsg, discountParseMsg,
    ghiChu, setGhiChu,
    tongTien, warrantyTotal, giamGiaToUse, currentDepositOrderId, depositAmountAlreadyPaid, finalThanhToan,
    loaiDon, setLoaiDon, hinhThucVanChuyen, setHinhThucVanChuyen, diaChiNhan, setDiaChiNhan,
    loaiThanhToan, setLoaiThanhToan, soTienCoc, setSoTienCoc, ngayHenTraDu, setNgayHenTraDu,
    receiptBlobs, setReceiptBlobs,
    isLoading, cartCount, handleCheckout,
  } = props
  return (
    <Card>
      <CardHeader><CardTitle>Thanh toán</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Phương thức thanh toán</label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer w-28">
                  <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={cashEnabled} onChange={(e) => { setCashEnabled(e.target.checked); if (!e.target.checked) setCashAmount(0); }} />
                  <span className="text-sm">Tiền mặt</span>
                </label>
                {cashEnabled && <Input className="flex-1" placeholder="₫0" value={cashAmount ? cashAmount.toLocaleString('vi-VN') : ''} onChange={(e) => setCashAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer w-28">
                  <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={transferEnabled} onChange={(e) => { setTransferEnabled(e.target.checked); if (!e.target.checked) setTransferAmount(0); }} />
                  <span className="text-sm">Chuyển khoản</span>
                </label>
                {transferEnabled && <Input className="flex-1" placeholder="₫0" value={transferAmount ? transferAmount.toLocaleString('vi-VN') : ''} onChange={(e) => setTransferAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer w-28">
                  <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={cardEnabled} onChange={(e) => { setCardEnabled(e.target.checked); if (!e.target.checked) setCardAmount(0); }} />
                  <span className="text-sm">Thẻ</span>
                </label>
                {cardEnabled && <Input className="flex-1" placeholder="₫0" value={cardAmount ? cardAmount.toLocaleString('vi-VN') : ''} onChange={(e) => setCardAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer w-28">
                    <input type="checkbox" className="rounded-full w-4 h-4 accent-blue-600" checked={installmentEnabled} onChange={(e) => { setInstallmentEnabled(e.target.checked); if (!e.target.checked) { setInstallmentDown(0); setInstallmentLoan(0); setInstallmentType(''); } }} />
                    <span className="text-sm">Trả góp</span>
                  </label>
                  {installmentEnabled && (
                    <Select value={installmentType} onValueChange={(val: any) => setInstallmentType(val)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Chọn đối tác..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Góp iCloud">Góp iCloud</SelectItem>
                        <SelectItem value="Thẻ tín dụng">Thẻ tín dụng</SelectItem>
                        <SelectItem value="Mira">Mira</SelectItem>
                        <SelectItem value="HDSaison">HDSaison</SelectItem>
                        <SelectItem value="HomeCredit">HomeCredit</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {installmentEnabled && (
                  <div className="flex items-center gap-3 pl-7">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">Trả trước (Khách đưa)</label>
                      <Input placeholder="₫0" value={installmentDown ? installmentDown.toLocaleString('vi-VN') : ''} onChange={(e) => setInstallmentDown(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">Góp (Khoản vay)</label>
                      <Input placeholder="₫0" value={installmentLoan ? installmentLoan.toLocaleString('vi-VN') : ''} onChange={(e) => setInstallmentLoan(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Tổng đã nhập: ₫{sumPayments.toLocaleString('vi-VN')} • Cần thu: ₫{expectedCollect.toLocaleString('vi-VN')}
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Giảm giá</label>
              <div className="flex items-center gap-1">
                {['50k', '100k', '200k', '5%', '10%'].map(pres => (
                  <button key={pres} type="button" onClick={() => handleDiscountPreset(pres)} className="px-2 py-1 text-[11px] border rounded hover:bg-slate-100">{pres}</button>
                ))}
                <button type="button" onClick={() => handleDiscountPreset('Reset')} className="px-2 py-1 text-[11px] border rounded hover:bg-slate-100">Reset</button>
              </div>
            </div>
            <Input
              placeholder="Ví dụ: 100k hoặc 10%"
              value={giamGiaInput}
              onChange={(e) => { setGiamGiaInput(e.target.value); if(!e.target.value.trim()){ setGiamGia(0); setDiscountParseMsg(''); } }}
            />
            {(computedDiscountMsg || discountParseMsg) && <p className="text-xs text-blue-600 font-medium">{computedDiscountMsg || discountParseMsg}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ghi chú</label>
            <Input
              placeholder="Ghi chú đơn hàng..."
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tiền hàng:</span>
              <span>₫{tongTien.toLocaleString()}</span>
            </div>
            {warrantyTotal > 0 && (
              <div className="flex justify-between text-sm text-blue-700">
                <span>Bảo hành:</span>
                <span>+₫{warrantyTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Giảm giá:</span>
              <span>-₫{giamGiaToUse.toLocaleString()}</span>
            </div>
            {currentDepositOrderId && depositAmountAlreadyPaid > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span>Sẵn có (Tiền cọc):</span>
                <span>-₫{depositAmountAlreadyPaid.toLocaleString()}</span>
              </div>
            )}

            <div className="flex items-center justify-between font-bold text-lg mt-2">
              <span>Thanh toán:</span>
              <span>₫{finalThanhToan.toLocaleString()}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={loaiDon} onValueChange={setLoaiDon}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Loại đơn" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Đơn onl">Đơn onl</SelectItem>
                  <SelectItem value="Đơn off">Đơn off</SelectItem>
                </SelectContent>
              </Select>

              {loaiDon === 'Đơn onl' && (
                <Select value={hinhThucVanChuyen} onValueChange={setHinhThucVanChuyen}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Hình thức vận chuyển" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHTK">GHTK</SelectItem>
                    <SelectItem value="Book Grab">Book Grab</SelectItem>
                    <SelectItem value="Gửi Xe">Gửi Xe</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {loaiDon === 'Đơn onl' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Địa chỉ nhận</label>
                <Input placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" value={diaChiNhan} onChange={(e) => setDiaChiNhan(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Loại thanh toán</label>
            <Select value={loaiThanhToan} onValueChange={setLoaiThanhToan}>
              <SelectTrigger><SelectValue placeholder="Chọn loại thanh toán..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Thanh toán đủ">Thanh toán đủ</SelectItem>
                <SelectItem value="Đặt cọc">Đặt cọc</SelectItem>
              </SelectContent>
            </Select>
            {loaiThanhToan === 'Đặt cọc' && (
              <div className="pt-2 space-y-3 p-3 border rounded bg-orange-50/50">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-orange-800">Khách đặt cọc trước (₫)</label>
                  <Input type="number" placeholder="Ví dụ: 500000" value={soTienCoc || ''} onChange={(e) => setSoTienCoc(Number(e.target.value))} className="border-orange-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-orange-800">Hẹn ngày trả đủ</label>
                  <Input type="date" value={ngayHenTraDu} onChange={(e) => setNgayHenTraDu(e.target.value)} className="border-orange-200" />
                </div>
                <div className="pt-1 text-sm font-medium text-orange-800 flex justify-between">
                  <span>Còn lại phải thu:</span>
                  <span>₫{Math.max(0, finalThanhToan - (soTienCoc||0)).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {loaiThanhToan !== 'Đặt cọc' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Đính kèm ảnh (hóa đơn / biên nhận)</label>
              <ImagePicker onSelectBlobs={setReceiptBlobs} />
              {receiptBlobs && receiptBlobs.length > 0 && <p className="text-xs text-muted-foreground mt-1">Gửi {receiptBlobs.length} ảnh kèm thông báo</p>}
            </div>
          )}

          <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg mt-4" disabled={isLoading || cartCount === 0} onClick={handleCheckout}>
            {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang xử lý</> : "Thanh toán"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
