"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { CustomerDialog } from "./customer-dialog"
import { useToast } from "@/hooks/use-toast"

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
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [highlightIndex, setHighlightIndex] = useState<number>(-1)

  // Debounce search
  const debouncedSearch = useMemo(() => {
    let t: any
    return (cb: () => void) => {
      clearTimeout(t)
      t = setTimeout(cb, 350)
    }
  }, [])

  const fetchCustomers = async () => {
    try {
      setIsLoading(true)
      const normalized = (search || "").trim()
      const params = new URLSearchParams()
      if (normalized) params.append("search", normalized)

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
        const deduped = Array.from(
          new Map(
            mapped.map((c) => [c.id || c.so_dien_thoai || c.ho_ten, c])
          ).values()
        )
        setCustomers(deduped)
      }
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    debouncedSearch(fetchCustomers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, search])


  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) setSelectedCustomerId(null)
  }, [isOpen])

  const displayCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    const digits = q.replace(/\D/g, "")
    return customers.filter((c) => {
      const name = (c.ho_ten || "").toLowerCase()
      const phone = c.so_dien_thoai || ""
      return name.includes(q) || phone.includes(digits)
    })
  }, [customers, search])

  const handleSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id)
    onSelect(customer)
    // Save to recent list (localStorage)
    try {
      const key = "recent_customers"
      const raw = localStorage.getItem(key)
      const list: Customer[] = raw ? JSON.parse(raw) : []
      const newList = [customer, ...list.filter((c) => c.id !== customer.id)].slice(0, 8)
      localStorage.setItem(key, JSON.stringify(newList))
    } catch {}
  }

  // Recent customers
  const [recents, setRecents] = useState<Customer[]>([])
  useEffect(() => {
    if (!isOpen) return
    try {
      const raw = localStorage.getItem("recent_customers")
      setRecents(raw ? JSON.parse(raw) : [])
    } catch {
      setRecents([])
    }
    setHighlightIndex(-1)
    // Focus input when opening
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle>Chọn khách hàng</DialogTitle>
          <DialogDescription>Nhập tên hoặc số điện thoại để tìm khách; nếu không có sẽ hiện nút tạo mới.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nhập tên hoặc SĐT khách hàng..."
              inputMode="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setHighlightIndex(-1)
              }}
              className="pl-8"
              ref={inputRef}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setHighlightIndex((i) => Math.min(i + 1, displayCustomers.length - 1))
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setHighlightIndex((i) => Math.max(i - 1, 0))
                } else if (e.key === "Enter") {
                  if (highlightIndex >= 0 && displayCustomers[highlightIndex]) {
                    handleSelect(displayCustomers[highlightIndex])
                  } else if (!isLoading && displayCustomers.length === 0 && search.trim().length >= 3) {
                    setShowCreate(true)
                  }
                }
              }}
            />
          </div>

          {/* Recent customers section */}
          {recents.length > 0 && !search && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Khách gần đây</div>
              <div className="grid grid-cols-2 gap-2">
                {recents.map((c) => (
                  <button
                    key={c.id}
                    className="text-left p-2 border rounded-md hover:bg-muted/50"
                    onClick={() => handleSelect(c)}
                  >
                    <div className="font-medium truncate">{c.ho_ten}</div>
                    <div className="text-xs text-muted-foreground">{c.so_dien_thoai}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-1">
            {isLoading && <p className="text-center py-4">Đang tải...</p>}
            {!isLoading && displayCustomers.length === 0 && (
              <div className="text-center py-4 space-y-2 text-muted-foreground">
                <p>Không tìm thấy khách hàng</p>
                {search.trim().length >= 3 && (
                  <Button variant="default" size="sm" onClick={() => setShowCreate(true)}>
                    + Tạo khách mới với SĐT "{search.trim()}"
                  </Button>
                )}
              </div>
            )}
            {!isLoading && displayCustomers.length > 0 && displayCustomers.map((customer, idx) => {
              const itemKey = `${customer.id || customer.so_dien_thoai || "customer"}-${idx}`
              return (
              <div
                key={itemKey}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${selectedCustomerId === customer.id ? 'bg-white border-primary' : 'hover:bg-muted/50 border-muted'} ${highlightIndex===idx ? 'ring-2 ring-primary' : ''}`}
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
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* Create new customer dialog */}
    <CustomerDialog
      isOpen={showCreate}
      onClose={() => setShowCreate(false)}
      initial={{ so_dien_thoai: search.trim() }}
      onSuccess={(c) => {
        const normalized = {
          id: (c as any).id || (c as any).sdt,
          ho_ten: (c as any).ho_ten || (c as any).ten_khach,
          so_dien_thoai: (c as any).so_dien_thoai || (c as any).sdt,
        } as Customer
        toast({ title: "Đã tạo khách hàng", description: `${normalized.ho_ten} (${normalized.so_dien_thoai})` })
        setShowCreate(false)
        setCustomers((prev) => [normalized, ...prev])
        handleSelect(normalized)
      }}
    />
    </>
  )
}
