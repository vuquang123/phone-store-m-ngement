export interface CartItem {
  id: string
  type: "product" | "accessory"
  ten_san_pham: string
  gia_ban: number
  so_luong: number
  max_quantity?: number
  imei?: string
  serial?: string
  trang_thai?: string
  [key: string]: any
}

export interface WarrantyPackageUI {
  code: string
  name: string
  price: number
  exchangeDays: number
  hwMonths: number
  cncMonths: number
  lifetime: boolean
  notes?: string
  active?: boolean
}

export interface Customer {
  id: string
  ho_ten: string
  so_dien_thoai: string
}

// Khóa sắp xếp bảng tìm kiếm sản phẩm (tách từ ban-hang/page.tsx)
export type SortKey = 'san_pham' | 'imei_loai' | 'nguon' | 'trang_thai' | 'gia'
