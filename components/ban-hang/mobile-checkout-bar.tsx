"use client"
// Thanh thanh toán cố định ở đáy (mobile) — tách verbatim từ app/dashboard/ban-hang/page.tsx.
import { Button } from "@/components/ui/button"

type MobileView = "san-pham" | "gio-hang" | "thanh-toan"

interface MobileCheckoutBarProps {
  finalThanhToan: number
  mobileView: MobileView
  setMobileView: (v: MobileView) => void
  cartCount: number
  handleCheckout: () => void
  isLoading: boolean
}

export function MobileCheckoutBar({
  finalThanhToan,
  mobileView,
  setMobileView,
  cartCount,
  handleCheckout,
  isLoading,
}: MobileCheckoutBarProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-3 py-[10px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
      <div className="max-w-screen-md mx-auto flex items-center justify-between gap-3">
        <div className="text-sm">
          <div className="text-slate-500">Thanh toán</div>
          <div className="text-xl font-bold">₫{finalThanhToan.toLocaleString()}</div>
        </div>
        {mobileView === 'san-pham' && (
          <Button
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setMobileView('gio-hang')}
            disabled={cartCount === 0}
          >
            {`Giỏ hàng (${cartCount})`}
          </Button>
        )}
        {mobileView === 'gio-hang' && (
          <Button
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setMobileView('thanh-toan')}
            disabled={cartCount === 0}
          >
            Thanh toán
          </Button>
        )}
        {mobileView === 'thanh-toan' && (
          <Button
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleCheckout}
            disabled={isLoading || cartCount === 0}
          >
            {isLoading ? "Đang xử lý..." : "Thanh toán"}
          </Button>
        )}
      </div>
    </div>
  )
}
