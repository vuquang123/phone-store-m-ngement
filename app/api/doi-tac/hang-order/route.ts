import { NextResponse } from "next/server"
import { readFromGoogleSheets } from "@/lib/google-sheets"

// Chỉ đọc dữ liệu (quản lý nhập thủ công ở Google Sheets)
// Sheet có thể được đặt tên tiếng Việt. Route này sẽ thử nhiều tên sheet phổ biến.

const CANDIDATE_SHEET_NAMES = [
  "Hàng Đối Tác",
  "Hang Doi Tac",
  "Hang_Doi_Tac",
  "Hàng Order Đối Tác",
  "Hang Order Doi Tac",
  "Hang_Order_Doi_Tac",
  "Partner_Order",
]

const CACHE_TTL_MS = 60_000

type PartnerCachePayload = {
  success: true
  sheet: string
  count: number
  items: any[]
  cachedAt: string
  fromCache?: boolean
  cacheAgeMs?: number
  stale?: boolean
  warning?: string
}

let cachedPartnerSheet: { timestamp: number; payload: PartnerCachePayload } | null = null
let lastQuotaHitAt = 0

function stripAccents(str: string) {
  return str
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
}

function normHeader(str: string) {
  return stripAccents((str || "").trim().toLowerCase())
}

function findIdx(header: string[], candidates: string[]) {
  const normed = header.map(normHeader)
  // Ưu tiên khớp tuyệt đối trước
  for (const c of candidates) {
    const target = normHeader(c)
    const i = normed.indexOf(target)
    if (i !== -1) return i
  }
  // Sau đó thử khớp chứa (ví dụ: "tinh trang may" chứa "tinh trang")
  for (const c of candidates) {
    const target = normHeader(c)
    const i = normed.findIndex((h) => h.includes(target) || target.includes(h))
    if (i !== -1) return i
  }
  return -1
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.get('refresh') === '1'
    const now = Date.now()
    if (forceRefresh) {
      cachedPartnerSheet = null
    }
    if (!forceRefresh && cachedPartnerSheet && now - cachedPartnerSheet.timestamp < CACHE_TTL_MS) {
      const age = now - cachedPartnerSheet.timestamp
      return NextResponse.json({
        ...cachedPartnerSheet.payload,
        fromCache: true,
        cacheAgeMs: age,
      })
    }

    if (!forceRefresh && lastQuotaHitAt && now - lastQuotaHitAt < CACHE_TTL_MS && cachedPartnerSheet) {
      const age = now - cachedPartnerSheet.timestamp
      return NextResponse.json({
        ...cachedPartnerSheet.payload,
        fromCache: true,
        cacheAgeMs: age,
        stale: age >= CACHE_TTL_MS,
        warning: "Google Sheets đang giới hạn lượt đọc, hiển thị dữ liệu đã lưu trong bộ nhớ tạm.",
      })
    }

    // Đọc sheet với nhiều tên khả dĩ (không ghi)
    let header: string[] = []
    let rows: string[][] = []
    let usedSheet = ""
    let lastError: any
    for (const name of CANDIDATE_SHEET_NAMES) {
      try {
        const res = await readFromGoogleSheets(name, undefined, { silent: true })
        header = res.header
        rows = res.rows
        usedSheet = name
        break
      } catch (err: any) {
        lastError = err
        if (typeof err?.message === "string" && err.message.toLowerCase().includes("quota exceeded")) {
          lastQuotaHitAt = now
          break
        }
        continue
      }
    }
    if (!usedSheet) {
      const quotaMessage = typeof lastError?.message === "string" && lastError.message.toLowerCase().includes("quota exceeded")
      if (!forceRefresh && quotaMessage && cachedPartnerSheet) {
        const age = now - cachedPartnerSheet.timestamp
        return NextResponse.json({
          ...cachedPartnerSheet.payload,
          fromCache: true,
          cacheAgeMs: age,
          stale: true,
          warning: "Google Sheets đang giới hạn lượt đọc, hiển thị dữ liệu đã lưu trong bộ nhớ tạm.",
        })
      }
      if (quotaMessage) {
        return NextResponse.json(
          {
            success: false,
            error: "Google Sheets đang tạm giới hạn lượt đọc. Vui lòng thử lại sau khoảng 1 phút.",
          },
          { status: 429 },
        )
      }
      return NextResponse.json(
        {
          success: false,
          error:
            "Không tìm thấy sheet 'Hàng Đối Tác'. Vui lòng tạo 1 sheet có tên như: 'Hàng Đối Tác' hoặc 'Hang_Doi_Tac' và nhập dữ liệu.",
          candidates: CANDIDATE_SHEET_NAMES,
          detail: lastError?.message,
        },
        { status: 404 },
      )
    }

    // Ánh xạ cột tiếng Việt (nhiều biến thể) → chỉ đọc, không ghi
    const idx = {
      nguonHang: findIdx(header, ["Nguồn Hàng", "Nguon Hang", "Nguồn", "Nguon"]),
      tenDoiTac: findIdx(header, ["Tên Đối Tác", "Ten Doi Tac", "Đối Tác", "Doi Tac"]),
      sdtDoiTac: findIdx(header, ["SĐT Đối Tác", "SDT Doi Tac", "Số ĐT Đối Tác", "So DT Doi Tac", "SĐT", "SDT"]),
      model: findIdx(header, ["Model", "Tên Sản Phẩm", "Ten San Pham", "Sản Phẩm", "San Pham"]),
      loaiMay: findIdx(header, ["Loại Máy", "Loai May", "Loại", "Loai"]),
      mau: findIdx(header, ["Màu", "Mau", "Color", "Màu Sắc", "Mau Sac"]),
      boNho: findIdx(header, ["Bộ Nhớ", "Bo Nho", "Dung Lượng", "Dung Luong", "Storage"]),
      pinPct: findIdx(header, ["Pin (%)", "Pin", "Pin %", "Pin(%)"]),
      tinhTrang: findIdx(header, ["Tình Trạng", "Tinh Trang", "Tình trạng", "Tinh trang", "Tình Trạng Máy", "Tinh Trang May"]),
  imei: findIdx(header, ["IMEI"]),
  serial: findIdx(header, ["Serial", "Số Serial", "So Serial"]),
      giaChuyen: findIdx(header, ["Giá Chuyển", "Gia Chuyen", "Giá chuyển (VND)", "Gia chuyen (VND)", "Giá nhập", "Gia nhap"]),
      giaGoiYBan: findIdx(header, ["Giá Gợi Ý Bán", "Gia Goi Y Ban", "Giá bán gợi ý", "Gia ban goi y", "Giá Bán", "Gia Ban"]),
      eta: findIdx(header, ["ETA", "Ngày Nhận Dự Kiến", "Ngay Nhan Du Kien", "Ngày nhận", "Ngay nhan"]),
      ngayNhap: findIdx(header, ["Ngày Nhập", "Ngay Nhap", "Ngày nhập", "Ngay nhap"]),
      trangThai: findIdx(header, ["Trạng Thái", "Trang Thai", "Tình trạng đơn", "Tinh trang don"]),
      ghiChu: findIdx(header, ["Ghi Chú", "Ghi Chu", "Ghi chú"]) ,
    }

    const items = rows
      .filter((r) => r && r.length > 0)
      .map((r, i) => {
        const val = (j: number) => (j >= 0 ? (r[j] || "").toString().trim() : "")
        const rawGiaChuyen = val(idx.giaChuyen).replace(/[^0-9.-]/g, "")
        const giaChuyen = rawGiaChuyen ? Number(rawGiaChuyen) : 0
        const rawGiaGoiY = val(idx.giaGoiYBan).replace(/[^0-9.-]/g, "")
        const giaGoiYBan = rawGiaGoiY ? Number(rawGiaGoiY) : undefined
        return {
          id: `${i + 2}-${val(idx.imei) || val(idx.serial) || val(idx.model)}`,
          sheet: usedSheet,
          hang: val(idx.nguonHang) || "Shop khác",
          ten_doi_tac: val(idx.tenDoiTac),
          sdt_doi_tac: val(idx.sdtDoiTac),
          model: val(idx.model),
          loai_may: val(idx.loaiMay),
          mau: val(idx.mau),
          bo_nho: val(idx.boNho),
          pin_pct: val(idx.pinPct),
          tinh_trang: val(idx.tinhTrang),
          imei: val(idx.imei),
          serial: val(idx.serial),
          gia_chuyen: giaChuyen,
          gia_goi_y_ban: giaGoiYBan,
          eta: val(idx.eta),
          ngay_nhap: val(idx.ngayNhap),
          trang_thai: val(idx.trangThai),
          ghi_chu: val(idx.ghiChu),
          row_index: i + 2, // +2 vì header ở dòng 1
        }
      })

    const payload: PartnerCachePayload = {
      success: true,
      sheet: usedSheet,
      count: items.length,
      items,
      cachedAt: new Date(now).toISOString(),
    }
    cachedPartnerSheet = { timestamp: now, payload }
    lastQuotaHitAt = 0

    return NextResponse.json(payload)
  } catch (error: any) {
    const message = error?.message || "Đọc sheet thất bại"
    if (typeof message === "string" && message.toLowerCase().includes("quota exceeded")) {
      const now = Date.now()
      lastQuotaHitAt = now
      if (cachedPartnerSheet) {
        const age = now - cachedPartnerSheet.timestamp
        return NextResponse.json({
          ...cachedPartnerSheet.payload,
          fromCache: true,
          cacheAgeMs: age,
          stale: true,
          warning: "Google Sheets đang giới hạn lượt đọc, hiển thị dữ liệu đã lưu trong bộ nhớ tạm.",
        })
      }
      return NextResponse.json(
        {
          success: false,
          error: "Google Sheets đang tạm giới hạn lượt đọc. Vui lòng thử lại sau khoảng 1 phút.",
        },
        { status: 429 },
      )
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
