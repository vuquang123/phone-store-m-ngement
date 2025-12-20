"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface Product {
  id: string
  ten_san_pham: string
  loai_phu_kien: string
  dung_luong: string
  mau_sac: string
  pin: string
  imei: string
  serial?: string
  tinh_trang: string
  trang_thai: string
  gia_nhap: number
  gia_ban: number
  ngay_nhap: string
  ghi_chu?: string
}

interface ProductDialogProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  onSuccess: () => void
}

export function ProductDialog({ isOpen, onClose, product, onSuccess }: ProductDialogProps) {
  // Bảng màu cho từng dòng máy
  // Helper: Đảm bảo giá trị truyền vào Select luôn có trong options
  function ensureOption(options: string[], value: string) {
    if (value && !options.includes(value)) {
      return [value, ...options]
    }
    return options
  }

  const colorOptions: Record<string, string[]> = {
    "iPhone 17": ["Black", "Lavender", "Mist Blue", "Sage", "White"],
    "iPhone 17 Pro Max": ["Deep Blue", "Cosmic Orange", "Silver"],
    "iPhone 17 Pro": ["Deep Blue", "Cosmic Orange", "Silver"],
    "iPhone 17 Plus": ["Black", "Lavender", "Mist Blue", "Sage", "White"],
    "iPhone 16 Pro Max": ["Black Titanium", "Natural Titanium", "White Titanium", "Desert Titanium"],
    "iPhone 16 Pro": ["Black Titanium", "Natural Titanium", "White Titanium", "Desert Titanium"],
    "iPhone 16 Plus": ["Black", "White", "Pink", "Teal", "Ultramarine"],
    "iPhone 16": ["Black", "White", "Pink", "Teal", "Ultramarine"],
    "iPhone 15 Pro Max": ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"],
    "iPhone 15 Pro": ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"],
    "iPhone 15 Plus": ["Pink", "Yellow", "Green", "Blue", "Black"],
    "iPhone 15": ["Pink", "Yellow", "Green", "Blue", "Black"],
    "iPhone 14 Pro Max": ["Silver", "Gold", "Space Black", "Deep Purple"],
    "iPhone 14 Pro": ["Silver", "Gold", "Space Black", "Deep Purple"],
    "iPhone 14 Plus": ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"],
    "iPhone 14": ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"],
    "iPhone 13 Pro Max": ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"],
    "iPhone 13 Pro": ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"],
    "iPhone 13 Mini": ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"],
    "iPhone 13": ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"],
    "iPhone 12 Pro Max": ["Silver", "Graphite", "Gold", "Pacific Blue"],
    "iPhone 12 Pro": ["Silver", "Graphite", "Gold", "Pacific Blue"],
    "iPhone 12": ["Black", "White", "(PRODUCT)RED", "Green", "Blue", "Purple"],
    "iPhone 11 Pro Max": ["Silver", "Space Gray", "Gold", "Midnight Green"],
    "iPhone 11 Pro": ["Silver", "Space Gray", "Gold", "Midnight Green"],
    "iPhone 11": ["Purple", "Green", "Yellow", "Black", "White", "(PRODUCT)RED"],
  }

  const productNameOptions = [
    "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Plus", "iPhone 17",
    "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
    "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13 Mini", "iPhone 13",
    "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12 Plus", "iPhone 12",
    "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
  ]

  const storageOptions = ["128GB", "256GB", "512GB", "1TB"]
  const [formData, setFormData] = useState({
    ten_san_pham: "",
    loai_phu_kien: "",
    dung_luong: "",
    mau_sac: "",
    pin: "",
    imei: "",
    serial: "",
    tinh_trang: "",
    trang_thai: "Còn hàng",
    gia_nhap: "",
    gia_ban: "",
    ngay_nhap: new Date().toISOString().slice(0, 10),
    ghi_chu: "",
  })

  const today = new Date().toISOString().slice(0, 10)
  type BulkRow = typeof formData & { rowId: string }
  const newBulkRow = (): BulkRow => ({
    rowId: Math.random().toString(36).slice(2, 9),
    ten_san_pham: "",
    loai_phu_kien: "",
    dung_luong: "",
    mau_sac: "",
    pin: "",
    imei: "",
    serial: "",
    tinh_trang: "",
    trang_thai: "Còn hàng",
    gia_nhap: "",
    gia_ban: "",
    ngay_nhap: today,
    ghi_chu: "",
  })
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([newBulkRow(), newBulkRow()])
  const [proofFiles, setProofFiles] = useState<File[]>([])
  const [bulkProofFiles, setBulkProofFiles] = useState<File[]>([])

  // Mapping trạng thái sang giá trị backend
  const mapTrangThai = (tt: string) => {
    switch (tt) {
      case "Còn hàng": return "in_stock";
      case "dang_cnc": return "processing";
      case "tra_lai": return "returned";
      case "dat_coc": return "deposit";
      default: return "in_stock";
    }
  }
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  // Import getAuthHeaders for API auth
  // @ts-ignore
  const getAuthHeaders = typeof window !== "undefined" ? require("@/components/auth/protected-route").getAuthHeaders : () => ({});

  useEffect(() => {
    if (product) {
      setFormData({
        ten_san_pham: product.ten_san_pham || "",
        loai_phu_kien: product.loai_phu_kien || "",
        dung_luong: product.dung_luong || "",
        mau_sac: product.mau_sac || "",
        pin: product.pin || "",
        imei: product.imei || "",
        serial: (product as any).serial || (product as any).Serial || "",
        tinh_trang: product.tinh_trang || "",
        trang_thai: product.trang_thai || "Còn hàng",
        gia_nhap: (typeof product.gia_nhap === "number" && !isNaN(product.gia_nhap)) ? product.gia_nhap.toString() : "",
        gia_ban: (typeof product.gia_ban === "number" && !isNaN(product.gia_ban)) ? product.gia_ban.toString() : "",
        ngay_nhap: product.ngay_nhap ? (() => {
          const d = new Date(product.ngay_nhap)
          return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10)
        })() : new Date().toISOString().slice(0, 10),
        ghi_chu: product.ghi_chu || "",
      })
      setIsBulkMode(false)
    } else {
      setFormData({
        ten_san_pham: "",
        loai_phu_kien: "",
        dung_luong: "",
        mau_sac: "",
        pin: "",
        imei: "",
        serial: "",
        tinh_trang: "",
        trang_thai: "Còn hàng",
        gia_nhap: "",
        gia_ban: "",
        ngay_nhap: new Date().toISOString().slice(0, 10),
        ghi_chu: "",
      })
    }
  }, [product, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const requiredFields = [
      "ten_san_pham",
      "loai_phu_kien",
      "dung_luong",
      "mau_sac",
      "tinh_trang",
      "trang_thai",
      "gia_nhap",
      "gia_ban",
      "ngay_nhap",
    ]
    const missingFields = requiredFields.filter((field) => !formData[field as keyof typeof formData])

    if (missingFields.length > 0) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc!",
        variant: "destructive",
      })
      return
    }

    // Validate identifier: require either a valid IMEI (15 digits) or a valid Serial (6-30 alphanumeric)
    const hasImei = !!formData.imei && /^\d{15}$/.test(formData.imei)
    const hasSerial = !!formData.serial && /^[A-Za-z0-9-]{6,30}$/.test(formData.serial)
    if (!hasImei && !hasSerial) {
      toast({
        title: "Thiếu định danh thiết bị",
        description: "Nhập IMEI 15 số hoặc Serial (6-30 ký tự chữ/số).",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const url = "/api/kho-hang";
      const action = product ? "update" : "create";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          action,
          ...(product ? { id: product.id } : {}),
          ...formData,
          gia_nhap: Number(formData.gia_nhap),
          gia_ban: Number(formData.gia_ban),
          ngay_nhap: formData.ngay_nhap,
          trang_thai: formData.trang_thai, // Lưu trạng thái tiếng Việt
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save product");
      }

      toast({
        title: "Thành công!",
        description: product ? "Đã cập nhật sản phẩm thành công!" : "Đã thêm sản phẩm mới thành công!",
        variant: "success",
      });

      if (!product) {
        await uploadProof(proofFiles, `Nhập hàng: ${formData.ten_san_pham || ""}`.trim())
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Lỗi",
        description: `Lỗi khi lưu sản phẩm: ${error instanceof Error ? error.message : "Lỗi không xác định"}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProofFiles([])
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const usableRows = bulkRows.filter(r => (r.ten_san_pham || r.imei || r.serial || r.dung_luong))
    if (!usableRows.length) {
      toast({ title: "Thiếu dữ liệu", description: "Thêm ít nhất một dòng có thông tin.", variant: "destructive" })
      return
    }

    const errors: string[] = []
    usableRows.forEach((r, idx) => {
      const hasImei = r.imei && /^\d{15}$/.test(r.imei)
      const hasSerial = r.serial && /^[A-Za-z0-9-]{6,30}$/.test(r.serial)
      const required = [r.ten_san_pham, r.loai_phu_kien, r.dung_luong, r.mau_sac, r.tinh_trang, r.gia_nhap, r.gia_ban, r.ngay_nhap]
      if (required.some(v => !v)) {
        errors.push(`Dòng ${idx + 1}: thiếu trường bắt buộc.`)
      }
      if (!hasImei && !hasSerial) {
        errors.push(`Dòng ${idx + 1}: cần IMEI 15 số hoặc Serial 6-30 ký tự.`)
      }
    })
    if (errors.length) {
      toast({ title: "Lỗi dữ liệu", description: errors.slice(0, 3).join("\n"), variant: "destructive" })
      return
    }

    setIsLoading(true)
    try {
      const products = usableRows.map((r) => ({
        ten_san_pham: r.ten_san_pham,
        loai_phu_kien: r.loai_phu_kien,
        dung_luong: r.dung_luong,
        mau_sac: r.mau_sac,
        pin: r.pin,
        imei: r.imei,
        serial: r.serial,
        tinh_trang: r.tinh_trang,
        gia_nhap: Number(r.gia_nhap),
        gia_ban: Number(r.gia_ban),
        ngay_nhap: r.ngay_nhap,
        ghi_chu: r.ghi_chu,
        trang_thai: "Còn hàng",
        trang_thai_kho: "Có sẵn",
      }))

      const response = await fetch("/api/kho-hang", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ products }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Lỗi (${response.status}) khi ghi Google Sheets`)
      }

      const result = await response.json().catch(() => ({}))
      const added = result?.added ?? 0

      toast({
        title: "Kết quả nhập hàng",
        description: `Thành công: ${added}`,
        variant: added === products.length ? "success" : "destructive",
      })

      if (added > 0) {
        onSuccess()
        onClose()
        await uploadProof(bulkProofFiles, `Nhập hàng (bulk): ${added} máy`)
      }
    } catch (error) {
      toast({ title: "Lỗi", description: `Không thể lưu: ${error instanceof Error ? error.message : ""}` , variant: "destructive" })
    } finally {
      setIsLoading(false)
      setBulkProofFiles([])
    }
  }

  async function uploadProof(files: File[], caption?: string) {
    if (!files || !files.length) return
    const form = new FormData()
    files.forEach((file, idx) => form.append("photo", file, file.name || `proof_${idx + 1}.jpg`))
    form.append("message_thread_id", "22")
    if (caption) form.append("caption", caption)
    try {
      await fetch("/api/telegram/send-photo", { method: "POST", body: form })
    } catch (e) {
      console.warn("[TG] upload proof fail:", e)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isBulkMode ? "sm:max-w-[1800px] w-[98vw]" : "sm:max-w-[1200px] w-[94vw]"} max-h-[90vh] overflow-y-auto bg-white`}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{product ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {product ? "Cập nhật thông tin sản phẩm trong kho" : "Nhập thông tin sản phẩm mới vào kho hàng"}
          </DialogDescription>
          {!product && (
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant={!isBulkMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsBulkMode(false)}
              >
                Thêm 1 máy
              </Button>
              <Button
                type="button"
                variant={isBulkMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsBulkMode(true)}
              >
                Thêm nhiều máy
              </Button>
            </div>
          )}
        </DialogHeader>

        {isBulkMode ? (
          <form onSubmit={handleBulkSubmit} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-600">Nhập nhiều máy một lượt. Cần IMEI 15 số hoặc Serial 6-30 ký tự.</div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setBulkRows([newBulkRow(), newBulkRow()])}>
                  Xóa hết dòng
                </Button>
                <Button type="button" size="sm" onClick={() => setBulkRows(prev => [...prev, newBulkRow()])}>
                  <Plus className="w-4 h-4 mr-1" /> Thêm dòng
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm text-slate-700">Ảnh xác nhận (tùy chọn, gửi Telegram)</Label>
              <Input type="file" multiple accept="image/*" onChange={e => setBulkProofFiles(Array.from(e.target.files || []))} />
              {bulkProofFiles.length > 0 && <p className="text-xs text-slate-500">{bulkProofFiles.length} ảnh đã chọn</p>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1650px] border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-700">
                  <tr className="divide-x divide-slate-200">
                    <th className="px-3 py-2 text-left min-w-[170px]">Tên sản phẩm*</th>
                    <th className="px-3 py-2 text-left min-w-[120px]">Loại*</th>
                    <th className="px-3 py-2 text-left min-w-[120px]">Dung lượng*</th>
                    <th className="px-3 py-2 text-left min-w-[130px]">Màu*</th>
                    <th className="px-3 py-2 text-left min-w-[90px]">Pin</th>
                    <th className="px-3 py-2 text-left min-w-[220px]">
                      <div className="flex flex-col leading-tight">
                        <span>IMEI / Serial*</span>
                        <span className="text-[11px] text-slate-500 font-normal">Nhập 1 trong 2 trường</span>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left min-w-[150px]">Tình trạng*</th>
                    <th className="px-3 py-2 text-left min-w-[130px]">Giá nhập*</th>
                    <th className="px-3 py-2 text-left min-w-[130px]">Giá bán*</th>
                    <th className="px-3 py-2 text-left min-w-[140px]">Ngày nhập*</th>
                    <th className="px-3 py-2 text-left min-w-[160px]">Ghi chú</th>
                    <th className="px-2 py-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, idx) => {
                    const setField = (key: keyof BulkRow, value: string) => {
                      setBulkRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, [key]: value } : r))
                    }
                    return (
                      <tr key={row.rowId} className="divide-x divide-slate-200 bg-white">
                        <td className="px-2 py-2">
                          <Select value={row.ten_san_pham} onValueChange={(v) => setField("ten_san_pham", v)}>
                            <SelectTrigger className="h-10 text-sm w-full min-w-[170px]"><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
                            <SelectContent className="bg-white max-h-72 overflow-y-auto">
                              {ensureOption(productNameOptions, row.ten_san_pham).map((item) => (
                                <SelectItem key={item} value={item}>{item}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Select value={row.loai_phu_kien} onValueChange={(v) => setField("loai_phu_kien", v)}>
                            <SelectTrigger className="h-10 text-sm w-full min-w-[110px]"><SelectValue placeholder="Loại" /></SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="Lock">Lock</SelectItem>
                              <SelectItem value="Quốc tế">Quốc tế</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Select value={row.dung_luong} onValueChange={(v) => setField("dung_luong", v)}>
                            <SelectTrigger className="h-10 text-sm w-full min-w-[110px]"><SelectValue placeholder="Dung lượng" /></SelectTrigger>
                            <SelectContent className="bg-white">
                              {ensureOption(storageOptions, row.dung_luong).map((item) => (
                                <SelectItem key={item} value={item}>{item}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Select value={row.mau_sac} onValueChange={(v) => setField("mau_sac", v)}>
                            <SelectTrigger className="h-10 text-sm w-full min-w-[120px]"><SelectValue placeholder="Màu" /></SelectTrigger>
                            <SelectContent className="bg-white max-h-64 overflow-y-auto">
                              {ensureOption(colorOptions[row.ten_san_pham] || [], row.mau_sac).map((color) => (
                                <SelectItem key={color} value={color}>{color}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Input value={row.pin} onChange={(e) => setField("pin", e.target.value)} placeholder="Pin %" className="h-10 text-sm" />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-2">
                            <Input
                              value={row.imei}
                              onChange={(e) => setField("imei", e.target.value.replace(/\D/g, "").slice(0, 15))}
                              placeholder="IMEI 15 số"
                              className="font-mono h-10 text-sm w-[110px]"
                            />
                            <Input
                              value={row.serial}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase()
                                if (!/^[A-Z0-9-]*$/.test(val)) return
                                setField("serial", val.slice(0, 30))
                              }}
                              placeholder="Serial"
                              className="font-mono h-10 text-sm w-[110px]"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Input value={row.tinh_trang} onChange={(e) => setField("tinh_trang", e.target.value)} placeholder="Tình trạng" className="h-10 text-sm" />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={row.gia_nhap ? Number(row.gia_nhap).toLocaleString("vi-VN") : ""}
                            onChange={(e) => setField("gia_nhap", e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Giá nhập"
                            className="text-right h-10 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={row.gia_ban ? Number(row.gia_ban).toLocaleString("vi-VN") : ""}
                            onChange={(e) => setField("gia_ban", e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Giá bán"
                            className="text-right h-10 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="date"
                            value={row.ngay_nhap || today}
                            onChange={(e) => setField("ngay_nhap", e.target.value)}
                            className="h-10 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input value={row.ghi_chu} onChange={(e) => setField("ghi_chu", e.target.value)} placeholder="Ghi chú" className="h-10 text-sm" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setBulkRows(prev => prev.length > 1 ? prev.filter(r => r.rowId !== row.rowId) : prev)}
                          >
                            <Trash2 className="w-4 h-4 text-slate-500" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading} className="min-w-[140px]">
                {isLoading ? "Đang lưu..." : "Lưu tất cả"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Tên sản phẩm & Màu sắc */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ten_san_pham_select" className="text-sm font-medium">
                  Tên sản phẩm <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.ten_san_pham}
                  onValueChange={(value) => setFormData({ ...formData, ten_san_pham: value })}
                >
                  <SelectTrigger id="ten_san_pham_select" className="w-full">
                    <SelectValue placeholder="Chọn sản phẩm" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-50">
                    {ensureOption([
                      "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone 17 Plus", "iPhone 17",
                      "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
                      "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
                      "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
                      "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13 Mini", "iPhone 13",
                      "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12 Plus", "iPhone 12",
                      "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
                    ], formData.ten_san_pham).map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mau_sac_select">Màu sắc <span className="text-red-500">*</span></Label>
                <Select value={formData.mau_sac} onValueChange={(value) => setFormData({ ...formData, mau_sac: value })}>
                  <SelectTrigger id="mau_sac_select">
                    <SelectValue placeholder="Chọn màu sắc" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-50">
                    {ensureOption(colorOptions[formData.ten_san_pham] || [], formData.mau_sac).map((color) => (
                      <SelectItem key={color} value={color}>{color}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: loai_phu_kien, Dung lượng, Pin */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model_select" className="text-sm font-medium">
                  Loại máy <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.loai_phu_kien} onValueChange={(value) => setFormData({ ...formData, loai_phu_kien: value })}>
                  <SelectTrigger id="model_select" className="w-full">
                    <SelectValue placeholder="Chọn loại máy" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-50">
                    <SelectItem value="Lock">Lock</SelectItem>
                    <SelectItem value="Quốc tế">Quốc tế</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dung_luong_select">Dung lượng <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.dung_luong}
                  onValueChange={(value) => setFormData({ ...formData, dung_luong: value })}
                >
                  <SelectTrigger id="dung_luong_select">
                    <SelectValue placeholder="Chọn dung lượng" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-50">
                    <SelectItem value="128GB">128GB</SelectItem>
                    <SelectItem value="256GB">256GB</SelectItem>
                    <SelectItem value="512GB">512GB</SelectItem>
                    <SelectItem value="1TB">1TB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">Pin</Label>
                <Input
                  id="pin"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="Nhập pin (%)"
                  type="text"
                />
              </div>
            </div>

            {/* Row 3: IMEI/Serial & Tình trạng */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imei">IMEI</Label>
                <Input
                  id="imei"
                  value={formData.imei}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 15)
                    setFormData({ ...formData, imei: value })
                  }}
                  placeholder="Nhập IMEI (15 chữ số) (tuỳ chọn)"
                  maxLength={15}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">{formData.imei.length}/15 ký tự</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serial">Serial</Label>
                <Input
                  id="serial"
                  value={formData.serial}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase()
                    if (!/^[A-Z0-9-]*$/.test(value)) return
                    if (value.length > 30) return
                    setFormData({ ...formData, serial: value })
                  }}
                  placeholder="Nhập Serial (6-30 ký tự) (tuỳ chọn)"
                  maxLength={30}
                />
                <p className="text-xs text-muted-foreground">{(formData.serial || "").length}/30 ký tự</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tinh_trang">Tình trạng <span className="text-red-500">*</span></Label>
                <Input
                  id="tinh_trang"
                  value={formData.tinh_trang}
                  onChange={(e) => setFormData({ ...formData, tinh_trang: e.target.value })}
                  placeholder="Nhập tình trạng máy"
                  required
                />
              </div>
            </div>

            {/* Row 4: Giá nhập & Giá bán (VNĐ trong ô) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gia_nhap">Giá nhập (VNĐ) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="gia_nhap"
                    type="text"
                    value={formData.gia_nhap ? Number(formData.gia_nhap).toLocaleString("vi-VN") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "")
                      setFormData({ ...formData, gia_nhap: raw })
                    }}
                    placeholder="Nhập giá nhập"
                    required
                    className="pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">VNĐ</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gia_ban">Giá bán (VNĐ) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="gia_ban"
                    type="text"
                    value={formData.gia_ban ? Number(formData.gia_ban).toLocaleString("vi-VN") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "")
                      setFormData({ ...formData, gia_ban: raw })
                    }}
                    placeholder="Nhập giá bán"
                    required
                    className="pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">VNĐ</span>
                </div>
              </div>
            </div>

            {/* Row 5: Trạng thái & Ngày nhập */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trang_thai">Trạng thái <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.trang_thai}
                  onValueChange={(value) => setFormData({ ...formData, trang_thai: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trạng thái" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-50">
                    {(() => {
                      const options = [
                        "Còn hàng",
                        "Đang CNC",
                        "Đã bán",
                        "Đặt cọc",
                        "Bảo hành",
                        "Trả lại",
                      ]
                      const allOptions = formData.trang_thai && !options.includes(formData.trang_thai)
                        ? [formData.trang_thai, ...options]
                        : options
                      return allOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ngay_nhap">Ngày nhập <span className="text-red-500">*</span></Label>
                <Input
                  id="ngay_nhap"
                  type="date"
                  value={formData.ngay_nhap}
                  onChange={(e) => setFormData({ ...formData, ngay_nhap: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Row 6: Ghi chú */}
            <div className="space-y-2">
              <Label htmlFor="ghi_chu">Ghi chú</Label>
              <Textarea
                id="ghi_chu"
                value={formData.ghi_chu}
                onChange={(e) => setFormData({ ...formData, ghi_chu: e.target.value })}
                placeholder="Ghi chú thêm về sản phẩm..."
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-sm text-slate-700">Ảnh xác nhận (tùy chọn, gửi Telegram)</Label>
              <Input type="file" multiple accept="image/*" onChange={e => setProofFiles(Array.from(e.target.files || []))} />
              {proofFiles.length > 0 && <p className="text-xs text-slate-500">{proofFiles.length} ảnh đã chọn</p>}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading} className="min-w-[100px]">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang lưu...
                  </div>
                ) : product ? (
                  "Cập nhật"
                ) : (
                  "Thêm mới"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
