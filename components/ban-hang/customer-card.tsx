"use client"
// Card chọn khách hàng — tách verbatim từ app/dashboard/ban-hang/page.tsx (refactor thuần).
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"
import type { Customer } from "@/lib/types/ban-hang"

interface CustomerCardProps {
  customerResults: (Customer & { isDeposit?: boolean })[]
  selectedCustomer: Customer | null
  setSelectedCustomer: (c: Customer | null) => void
  setCustomerSearch: (v: string) => void
  setCustomerResults: (v: any[]) => void
  setIsCustomerSelectOpen: (v: boolean) => void
}

export function CustomerCard({
  customerResults,
  selectedCustomer,
  setSelectedCustomer,
  setCustomerSearch,
  setCustomerResults,
  setIsCustomerSelectOpen,
}: CustomerCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle>Khách hàng</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {customerResults.length > 0 && (
          <div className="border rounded bg-card max-h-56 overflow-y-auto">
            {customerResults.map((kh: Customer & { isDeposit?: boolean }) => (
              <div
                key={kh.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 ${kh.isDeposit ? "text-orange-600 font-semibold" : ""}`}
                onClick={() => { setSelectedCustomer(kh); setCustomerSearch(""); setCustomerResults([]); }}
              >
                <span>{kh.ho_ten} ({kh.so_dien_thoai})</span>
                {kh.isDeposit && <span title="Khách đang đặt cọc" className="ml-1">🔒</span>}
              </div>
            ))}
          </div>
        )}
        {selectedCustomer ? (
          <div className="p-3 border rounded-lg bg-card flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedCustomer.ho_ten}</p>
              <p className="text-sm text-muted-foreground">{selectedCustomer.so_dien_thoai}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Xóa</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 bg-card" onClick={() => setIsCustomerSelectOpen(true)}>
              <User className="mr-2 h-4 w-4" /> Chọn khách hàng
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
