"use client"
// Ô nhập của form "Thêm dòng" (Quản trị dữ liệu): cột có tập giá trị biết trước -> ô chọn, dùng cùng
// danh mục với form "Thêm sản phẩm mới" ở Bán hàng (tên máy chuẩn, màu theo đời máy, loại máy, dung lượng...).
// Cột mở (IMEI, Serial, Pin, giá, ghi chú...) vẫn là ô gõ. Nguồn nhập / Mã lô: ô gõ có gợi ý từ dữ liệu bảng.
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DEVICE_NAME_OPTIONS, STORAGE_OPTIONS, getColorOptions, getLoaiMayOptions } from "@/lib/constants/apple-devices"

const fold = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

const TRONG = "__trong__"
const DANG_SIM = ["Nguyên bản", "Sim ghép", "2 sim vật lý", "2 esim", "sim vật lý + esim", "Không rõ"]
const TRANG_THAI = ["Còn hàng", "Giao đối tác", "Đang CNC", "Đã đặt cọc", "Đã bán"]
const TRANG_THAI_KHO = ["Có sẵn", "Kho trong", "Kho ngoài"]
const DE_O_SHOP = ["Yes", "No"]
const CO_GOI_Y = ["nguon nhap", "nguon hang", "nguon", "ma lo", "nguoi ban", "loai don", "hinh thuc van chuyen"]

/** Danh sách chọn cho cột (null = ô gõ tự do). `vals` = các giá trị đang nhập (để màu / loại máy theo tên máy). */
export function luaChonCot(h: string, vals: Record<string, string>, tenCot: string, bang = ""): string[] | null {
  const k = fold(h)
  const ten = tenCot ? vals[tenCot] || "" : ""
  if (k === "ten san pham") return DEVICE_NAME_OPTIONS
  if (k === "mau sac") return getColorOptions(ten)
  if (k === "loai may") return getLoaiMayOptions(ten)
  if (k === "dung luong") return STORAGE_OPTIONS
  if (k === "dang sim") return DANG_SIM
  // Trạng thái riêng của bảng kho (bảng bán hàng / CNC có trạng thái khác -> để ô gõ)
  if (bang === "Kho_Hang" && k === "trang thai") return TRANG_THAI
  if (bang === "Kho_Hang" && k === "trang thai kho") return TRANG_THAI_KHO
  if (k === "de o shop") return DE_O_SHOP
  return null
}

const coVal = (ds: string[], v: string) => (v && !ds.includes(v) ? [v, ...ds] : ds)

export function OThemDong({
  h,
  value,
  onChange,
  vals,
  tenCot,
  goiY,
  bang,
}: {
  bang: string
  h: string
  value: string
  onChange: (v: string) => void
  vals: Record<string, string>
  tenCot: string
  /** Giá trị đang có trong bảng (gợi ý cho Nguồn nhập, Mã lô...) */
  goiY: string[]
}) {
  const ds = luaChonCot(h, vals, tenCot, bang)
  const k = fold(h)
  if (ds && k === "ten san pham") {
    return (
      <SearchableSelect
        value={value}
        onValueChange={onChange}
        options={coVal(ds, value)}
        placeholder="Chọn sản phẩm"
        searchPlaceholder="Gõ tên máy, vd: 15 promax"
        emptyText="Không có máy nào khớp."
      />
    )
  }
  if (ds) {
    return (
      <Select value={value || TRONG} onValueChange={(v) => onChange(v === TRONG ? "" : v)}>
        <SelectTrigger className="mt-0.5 h-8 text-sm">
          <SelectValue placeholder="Chọn" />
        </SelectTrigger>
        <SelectContent className="bg-card">
          <SelectItem value={TRONG}>— Trống —</SelectItem>
          {coVal(ds, value).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  const coGoiY = CO_GOI_Y.includes(k) && goiY.length > 0
  const id = `goiy-${k.replace(/\s/g, "-")}`
  return (
    <>
      <Input className="mt-0.5 h-8 text-sm" value={value} list={coGoiY ? id : undefined} onChange={(e) => onChange(e.target.value)} />
      {coGoiY && (
        <datalist id={id}>
          {goiY.slice(0, 200).map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      )}
    </>
  )
}
