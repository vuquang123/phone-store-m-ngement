"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface Customer {
  id: string
  ho_ten: string
  so_dien_thoai: string
}

interface CustomerSelectDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (customer: Customer) => void
}

export function CustomerSelectDialog({ isOpen, onClose, onSelect }: CustomerSelectDialogProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const fetchCustomers = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (search) params.append("search", search)

      const response = await fetch(`/api/khach-hang?${params}`)
      if (response.ok) {
        const data = await response.json()
        const mapped = Array.isArray(data)
          ? data.map((item) => ({
              id: item.sdt,
              ho_ten: item.ten_khach,
              so_dien_thoai: item.sdt,
            }))
          : []
        setCustomers(mapped)
      }
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
    }
  }, [isOpen, search])


  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) setSelectedCustomerId(null)
  }, [isOpen])

  const handleSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id)
    onSelect(customer)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle>Chọn khách hàng</DialogTitle>
          <DialogDescription>Tìm kiếm và chọn khách hàng cho đơn hàng</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {isLoading ? (
              <p className="text-center py-4">Đang tải...</p>
            ) : customers.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">Không tìm thấy khách hàng</p>
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${selectedCustomerId === customer.id ? 'bg-white border-primary' : 'hover:bg-muted/50 border-muted'}`}
                  onClick={() => handleSelect(customer)}
                >
                  <div>
                    <p className="font-medium">{customer.ho_ten}</p>
                    <p className="text-sm text-muted-foreground">{customer.so_dien_thoai}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Chọn
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
