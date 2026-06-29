
// app/api/ban-hang/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { sendTelegramMessage, sendTelegramMessageWithButtons, formatOrderMessage } from "@/lib/telegram"
import { readFromGoogleSheets, appendToGoogleSheets, appendMultipleToGoogleSheets, updateRangeValues, syncToGoogleSheets, colIndex, norm } from "@/lib/google-sheets"
import { DateTime } from "luxon"
import { addNotification } from "@/lib/notifications"
import { loadWarrantyPackages, buildContracts, saveContracts, type WarrantySelectionInput } from "@/lib/warranty"
import { Journal } from "@/lib/tx/journal"
import { peekIdempotentDone, beginIdempotent, completeIdempotent, failIdempotent } from "@/lib/tx/idempotency"
import { recordCashTransaction } from "@/lib/cash"
import { getServerUser } from "@/lib/auth"

const SHEETS = {
  BAN_HANG: "Ban_Hang",
  KHO_HANG: "Kho_Hang",
  PHU_KIEN: "Phu_Kien",
  KHACH_HANG: "Khach_Hang",
} as const

/* =================== Utils  =================== */
function toColumnLetter(colNum: number) {
  let letter = ""
  while (colNum > 0) {
    const mod = (colNum - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    colNum = Math.floor((colNum - mod) / 26)
  }
  return letter
}

function normalizePhone(p: string) {
  const digits = (p || "").replace(/\D/g, "")
  if (digits.startsWith("84")) return "0" + digits.slice(2)
  return digits
}

/* =================== Partner sheet helpers =================== */
const PARTNER_SHEET_CANDIDATES = [
  "Hàng Đối Tác",
  "Hang Doi Tac",
  "Hang_Doi_Tac",
  "Hàng Order Đối Tác",
  "Hang Order Doi Tac",
  "Hang_Order_Doi_Tac",
  "Partner_Order",
]

async function tryRemoveRowByIndex(sheetName: string, rowIndexOneBased: number) {
  try {
    const { header, rows } = await readFromGoogleSheets(sheetName, undefined, { silent: true })
    const zeroIdx = Math.max(0, rowIndexOneBased - 2) // rows[] bắt đầu từ dòng 2
    if (zeroIdx >= rows.length) return { success: false, reason: "index_out_of_range" }
    const newRows = rows.filter((_, i) => i !== zeroIdx)
    await syncToGoogleSheets(sheetName, newRows)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message }
  }
}

async function tryRemovePartnerRowByIMEI(imei: string) {
  for (const name of PARTNER_SHEET_CANDIDATES) {
    try {
      const { header, rows } = await readFromGoogleSheets(name, undefined, { silent: true })
      const idxIMEI = colIndex(header, "IMEI")
      const idxTrangThai = colIndex(header, "Trạng Thái")

      if (idxIMEI === -1) continue
      const foundIndex = rows.findIndex((r) => String(r[idxIMEI] || "").trim() === imei)
      if (foundIndex !== -1) {
        // Cách 1: xoá hẳn dòng khỏi sheet
        const newRows = rows.filter((_, i) => i !== foundIndex)
        await syncToGoogleSheets(name, newRows)
        return { success: true, sheet: name, removedBy: "imei" }
        // Cách 2 (nếu muốn chỉ đánh dấu):
        // if (idxTrangThai !== -1) {
        //   rows[foundIndex][idxTrangThai] = "Đã bán"
        //   await syncToGoogleSheets(name, rows)
        //   return { success: true, sheet: name, updated: true }
        // }
      }
    } catch {
      continue
    }
  }
  return { success: false, reason: "not_found" }
}

/* =================== Sheet-specific index helpers =================== */
function idxBanHang(header: string[]) {
  return {
    idDon: colIndex(header, "ID Đơn Hàng"),
    ngayXuat: colIndex(header, "Ngày Xuất"),
    tenKH: colIndex(header, "Tên Khách Hàng"),
    sdt: colIndex(header, "Số Điện Thoại"),
    diaChiNhan: colIndex(header, "Địa Chỉ Nhận", "Dia Chi Nhan", "Dia_Chi_Nhan"),
    tenSP: colIndex(header, "Tên Sản Phẩm"),
    loaiMay: colIndex(header, "Loại Máy"),
    dungLuong: colIndex(header, "Dung Lượng"),
    pin: colIndex(header, "Pin (%)"),
    mauSac: colIndex(header, "Màu Sắc"),
    imei: colIndex(header, "IMEI"),
    tinhTrang: colIndex(header, "Tình Trạng Máy"),
    phuKien: colIndex(header, "Phụ Kiện"),
    giaBan: colIndex(header, "Giá Bán"),
    hinhThucTT: colIndex(header, "Hình Thức Thanh Toán"),
    giaNhap: colIndex(header, "Giá Nhập"),
    lai: colIndex(header, "Lãi"),
    nguoiBan: colIndex(header, "Người Bán"),
    nguonHang: colIndex(header, "Nguồn Hàng", "Nguồn"),
    tenDoiTac: colIndex(header, "Tên Đối Tác", "Đối Tác"),
    sdtDoiTac: colIndex(header, "SĐT Đối Tác", "SĐT", "SDT Đối Tác"),
  }
}

function idxKhoHang(header: string[]) {
  return {
    idMay: colIndex(header, "ID Máy"),
    ngayNhap: colIndex(header, "Ngày Nhập"),
    tenSP: colIndex(header, "Tên Sản Phẩm"),
    loaiMay: colIndex(header, "Loại Máy"),
    dungLuong: colIndex(header, "Dung Lượng"),
    pin: colIndex(header, "Pin (%)"),
    mauSac: colIndex(header, "Màu Sắc"),
    imei: colIndex(header, "IMEI"),
    tinhTrang: colIndex(header, "Tình Trạng Máy"),
    giaNhap: colIndex(header, "Giá Nhập"),
    giaBan: colIndex(header, "Giá Bán"),
    ghiChu: colIndex(header, "Ghi Chú"),
    trangThai: colIndex(header, "Trạng Thái"),
  }
}

function idxPhuKien(header: string[]) {
  return {
    id: colIndex(header, "ID"),
    tenSP: colIndex(header, "Tên Sản Phẩm"),
    loai: colIndex(header, "Loại"),
    soLuong: colIndex(header, "Số Lượng"),
    giaNhap: colIndex(header, "Giá Nhập"),
    giaBan: colIndex(header, "Giá Bán"),
    ghiChu: colIndex(header, "Ghi Chú"),
  }
}

function idxKhachHang(header: string[]) {
  return {
    ngayTao: colIndex(header, "Ngày tạo", "Ngày Tạo", "Ngay Tao", "Ngay_Tao", "Created At", "Created_At"),
    ten:     colIndex(header, "Tên Khách Hàng"),
    sdt:     colIndex(header, "Số Điện Thoại"),
    tongMua: colIndex(header, "Tổng Mua"),
    lanMuaCuoi: colIndex(header, "Lần Mua Cuối"),
    ghiChu:  colIndex(header, "Ghi Chú"),
  }
}

/* =================== Khách hàng: tìm/ thêm/ cập nhật =================== */
async function upsertCustomerByPhone({ phone, name, amountToAdd }: { phone: string; name?: string; amountToAdd: number }) {
  const { header, rows } = await readFromGoogleSheets("Khach_Hang")
  const K = idxKhachHang(header)
  if (K.sdt === -1) throw new Error("Khach_Hang thiếu cột 'Số Điện Thoại'")

  const target = normalizePhone(phone)
  const foundIdx = rows.findIndex((r) => normalizePhone(String(r[K.sdt] || "")) === target)
  // Ngày tạo chỉ ngày, lần mua cuối đầy đủ thời gian
  const nowVN = DateTime.now().setZone('Asia/Ho_Chi_Minh')
  const nowVNDate = nowVN.toFormat('dd/MM/yyyy')
  const nowVNFull = nowVN.toFormat('HH:mm:ss dd/MM/yyyy')

  // DEBUG LOG: kiểm tra giá trị tổng mua cũ
  let debugCurrentTotalRaw = null;
  let debugCurrentTotalCleaned = null;
  let debugCurrentTotalNum = null;

  if (foundIdx === -1) {
    // Thêm KH mới
    // Tìm tất cả đơn đã mua trước đó của khách này trong sheet Ban_Hang
    let totalOld = 0;
    try {
      const { header: bhHeader, rows: bhRows } = await readFromGoogleSheets("Ban_Hang");
      const idxSdtBH = bhHeader.findIndex(h => h.trim().toLowerCase() === "số điện thoại");
      const idxTongBH = bhHeader.findIndex(h => h.trim().toLowerCase() === "tổng tiền");
      if (idxSdtBH !== -1 && idxTongBH !== -1) {
        totalOld = bhRows.filter(r => normalizePhone(String(r[idxSdtBH] || "")) === target)
          .reduce((sum, r) => sum + (Number(String(r[idxTongBH]).replace(/[^\d.-]/g, "")) || 0), 0);
      }
    } catch {}
    const totalToWrite = totalOld + (Number(amountToAdd) || 0);
    const row = Array(header.length).fill("");
    if (K.ten !== -1) row[K.ten] = name || "Khách lẻ";
    row[K.sdt] = target;
    if (K.tongMua !== -1) row[K.tongMua] = totalToWrite;
    if (K.lanMuaCuoi !== -1) row[K.lanMuaCuoi] = nowVNFull;
    if (K.ngayTao !== -1) row[K.ngayTao] = nowVNFull;
    await appendToGoogleSheets("Khach_Hang", row);
    return { ten: row[K.ten] || "Khách lẻ", sdt: target, tongMua: row[K.tongMua] || totalToWrite };
  } else {
    // Cập nhật KH cũ
    const rowNumber = foundIdx + 2;
    // Đọc tổng mua hiện tại từ sheet Khach_Hang
    let currentTotal = 0;
    if (K.tongMua !== -1) {
      const raw = rows[foundIdx][K.tongMua];
      if (typeof raw === "number") {
        currentTotal = raw;
      } else if (raw) {
        const cleaned = String(raw).replace(/[^\d.-]/g, "");
        const num = Number(cleaned);
        if (Number.isFinite(num)) currentTotal = num;
      }
    }
    const newTotal = currentTotal + (Number(amountToAdd) || 0);

    if (K.ten !== -1 && name && !rows[foundIdx][K.ten]) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.ten + 1)}${rowNumber}`, [[name]]);
    }
    if (K.tongMua !== -1) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.tongMua + 1)}${rowNumber}`, [[newTotal]]);
    }
    if (K.lanMuaCuoi !== -1) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.lanMuaCuoi + 1)}${rowNumber}`, [[nowVNFull]]);
    }
    // Nếu ô Ngày tạo đang trống thì bổ sung (chỉ ngày)
    if (K.ngayTao !== -1 && !rows[foundIdx][K.ngayTao]) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.ngayTao + 1)}${rowNumber}`, [[nowVNDate]]);
    }

    return { ten: (K.ten !== -1 ? rows[foundIdx][K.ten] : "") || name || "Khách lẻ", sdt: target, tongMua: newTotal };
  }
}

/* =================== GET (optional list) =================== */
export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const pageRaw = Number(searchParams.get("page") || 1)
    const limitRaw = Number(searchParams.get("limit") || 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 10
    const force = searchParams.get("refresh") === "1"

    const { header, rows } = await readFromGoogleSheets(SHEETS.BAN_HANG, undefined, { force })
    const idx = idxBanHang(header)
    const idxLoaiDon = header.indexOf("Loại Đơn")
    const idxTrangThai = colIndex(header, "Trạng Thái", "trang_thai")
    const idxGhiChu = colIndex(header, "Ghi chú", "Ghi Chú")
    const idxVanChuyen = colIndex(header, "Hình Thức Vận Chuyển")

    // Tra USERS để hiển thị ĐÚNG tên + vai trò người bán (cột "Người Bán" có thể là
    // ID/email/tên — đôi khi bị URL-encode "D%C5%A9ng"). Resolve về { id, name, role }.
    const normName = (s: any) =>
      String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").trim().toLowerCase()
    const usersById = new Map<string, any>()
    const usersByEmail = new Map<string, any>()
    const usersByName = new Map<string, any>()
    try {
      const { header: UH, rows: UR } = await readFromGoogleSheets("USERS", undefined, { force })
      const uId = colIndex(UH, "ID Nhân Viên")
      const uEmail = colIndex(UH, "Email")
      const uName = colIndex(UH, "Tên", "Ten", "Name")
      const uRole = colIndex(UH, "Vai Trò", "Vai Tro", "Role")
      for (const r of UR) {
        const rec = {
          id: uId !== -1 ? String(r[uId] || "") : "",
          name: uName !== -1 ? String(r[uName] || "") : "",
          role: uRole !== -1 ? String(r[uRole] || "").trim().toLowerCase() : "",
          email: uEmail !== -1 ? String(r[uEmail] || "") : "",
        }
        if (rec.id) usersById.set(rec.id, rec)
        if (rec.email) usersByEmail.set(rec.email.toLowerCase(), rec)
        if (rec.name) usersByName.set(normName(rec.name), rec)
      }
    } catch (e) {
      console.warn("[BAN-HANG GET] đọc USERS để resolve người bán lỗi (bỏ qua):", e)
    }
    const resolveSeller = (raw: any) => {
      let v = String(raw || "")
      if (!v) return undefined
      try { if (/%[0-9A-Fa-f]{2}/.test(v)) v = decodeURIComponent(v) } catch {}
      const u = usersById.get(v) || usersByEmail.get(v.toLowerCase()) || usersByName.get(normName(v))
      if (u) return { id: u.id || v, name: u.name || v, role: u.role || "" }
      return { id: v, name: v, role: "" }
    }

    // Group rows by order ID
    const groupedOrdersMap = new Map<string, any[]>()
    
    rows.forEach((row, rowIndex) => {
      const orderId = String(row[idx.idDon] || "").trim() || `row-${rowIndex}`
      if (!groupedOrdersMap.has(orderId)) {
        groupedOrdersMap.set(orderId, [])
      }
      
      const giaBanRaw = row[idx.giaBan] || ""
      const giaBanNum = typeof giaBanRaw === "number" ? giaBanRaw : (parseInt(String(giaBanRaw).replace(/[^\d]/g, "")) || 0)
      
      groupedOrdersMap.get(orderId)!.push({
        id: orderId,
        ma_don_hang: orderId,
        ngay_xuat: row[idx.ngayXuat],
        ten_khach_hang: row[idx.tenKH],
        so_dien_thoai: row[idx.sdt],
        dia_chi_nhan: idx.diaChiNhan !== -1 ? row[idx.diaChiNhan] : undefined,
        ten_san_pham: row[idx.tenSP],
        loai_may: row[idx.loaiMay],
        dung_luong: row[idx.dungLuong],
        pin: row[idx.pin],
        mau_sac: row[idx.mauSac],
        imei: row[idx.imei],
        tinh_trang_may: row[idx.tinhTrang],
        phu_kien: row[idx.phuKien],
        gia_ban: giaBanNum,
        hinh_thuc_thanh_toan: row[idx.hinhThucTT],
        gia_nhap: row[idx.giaNhap],
        lai: row[idx.lai],
        nhan_vien: resolveSeller(row[idx.nguoiBan]),
        loai_don: idxLoaiDon !== -1 ? row[idxLoaiDon] : "",
        trang_thai: idxTrangThai !== -1 ? row[idxTrangThai] : "hoan_thanh",
        hinh_thuc_van_chuyen: idxVanChuyen !== -1 ? row[idxVanChuyen] : "",
        // Mã GHTK lưu trong cột "Hình Thức Vận Chuyển" dạng "GHTK - 1990038382"
        // (fallback: định dạng cũ "[GHTK: ...]" trong Ghi chú).
        ma_ghtk: (() => {
          const vc = idxVanChuyen !== -1 ? String(row[idxVanChuyen] || "") : ""
          const m1 = vc.match(/GHTK\s*[-–]\s*(\S+)/i)
          if (m1) return m1[1].trim()
          const gc = idxGhiChu !== -1 ? String(row[idxGhiChu] || "") : ""
          const m2 = gc.match(/\[GHTK:\s*([^\]]+)\]/i)
          return m2 ? m2[1].trim() : ""
        })(),
      })
    })

    // Create a list of order summaries (one entry per order ID)
    const orderSummaries = Array.from(groupedOrdersMap.entries()).map(([ma_don_hang, items]) => {
      const first = items[0]
      // Sum up the total price for all items in the order
      const totalThanhToan = items.reduce((sum, item) => sum + (Number(item.gia_ban) || 0), 0)
      
      return {
        ...first,
        thanh_toan: totalThanhToan,
        tong_tien: totalThanhToan,
        items_count: items.length,
        // Collect all IMEIs for filtering
        imeis: items.map(it => it.imei).filter(Boolean)
      }
    })

    // Reverse to get newest first (new rows are appended naturally)
    orderSummaries.reverse()

    // ?ghtk=1 -> chỉ lấy đơn có mã GHTK (cho tab Đơn online)
    const onlyGhtk = searchParams.get("ghtk") === "1"
    let filteredSummaries = onlyGhtk
      ? orderSummaries.filter((o: any) => o.ma_ghtk && String(o.ma_ghtk).trim())
      : orderSummaries

    // ?search= -> tìm trên TOÀN BỘ đơn (mã đơn / tên KH / SĐT / IMEI), không chỉ trang hiện tại
    const searchQ = (searchParams.get("search") || "").trim().toLowerCase()
    if (searchQ) {
      const searchDigits = searchQ.replace(/\D/g, "")
      filteredSummaries = filteredSummaries.filter((o: any) => {
        const ma = String(o.ma_don_hang || o.id || "").toLowerCase()
        const ten = String(o.ten_khach_hang || "").toLowerCase()
        const sdt = String(o.so_dien_thoai || "").replace(/\D/g, "")
        const imeiHit = Array.isArray(o.imeis) && o.imeis.some((i: any) => String(i || "").toLowerCase().includes(searchQ))
        return (
          ma.includes(searchQ) ||
          ten.includes(searchQ) ||
          (searchDigits.length >= 3 && sdt.includes(searchDigits)) ||
          imeiHit
        )
      })
    }

    const total = filteredSummaries.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedOrders = filteredSummaries.slice(start, end)

    return NextResponse.json({
      data: paginatedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error("Ban_Hang GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* =================== POST: Xuất hàng 1 máy =================== */
export async function POST(request: NextRequest) {
  let clientRequestId = "" // hoist để outer catch giải phóng khóa idempotency
  try {
  const body = await request.json()
  // Phân tách nếu FE gửi cấu trúc tối ưu: coreTotal, warrantySelections, warrantyTotal, finalThanhToan
  // Backward compatible: nếu không có coreTotal thì coi Giá Bán hiện gửi đã bao gồm.
  const warrantySelectionsInput = Array.isArray(body.warrantySelections) ? body.warrantySelections : []
  const coreTotalFromClient = typeof body.coreTotal === 'number' ? body.coreTotal : null
  const warrantyTotalFromClient = typeof body.warrantyTotal === 'number' ? body.warrantyTotal : null
  const finalTotalFromClient = typeof body.finalThanhToan === 'number' ? body.finalThanhToan : null
    // Extract phone early for reuse (customer update + warranty contracts)
    const rawPhone = body.customerPhone || body.so_dien_thoai || body.sdt || body["Số Điện Thoại"] || (body.khach_hang && (body.khach_hang.so_dien_thoai || body.khach_hang.sdt))
    const customerPhoneEarly = rawPhone ? normalizePhone(String(rawPhone)) : ""

    // ===== A0 — Idempotency: replay sớm nếu đơn đã xử lý xong (TRƯỚC khi validate,
    // để retry hợp lệ không bị validate "máy đã bán" chặn nhầm) =====
    clientRequestId = String(
      body.clientRequestId || body.idempotencyKey || request.headers.get("x-idempotency-key") || "",
    )
    const __nowTx = Date.now()
    {
      const replay = peekIdempotentDone(clientRequestId, __nowTx)
      if (replay) return NextResponse.json(replay.result, { status: 201 })
    }
    // Tính tổng giá nhập
    let tongGiaNhap = 0

    // Hợp nhất danh sách phụ kiện: chấp nhận cả body.phu_kien và body.accessories
    const _accessories = Array.isArray(body.accessories) ? body.accessories : []
    const _phuKien = Array.isArray(body.phu_kien) ? body.phu_kien : []
    // Ưu tiên accessories nếu có; nếu không thì dùng phu_kien
    const normalizedAccessories = _accessories.length > 0 ? _accessories : _phuKien

    // Nếu có id_may (sản phẩm), tra giá nhập từ sheet Kho_Hang
    if (body.id_may && body.id_may !== "PHU_KIEN_ONLY") {
      const { header, rows } = await readFromGoogleSheets(SHEETS.KHO_HANG)
      const idx = {
        id: colIndex(header, "ID Máy"),
        giaNhap: colIndex(header, "Giá Nhập")
      }
      const found = rows.find((r) => r[idx.id] === body.id_may)
      if (found && idx.giaNhap !== -1) {
        tongGiaNhap += Number(found[idx.giaNhap] || 0)
      }
    }

    // Nếu có phụ kiện (phu_kien/accessories), tra giá nhập từng phụ kiện từ sheet Phu_Kien
    if (normalizedAccessories.length > 0) {
      const { header, rows } = await readFromGoogleSheets(SHEETS.PHU_KIEN)
      const idx = {
        id: colIndex(header, "ID"),
        giaNhap: colIndex(header, "Giá Nhập")
      }
      for (const pk of normalizedAccessories) {
        const found = rows.find((r) => r[idx.id] === pk.id)
        if (found && idx.giaNhap !== -1) {
          // Nếu không có trường số lượng bán, mặc định là 1
          let soLuongBan = 1;
          if (pk.so_luong !== undefined && !isNaN(Number(pk.so_luong))) {
            soLuongBan = Number(pk.so_luong);
          }
          let giaNhapRaw = found[idx.giaNhap] || 0;
          let giaNhapNum = typeof giaNhapRaw === "string" ? Number(giaNhapRaw.replace(/\D/g, "")) : Number(giaNhapRaw);
          tongGiaNhap += giaNhapNum * soLuongBan;
        }
      }
    }

  // Đọc header sheet để map đúng thứ tự cột
  const { header, rows } = await readFromGoogleSheets(SHEETS.BAN_HANG)
  // Xác định cột mở rộng (nếu admin đã thêm thủ công): Phí BH, Tổng Thu, Gói BH, Chi Tiết PK (JSON)
  const idxPhiBH = header.indexOf('Phí BH')
  const idxTongThu = header.indexOf('Tổng Thu')
  const idxGoiBH = header.indexOf('Gói BH')
  const idxGiaBanCol = header.indexOf('Giá Bán')
  const idxChiTietPK = colIndex(header, 'Chi Tiết PK', 'Chi Tiết Phụ Kiện', 'Chi Tiet PK', 'Accessory Detail')
  const idxDiaChiNhanCol = colIndex(header, 'Địa Chỉ Nhận', 'Dia Chi Nhan', 'Dia_Chi_Nhan', 'Địa chỉ nhận', 'Địa chỉ')
  const idxHinhThucVanChuyenCol = colIndex(header, 'Hình Thức Vận Chuyển', 'Hình thức vận chuyển', 'Hinh Thuc Van Chuyen', 'hinh_thuc_van_chuyen')
  // Optional column to store a reference to the uploaded receipt image (Telegram file_id or similar)
  const idxReceiptImageCol = colIndex(
    header,
    'Ảnh Biên Nhận',
    'Receipt File ID',
    'Receipt',
    'Ảnh',
    'Ảnh Biên Nhận (Telegram)',
    'Telegram File ID',
    'receipt_file_id',
  )

  // If client included receipt_image (Telegram upload response), try to extract a stable file identifier
  const rawReceiptPayload = body.receipt_image || body.receiptImage || body.receipt || null
  const getReceiptFileId = (p: any) => {
    if (!p) return ''
    try {
      if (typeof p === 'string') return p
      // Telegram sendPhoto result: { ok: true, result: { photo: [{...}, {...}] } }
      const maybe = p.result || p
      if (maybe && Array.isArray(maybe.photo) && maybe.photo.length) {
        const last = maybe.photo[maybe.photo.length - 1]
        if (last && last.file_id) return last.file_id
      }
      if (maybe && maybe.file_id) return maybe.file_id
      // fallback: attempt stringify
      return JSON.stringify(p)
    } catch (e) {
      return ''
    }
  }
  const receiptFileId = getReceiptFileId(rawReceiptPayload)
    // Tự động sinh ID đơn hàng DH00001-DH99999
    let idDonHang = ""
    const idxIdDon = header.indexOf("ID Đơn Hàng")
    if (idxIdDon !== -1) {
      // Tìm số lớn nhất hiện có
      let maxNum = 0
      for (const r of rows) {
        const val = String(r[idxIdDon] || "")
        const m = val.match(/^DH(\d{5})$/)
        if (m) {
          const num = parseInt(m[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
      idDonHang = `DH${String(maxNum + 1).padStart(5, "0")}`
    }

    // Logic chuẩn: tách nhiều máy thành nhiều đơn, cùng mã đơn hàng
    let mayList = []
    if (Array.isArray(body.products) && body.products.length > 0) {
      mayList = body.products.map((prod: any) => {
        if (!prod.imei && prod.serial && !prod.id_may) {
          return { ...prod, id_may: String(prod.serial).slice(-5) }
        }
        return prod
      })
    } else if (body.id_may) {
      if (!body.imei && body.serial && !body.id_may) {
        mayList = [{ ...body, id_may: String(body.serial).slice(-5) }]
      } else {
        mayList = [{ ...body, id_may: body.id_may }]
      }
    } else if (normalizedAccessories.length > 0) {
      mayList = [{
        ...body,
        ten_san_pham: '',
        imei: '',
        loai_may: '',
        dung_luong: '',
        mau_sac: '',
        pin: '',
        tinh_trang_may: '',
        gia_ban: '',
        gia_nhap: '',
        so_luong: '',
      }]
    }

    // Đọc trạng thái máy từ sheet Kho_Hang cho từng máy (nếu có id_may)
    let khoHangHeader = null, khoHangRows = null, idxTrangThaiKhoHang = -1, idxIdMayKhoHang = -1;
    try {
      const khoHangData = await readFromGoogleSheets(SHEETS.KHO_HANG)
      khoHangHeader = khoHangData.header
      khoHangRows = khoHangData.rows
      idxTrangThaiKhoHang = colIndex(khoHangHeader, "Trạng Thái")
      idxIdMayKhoHang = colIndex(khoHangHeader, "ID Máy")
    } catch {}

    // Map trạng thái máy cho từng máy trong mayList
    mayList = mayList.map((may: any) => {
      let trangThaiMay = ""
      if (may.id_may && khoHangRows && idxTrangThaiKhoHang !== -1 && idxIdMayKhoHang !== -1) {
        const found = khoHangRows.find((r) => r[idxIdMayKhoHang] === may.id_may)
        if (found) trangThaiMay = found[idxTrangThaiKhoHang] || ""
      }
      return { ...may, trang_thai_may: trangThaiMay }
    })

    // ===== PHA A — VALIDATE (chỉ ĐỌC, fail-an-toàn TRƯỚC mọi bước ghi) =====
    // Chặn bán máy đã bán (natural idempotency: retry -> máy đã rời kho -> 409) và bán quá tồn phụ kiện.
    const isPartnerMay = (may: any) =>
      String(may.nguon || may["Nguồn Hàng"] || body["Nguồn Hàng"] || body["nguon_hang"] || may.source || "")
        .toLowerCase().includes("kho ngoài") ||
      String(may.source || "").toLowerCase().includes("partner") ||
      String(may.nguon || may.source || "").toLowerCase().includes("đối tác")
    try {
      const { header: kH, rows: kR } = await readFromGoogleSheets(SHEETS.KHO_HANG)
      const kIdxId = colIndex(kH, "ID Máy")
      const kIdxImei = colIndex(kH, "IMEI")
      const kIdxSerial = colIndex(kH, "Serial")
      const machinePresent = (pid: string) => kR.some((r) => {
        const imei = String(r[kIdxImei] || "").trim().toLowerCase()
        const serial = String(r[kIdxSerial] || "").trim().toLowerCase()
        const idMay = String(r[kIdxId] || "").trim().toLowerCase()
        const imeiLast5 = imei.length >= 5 ? imei.slice(-5) : ""
        const serialLast5 = serial.length >= 5 ? serial.slice(-5) : ""
        return (imei && pid === imei) || (serial && pid === serial) || (idMay && pid === idMay) ||
               (imeiLast5 && pid === imeiLast5) || (serialLast5 && pid === serialLast5)
      })
      for (const may of mayList) {
        if (isPartnerMay(may)) continue // máy đối tác không nằm trong Kho_Hang
        const pid = String(may.imei || may.serial || may.id || may.id_may || "").trim().toLowerCase()
        if (!pid) continue // dòng chỉ phụ kiện
        if (!machinePresent(pid)) {
          return NextResponse.json(
            { ok: false, code: "MACHINE_NOT_AVAILABLE", error: `Máy không còn trong kho (có thể đã bán): ${may.imei || may.serial || may.id_may || pid}` },
            { status: 409 },
          )
        }
      }
    } catch (e) {
      console.warn("[VALIDATE] Đọc Kho_Hang để kiểm tra tồn máy thất bại (bỏ qua chặn cứng):", e)
    }
    if (normalizedAccessories.length > 0) {
      try {
        const { header: pH, rows: pR } = await readFromGoogleSheets(SHEETS.PHU_KIEN)
        const pIdxId = colIndex(pH, "ID")
        const pIdxQty = colIndex(pH, "Số Lượng")
        for (const pk of normalizedAccessories) {
          const fi = pR.findIndex((r) => r[pIdxId] === pk.id)
          if (fi !== -1 && pIdxQty !== -1) {
            const cur = Number(pR[fi][pIdxQty] || 0)
            const sold = pk.so_luong !== undefined ? Number(pk.so_luong) : 1
            if (cur < sold) {
              return NextResponse.json(
                { ok: false, code: "ACCESSORY_INSUFFICIENT", error: `Phụ kiện không đủ số lượng: ${pk.ten_phu_kien || pk.id} (còn ${cur}, cần ${sold})` },
                { status: 409 },
              )
            }
          }
        }
      } catch (e) {
        console.warn("[VALIDATE] Đọc Phu_Kien để kiểm tra tồn phụ kiện thất bại (bỏ qua chặn cứng):", e)
      }
    }

    let allResults = []
    let errorFlag = false
    let internalIdsToRemove: string[] = []
    let newRowsToAppend: any[][] = []
    // Tính tổng phí bảo hành theo selections (sẽ dùng cho dòng đầu tiên)
    let warrantyPkgCodes: string[] = []
    let warrantyTotalFee = 0
    if (warrantySelectionsInput.length) {
      try {
        const pkgMapPre = await loadWarrantyPackages()
        for (const sel of warrantySelectionsInput) {
          const pkg = pkgMapPre[sel.packageCode]
          if (pkg) {
            // Dùng tên gói cho Telegram để rõ ràng hơn
            warrantyPkgCodes.push(pkg.name || pkg.code)
            warrantyTotalFee += pkg.price || 0
          }
        }
      } catch (e) {
        console.warn('[WARRANTY] preload price failed (still continue):', e)
      }
    }

    // Thu thập tổng core (server tính) để phản hồi FE
    let coreTotalServer = 0
    for (let i = 0; i < mayList.length; i++) {
      const may = mayList[i]
      // Dòng đầu tiên: cộng phụ kiện, các dòng sau chỉ ghi máy
      let phuKien = ""
      let giaNhapPhuKien = 0
      if (i === 0 && normalizedAccessories.length > 0) {
        const labels = normalizedAccessories.map((pk: any) => {
          const ten = pk.ten_phu_kien || pk.ten || pk.name || ''
          const loai = pk.loai || pk.type || ''
          const sl = pk.so_luong && !Number.isNaN(Number(pk.so_luong)) ? Number(pk.so_luong) : 1
          // Định dạng mong muốn: Loại + Tên (vd: "Cable TYPE-C")
          const nameWithType = loai ? `${loai} ${ten}` : ten
          const qtySuffix = sl > 1 ? ` x${sl}` : ''
          return `${nameWithType}${qtySuffix}`
        })
        phuKien = labels.join(", ")
        giaNhapPhuKien = normalizedAccessories.reduce((s: number, pk: any) => s + (pk.gia_nhap || 0) * (pk.so_luong || 1), 0)
      }
      // Luôn lấy giá nhập từ payload nếu có
      let tongGiaNhap = 0;
      if (may["gia_nhap"] !== undefined && may["gia_nhap"] !== "" && !isNaN(Number(may["gia_nhap"])) ) {
        tongGiaNhap = Number(may["gia_nhap"]);
      }
      tongGiaNhap += giaNhapPhuKien
      // Xác định có cả máy và phụ kiện không
  const hasMay = mayList.some((m: any) => m.imei)
      const isMayRow = may.imei
      const isOnlyPhuKien = !hasMay && phuKien
      const isPartner =
        String(may.nguon || may["Nguồn Hàng"] || body["Nguồn Hàng"] || body["nguon_hang"] || may.source || "")
          .toLowerCase()
          .includes("kho ngoài") ||
        String(may.source || "").toLowerCase().includes("partner")

      const doiTacTen = may.ten_doi_tac || body.ten_doi_tac || may["Tên Đối Tác"] || body["Tên Đối Tác"] || ""
      const doiTacSDT = may.sdt_doi_tac || body.sdt_doi_tac || may["SĐT Đối Tác"] || body["SĐT Đối Tác"] || ""

      const newRow = header.map((k) => {
        if (k === "ID Đơn Hàng") return idDonHang;
        if (k === "Phụ Kiện") return i === 0 ? phuKien : "";
        if (k === "Giá Nhập") {
          const rounded = Math.round(tongGiaNhap);
          return rounded > 0 ? rounded : "";
        }
        if (k === "Địa Chỉ Nhận") {
          return i === 0 ? (body["Địa Chỉ Nhận"] || body.dia_chi_nhan || "") : "";
        }
        if (k === "Nguồn Hàng" || k === "Nguồn") {
          if (isPartner) return "Kho ngoài (mua lại)";
          return may["Nguồn Hàng"] || may.nguon || body["Nguồn Hàng"] || body["nguon_hang"] || "";
        }
        if (k === "Tên Đối Tác" || k === "Đối Tác") {
          return doiTacTen;
        }
        if (k === "SĐT Đối Tác" || k === "SĐT" || k === "SDT Đối Tác") {
          return doiTacSDT;
        }
        if (k === "Giá Bán") {
          let base = 0;
          if (may["gia_ban"] !== undefined && may["gia_ban"] !== "") {
            base = Number(String(may["gia_ban"]).replace(/\D/g, "")) * (may["so_luong"] || 1);
          } else if (isOnlyPhuKien && body["Thanh Toan"]) {
            base = Number(String(body["Thanh Toan"]).replace(/\D/g, ""));
          }
          return base > 0 ? base : "";
        }
        if (k === "Tổng Thu") {
          // Máy đầu tiên ghi tổng thu, các máy sau ghi 0
          if (i === 0) {
            const baseThanhToan = finalTotalFromClient || body["Thanh Toan"] || body["finalThanhToan"];
            return baseThanhToan || 0;
          } else {
            return 0;
          }
        }
        if (k === "Lãi") {
          // Máy đầu tiên: lãi = tổng thu - giá nhập máy 1
          // Máy sau: lãi = 0 - giá nhập máy tương ứng
          let tongThu = 0;
          if (i === 0) {
            tongThu = Number(finalTotalFromClient || body["Thanh Toan"] || body["finalThanhToan"] || 0);
          }
          const lai = tongThu - Math.round(tongGiaNhap);
          return lai;
        }
        if (k === "Loại Đơn") {
          return body["Loại Đơn"] || body["loai_don"] || may["Loại Đơn"] || may["loai_don"] || ""
        }
        if (k === "Hình Thức Vận Chuyển") {
          return body["Hình Thức Vận Chuyển"] || body["hinh_thuc_van_chuyen"] || may["Hình Thức Vận Chuyển"] || may["hinh_thuc_van_chuyen"] || ""
        }
        if (k === "Người Bán") {
          return body["employeeId"] || may["Người Bán"] || body["Người Bán"] || ""
        }
        // Map từng trường sản phẩm máy
        if (k === "Tên Sản Phẩm") return may.ten_san_pham || may["Tên Sản Phẩm"] || ""
        if (k === "Loại Máy") return may.loai_may || may["Loại Máy"] || ""
        if (k === "Dung Lượng") return may.dung_luong || may["Dung Lượng"] || ""
        if (k === "IMEI") return may.imei || may["IMEI"] || ""
        if (k === "Màu Sắc") return may.mau_sac || may["Màu Sắc"] || ""
        if (k === "Pin (%)") return may.pin || may["Pin (%)"] || ""
        if (k === "Tình Trạng Máy") return may.tinh_trang_may || may["Tình Trạng Máy"] || ""
        // Ghi trạng thái máy vào cột "Trạng Thái Máy" nếu có
        if (k === "Trạng Thái Máy") return may.trang_thai_may || ""
        return may[k] || body[k] || ""
      })
      // Cộng dồn coreTotalServer từ cột Giá Bán của mỗi dòng (nếu có)
      if (idxGiaBanCol !== -1) {
        const raw = newRow[idxGiaBanCol]
        const num = typeof raw === 'number' ? raw : Number(String(raw||'').replace(/\D/g,''))
        if (Number.isFinite(num)) coreTotalServer += num
      }
      // Nếu đây là dòng đầu tiên và có cột mở rộng, ghi Phí BH / Tổng Thu / Gói BH / Chi Tiết PK
      if (i === 0) {
        if (idxPhiBH !== -1) newRow[idxPhiBH] = warrantyTotalFee > 0 ? warrantyTotalFee : ''
        if (idxTongThu !== -1) {
          // Tổng Thu = (Giá Bán core tổng) + phí BH => tạm: lấy body.finalThanhToan nếu có
          const baseThanhToan = finalTotalFromClient || body["Thanh Toan"] || body["finalThanhToan"]
          if (baseThanhToan) newRow[idxTongThu] = baseThanhToan
        }
        if (idxGoiBH !== -1) newRow[idxGoiBH] = warrantyPkgCodes.join(', ')
        if (idxChiTietPK !== -1 && normalizedAccessories.length > 0) {
          const detail = normalizedAccessories.map((pk: any) => ({
            id: pk.id,
            ten: pk.ten_phu_kien || pk.ten || pk.name || '',
            loai: pk.loai || pk.type || '',
            sl: pk.so_luong && !Number.isNaN(Number(pk.so_luong)) ? Number(pk.so_luong) : 1,
            gia_ban: pk.gia_ban ?? undefined
          }))
          try { newRow[idxChiTietPK] = JSON.stringify(detail) } catch { newRow[idxChiTietPK] = '' }
        }
        // Ensure Địa Chỉ Nhận and Hình Thức Vận Chuyển from payload are recorded even if header names vary
        if (idxDiaChiNhanCol !== -1) {
          // prefer explicit fields in body
          newRow[idxDiaChiNhanCol] = body['Địa Chỉ Nhận'] || body.dia_chi_nhan || body.address || body.address_receipt || ''
        }
        if (idxHinhThucVanChuyenCol !== -1) {
          newRow[idxHinhThucVanChuyenCol] = body['Hình Thức Vận Chuyển'] || body.hinh_thuc_van_chuyen || body.hinh_thuc_van_chuyen || body.shippingMethod || ''
        }
        // If there's a dedicated receipt/image column and we have a Telegram file id, persist it
        if (idxReceiptImageCol !== -1 && receiptFileId) {
          newRow[idxReceiptImageCol] = receiptFileId
        }
      }
      newRowsToAppend.push(newRow)
    }

    // ===== A0b — Khóa in_flight ngay trước commit (chống double-submit đồng thời) =====
    {
      const lock = beginIdempotent(clientRequestId, __nowTx)
      if (lock.state === "done") return NextResponse.json(lock.result, { status: 201 })
      if (lock.state === "in_flight") {
        return NextResponse.json({ ok: false, error: "Đơn đang được xử lý, vui lòng đợi" }, { status: 409 })
      }
    }

    // ===== PHA B — COMMIT qua journal (fail bất kỳ bước -> rollback theo thứ tự ngược) =====
    // Nhóm atomic: B1 ghi đơn + B3 xóa kho + B4 trừ phụ kiện (tài nguyên tồn kho money-critical).
    // B2 (xóa dòng đối tác) giữ best-effort: không chụp được dòng để hoàn lại an toàn.
    const journal = new Journal()
    let removedKhoRows: any[][] = [] // snapshot dòng kho đã xóa -> undo: append lại
    const accessoryUndo: { range: string; oldQty: number }[] = [] // snapshot Số Lượng cũ -> undo
    try {
      // B1: Ghi đơn vào Ban_Hang
      await journal.run({
        name: "append-ban-hang",
        do: async () => {
          if (newRowsToAppend.length > 0) {
            const result = await appendMultipleToGoogleSheets(SHEETS.BAN_HANG, newRowsToAppend)
            if (!result.success) throw new Error("Ghi Ban_Hang thất bại")
          }
        },
        undo: async () => {
          const { header: h, rows: rws } = await readFromGoogleSheets(SHEETS.BAN_HANG)
          const ci = h.indexOf("ID Đơn Hàng")
          if (ci !== -1 && idDonHang) {
            const kept = rws.filter((r) => String(r[ci] || "") !== idDonHang)
            if (kept.length !== rws.length) await syncToGoogleSheets(SHEETS.BAN_HANG, kept)
          }
        },
      })

      // B2 (best-effort, NGOÀI journal): xoá dòng kho đối tác (giữ nguyên hành vi cũ)
      for (let i = 0; i < mayList.length; i++) {
        const may = mayList[i]
        try {
          const sourceStr = String(
            may.nguon || may["Nguồn Hàng"] || body["Nguồn Hàng"] || body["nguon_hang"] || may.source || "",
          ).toLowerCase()
          const isPartner = sourceStr.includes("kho ngoài") || sourceStr.includes("đối tác") || sourceStr.includes("partner")
          if (isPartner) {
            const partnerSheetName = may.partner_sheet || may.sheet || body.partner_sheet || ""
            const partnerRowIndex = Number(may.partner_row_index || may.row_index || body.partner_row_index)
            if (partnerSheetName && Number.isFinite(partnerRowIndex) && partnerRowIndex > 1) {
              await tryRemoveRowByIndex(partnerSheetName, partnerRowIndex)
            } else if (may.imei) {
              await tryRemovePartnerRowByIMEI(String(may.imei))
            }
          } else if (may.id_may && may.id_may !== "PHU_KIEN_ONLY") {
            internalIdsToRemove.push(String(may.id_may))
          }
        } catch (e) {
          console.warn("[Partner] Không thể xoá dòng đối tác sau khi bán:", e)
        }
      }

      // B3: Xoá máy nội bộ khỏi Kho_Hang (chụp dòng bị xoá để undo: append lại)
      await journal.run({
        name: "remove-kho",
        do: async () => {
          if (mayList.length === 0) return
          const { header, rows } = await readFromGoogleSheets(SHEETS.KHO_HANG)
          const idxIdMay = colIndex(header, "ID Máy")
          const idxIMEI = colIndex(header, "IMEI")
          const idxSerial = colIndex(header, "Serial")
          if (idxIdMay === -1) return
          const idsToDelete = mayList
            .map((m: any) => String(m.imei || m.serial || m.id || m.id_may || "").trim().toLowerCase())
            .filter(Boolean)
          if (idsToDelete.length === 0) return
          const originalLength = rows.length
          const matched: any[][] = []
          const newRows = rows.filter((r) => {
            const imei = String(r[idxIMEI] || "").trim().toLowerCase()
            const serial = String(r[idxSerial] || "").trim().toLowerCase()
            const idMay = String(r[idxIdMay] || "").trim().toLowerCase()
            const imeiLast5 = imei.length >= 5 ? imei.slice(-5) : ""
            const serialLast5 = serial.length >= 5 ? serial.slice(-5) : ""
            const isMatch = idsToDelete.some((pid: string) =>
              (imei && pid === imei) ||
              (serial && pid === serial) ||
              (idMay && pid === idMay) ||
              (imeiLast5 && pid === imeiLast5) ||
              (serialLast5 && pid === serialLast5)
            )
            if (isMatch) matched.push(r)
            return !isMatch
          })
          if (newRows.length < originalLength) {
            removedKhoRows = matched
            await syncToGoogleSheets(SHEETS.KHO_HANG, newRows)
          }
        },
        undo: async () => {
          if (removedKhoRows.length > 0) await appendMultipleToGoogleSheets(SHEETS.KHO_HANG, removedKhoRows)
        },
      })

      // B4: Trừ số lượng phụ kiện (chụp Số Lượng cũ để undo)
      if (normalizedAccessories.length > 0) {
        await journal.run({
          name: "decrement-accessories",
          do: async () => {
            const { header, rows } = await readFromGoogleSheets(SHEETS.PHU_KIEN)
            const idx = { id: colIndex(header, "ID"), soLuong: colIndex(header, "Số Lượng") }
            for (const pk of normalizedAccessories) {
              const foundIdx = rows.findIndex((r) => r[idx.id] === pk.id)
              if (foundIdx !== -1 && idx.soLuong !== -1) {
                const current = Number(rows[foundIdx][idx.soLuong] || 0)
                const sold = pk.so_luong !== undefined ? Number(pk.so_luong) : 1
                const newQty = Math.max(current - sold, 0)
                const rowNumber = foundIdx + 2 // Google Sheets row (1-based, header là dòng 1)
                const range = `Phu_Kien!${toColumnLetter(idx.soLuong + 1)}${rowNumber}`
                accessoryUndo.push({ range, oldQty: current })
                await updateRangeValues(range, [[newQty]])
              }
            }
          },
          undo: async () => {
            for (const u of accessoryUndo) await updateRangeValues(u.range, [[u.oldQty]])
          },
        })
      }
    } catch (commitErr: any) {
      console.error("[COMMIT] Lỗi giữa chừng, đang rollback:", commitErr?.message || commitErr)
      const report = await journal.rollback()
      failIdempotent(clientRequestId)
      return NextResponse.json(
        {
          ok: false,
          error: "Lỗi tạo đơn, đã hoàn tác các bước đã ghi",
          needsManualFix: report.some((r) => !r.ok),
          rollback: report,
          completed: journal.completedSteps(),
        },
        { status: 500 },
      )
    }
    // ✦ COMMIT POINT ✦ — đơn đã chốt. Từ đây trở đi là best-effort, KHÔNG rollback.
    // (Các hàm ghi của lib/google-sheets đã tự invalidate cache sau khi ghi.)

    /* =================== Cập nhật Khach_Hang (Tổng mua & Lần mua cuối) =================== */
    try {
      // Lấy số điện thoại & tên khách
      const rawPhone = body.customerPhone || body.so_dien_thoai || body.sdt || body["Số Điện Thoại"] || (body.khach_hang && (body.khach_hang.so_dien_thoai || body.khach_hang.sdt))
      const customerPhone = rawPhone ? normalizePhone(String(rawPhone)) : ""
      if (customerPhone) {
        const customerName = body.customerName || body.ten_khach_hang || body.ho_ten || (body.khach_hang && (body.khach_hang.ten || body.khach_hang.ten_khach_hang)) || "Khách lẻ"
        // Tính tổng tiền trong đơn (ưu tiên trường tổng / thanh toán nếu có)
        function toNumber(v: any) {
          if (v === null || v === undefined) return 0
          if (typeof v === "number") return v
            const s = String(v).replace(/[^\d.-]/g, "")
            const n = Number(s)
            return Number.isFinite(n) ? n : 0
        }
        // Ưu tiên dùng tổng thanh toán cuối cùng (bao gồm BH nếu có)
        let amountToAdd = 0
        const explicitTotal = body["Thanh Toan"] || body.thanh_toan || body.tong_tien || body.tongTien || body.total
        const preferFinal = (finalTotalFromClient !== null && Number.isFinite(finalTotalFromClient)) ? Number(finalTotalFromClient) : null
        const serverFinal = Number(coreTotalServer || 0) + Number(warrantyTotalFee || 0)
        if (preferFinal !== null) {
          amountToAdd = preferFinal
        } else if (serverFinal > 0) {
          amountToAdd = serverFinal
        } else if (explicitTotal) {
          // Fallback: tổng core (có thể chưa gồm BH nếu FE không đưa)
          amountToAdd = toNumber(explicitTotal)
        } else {
          // Cuối cùng: cộng từng dòng máy + phụ kiện
          if (Array.isArray(mayList) && mayList.length > 0) {
            for (const m of mayList) {
              if (m && m.gia_ban !== undefined) {
                const line = toNumber(m.gia_ban) * (m.so_luong ? toNumber(m.so_luong) : 1)
                amountToAdd += line
              }
            }
          }
          if (normalizedAccessories.length > 0) {
            for (const pk of normalizedAccessories) {
              if (pk && pk.gia_ban !== undefined) {
                amountToAdd += toNumber(pk.gia_ban) * (pk.so_luong ? toNumber(pk.so_luong) : 1)
              }
            }
          }
        }
        // Phòng trường hợp vẫn bằng 0
        if (amountToAdd <= 0 && explicitTotal) {
          amountToAdd = toNumber(explicitTotal)
        }
        if (amountToAdd > 0) {
          await upsertCustomerByPhone({ phone: customerPhone, name: customerName, amountToAdd })
        }
      }
    } catch (err) {
      console.error("[WARN] Không cập nhật được Khach_Hang:", err)
      // Không throw để tránh làm fail đơn hàng
    }

    // Gửi thông báo về Telegram khi tạo đơn hàng mới
    try {
      // Thu thập danh sách sản phẩm bán
      const productList: any[] = []
      for (const may of mayList) {
        if (!may) continue
        const sourceStr = String(
          may.nguon || may["Nguồn Hàng"] || body["Nguồn Hàng"] || body["nguon_hang"] || may.source || "",
        ).toLowerCase()
        const isPartner = sourceStr.includes("kho ngoài") || sourceStr.includes("đối tác") || sourceStr.includes("partner")
        productList.push({
          ten_san_pham: may.ten_san_pham || may["Tên Sản Phẩm"] || '',
          loai_may: may.loai_may || may["Loại Máy"] || '',
          dung_luong: may.dung_luong || may["Dung Lượng"] || '',
          mau_sac: may.mau_sac || may["Màu Sắc"] || '',
          imei: may.imei || may["IMEI"] || '',
          pin: may.pin ?? may["Pin (%)"] ?? '',
          tinh_trang: may.tinh_trang || may["Tình Trạng Máy"] || '',
          nguon: isPartner ? "Kho ngoài" : "Kho trong",
        })
      }

      const orderInfo = {
        ma_don_hang: idDonHang,
        nhan_vien_ban: body.employeeName || body.employeeId || body.nhan_vien_ban || body.nhan_vien || body["Người Bán"] || "N/A",
        khach_hang: body.khach_hang || {
          ten: body.customerName || body.ten_khach_hang || body.ho_ten || body["Tên Khách Hàng"] || "Khách lẻ",
          so_dien_thoai: body.customerPhone || body.so_dien_thoai || body.sdt || body["Số Điện Thoại"] || "N/A",
          dia_chi: body.dia_chi_nhan || body["Địa Chỉ Nhận"] || body.dia_chi || body.address || undefined
        },
        ghi_chu: body.ghi_chu || body["Ghi Chú"] || '',
        // Tổng tiền: ưu tiên final từ FE nếu có, fallback về trường cũ
        final_total: (typeof finalTotalFromClient === 'number' ? finalTotalFromClient : undefined),
        tong_tien: body["Thanh Toan"] || body.tong_tien || body.thanh_toan || 0,
        phuong_thuc_thanh_toan: body["Phuong Thuc Thanh Toan"] || body["phuong_thuc_thanh_toan"] || body.paymentMethod || body.hinh_thuc_thanh_toan || body["Hình Thức Thanh Toán"] || "N/A",
        hinh_thuc_van_chuyen: body["Hình Thức Vận Chuyển"] || body.hinh_thuc_van_chuyen || undefined,
        ngay_tao: Date.now(),
        products: productList,
        // Gửi gói bảo hành nếu có
        warrantyPackages: warrantyPkgCodes,
        // Chi tiết thanh toán dạng mảng để formatter render rõ từng dòng
        payments: Array.isArray(body.payments) ? body.payments : [],
        // Phụ kiện kèm loại + số lượng
        accessories: Array.isArray(body.accessories)
          ? body.accessories
          : (Array.isArray(body.phu_kien) ? body.phu_kien.map((pk: any)=> ({
              id: pk.id,
              ten_phu_kien: pk.ten_phu_kien || pk.ten || pk.name,
              loai: pk.loai || pk.type || '',
              so_luong: pk.so_luong || pk.sl || 1,
              gia_ban: pk.gia_ban
            })) : [])
      }
      console.log("[TELEGRAM DEBUG] orderInfo gửi đi:", orderInfo)
      // Chuẩn hóa loại đơn để nhận diện đúng đơn online/offline
      const rawLoaiDon = body.loai_don || body["Loại Đơn"] || ""
      const normLoaiDon = String(rawLoaiDon).toLowerCase().replace(/đ|đơn|onl|online|off|offline|\s+/g, m => {
        if (/onl|online/.test(m)) return "online"
        if (/off|offline/.test(m)) return "offline"
        return ""
      })
  const orderType = /onl|online/.test(normLoaiDon) ? "online" : "offline"
  // kèm loại đơn cho formatter usage
  ;(orderInfo as any).order_type = orderType
  // Only send Telegram notification here if FE didn't already send it (skipTelegram flag)
  if (!body || !body.skipTelegram) {
    const text = formatOrderMessage(orderInfo, "new")
    // Đơn ONLINE + có mã GHTK -> đính nút "Đã gửi hàng" (callback_data ngắn: "ship:<maGHTK>")
    const vcStr = String((orderInfo as any).hinh_thuc_van_chuyen || "")
    const ghtkMatch = orderType === "online" ? vcStr.match(/GHTK\s*[-–]?\s*(\d+)/i) : null
    if (ghtkMatch) {
      const maGHTK = ghtkMatch[1]
      await sendTelegramMessageWithButtons(
        text,
        [[{ text: "📦 Đã gửi hàng", callback_data: `ship:${maGHTK}` }]],
        "online",
      )
    } else {
      await sendTelegramMessage(text, orderType)
    }
  }
    } catch (err) {
      console.error("Lỗi gửi thông báo Telegram:", err)
    }

    // ===== Cộng TIỀN MẶT vào QUỸ khi đơn có thanh toán tiền mặt (best-effort) =====
    // VD: khách trả 10tr (5tr CK + 5tr tiền mặt) -> +5tr vào quỹ. Nguồn: khách offline/online.
    try {
      const payments = Array.isArray(body.payments) ? body.payments : []
      const cashAmount = payments.reduce((s: number, p: any) => {
        const m = String(p?.method || p?.label || "").toLowerCase()
        const isCash = m.includes("tiền mặt") || m.includes("tien mat") || m.includes("cash")
        return isCash ? s + (Number(p?.amount) || 0) : s
      }, 0)
      if (cashAmount > 0) {
        const seller = getServerUser(request)
        const rawLoaiDon = String(body.loai_don || body["Loại Đơn"] || "")
        const isOnline = /onl|online/i.test(rawLoaiDon)
        await recordCashTransaction({
          loai: "thu",
          so_tien: cashAmount,
          nguon: isOnline ? "khach_online" : "khach_offline",
          ma_tham_chieu: idDonHang,
          ly_do: "Khách thanh toán",
          nhan_vien: seller?.name || seller?.email || body.employeeName || body.employeeId || "",
        })
      }
    } catch (err) {
      console.warn("[CASH] Cộng quỹ tiền mặt từ đơn bán lỗi (bỏ qua):", err)
    }

    /* =================== WARRANTY (Optional) =================== */
    let warrantySummary: any[] = []
    let warrantyError: string | null = null
    let warrantySkipped: any[] = []
    try {
      const selectionsRaw: any = warrantySelectionsInput
      if (Array.isArray(selectionsRaw) && selectionsRaw.length > 0) {
        // Chấp nhận cả imei hoặc serial, và bắt buộc có packageCode
        const selections: WarrantySelectionInput[] = selectionsRaw
          .filter((s: any) => s && (s.imei || s.serial) && s.packageCode)
          .map((s: any) => ({
            imei: s.imei ? String(s.imei).trim() : '',
            serial: s.serial ? String(s.serial).trim() : '',
            packageCode: String(s.packageCode).trim(),
            startDate: s.startDate,
            phone: customerPhoneEarly || s.phone,
            employee: body.employeeId || s.employee,
            note: s.note || ''
          }))
        if (selections.length) {
          const pkgMap = await loadWarrantyPackages().catch(e => { throw new Error("Không đọc được sheet gói bảo hành: " + e.message) })
          // Filter out inactive / not found packages
          const validSelections = selections.filter(sel => {
            const pkg = pkgMap[sel.packageCode]
            if (!pkg) { console.warn("[WARRANTY] Package không tồn tại:", sel.packageCode); return false }
            if (!pkg.active) { console.warn("[WARRANTY] Package không active:", sel.packageCode); return false }
            return true
          })
          // Ngăn trùng hợp đồng: loại bỏ selection nếu đã có hợp đồng active cho cùng IMEI + gói
          if (validSelections.length) {
            try {
              const { header: cHeader, rows: cRows } = await readFromGoogleSheets('HOP_DONG_BAO_HANH')
              const idxMap = {
                imei: cHeader.indexOf('IMEI'),
                pkg: cHeader.indexOf('Mã Gói'),
                overall: cHeader.indexOf('Hạn Tổng'),
                status: cHeader.indexOf('Trạng Thái')
              }
              const now = Date.now()
              const activeKeys = new Set<string>()
              for (const r of cRows) {
                const st = idxMap.status !== -1 ? (r[idxMap.status]||'').toString() : ''
                const overall = idxMap.overall !== -1 ? r[idxMap.overall] : ''
                const t = overall ? new Date(overall).getTime() : 0
                if (st === 'expired') continue
                if (t && t < now) continue
                const im = idxMap.imei !== -1 ? r[idxMap.imei] : ''
                const pk = idxMap.pkg !== -1 ? r[idxMap.pkg] : ''
                if (im && pk) activeKeys.add(im + '|' + pk)
              }
              const filtered: WarrantySelectionInput[] = []
              for (const sel of validSelections) {
                const key = sel.imei + '|' + sel.packageCode
                if (activeKeys.has(key)) {
                  warrantySkipped.push({ imei: sel.imei, packageCode: sel.packageCode, reason: 'duplicate_active' })
                } else {
                  filtered.push(sel)
                }
              }
              if (filtered.length) {
                const contracts = buildContracts(idDonHang, customerPhoneEarly, filtered, pkgMap, body.employeeId)
                await saveContracts(contracts)
                const newSummary = contracts.map(c => ({
                  ma_hd: c.contractCode,
                  imei: c.imei,
                  serial: c.serial,
                  ma_goi: c.packageCode,
                  ten_goi: pkgMap[c.packageCode]?.name || c.packageCode,
                  han_tong: c.overallUntil,
                  trang_thai: c.status
                }))
                warrantySummary = [...warrantySummary, ...newSummary]
              }
              // Thêm cả các mục bị skip (vì đã có BH active) vào summary để hiển thị ở thông báo
              if (warrantySkipped.length > 0) {
                const skippedSummary = warrantySkipped.map(s => ({
                  ma_hd: 'ALREADY_ACTIVE',
                  imei: s.imei,
                  serial: s.serial,
                  ma_goi: s.packageCode,
                  ten_goi: pkgMap[s.packageCode]?.name || s.packageCode,
                  trang_thai: 'active'
                }))
                warrantySummary = [...warrantySummary, ...skippedSummary]
              }
            } catch (dupErr) {
              console.warn('[WARRANTY] Duplicate check failed, fallback tạo tất cả:', dupErr)
              const contracts = buildContracts(idDonHang, customerPhoneEarly, validSelections, pkgMap, body.employeeId)
              await saveContracts(contracts)
              warrantySummary = contracts.map(c => ({
                ma_hd: c.contractCode,
                imei: c.imei,
                serial: c.serial,
                ma_goi: c.packageCode,
                ten_goi: pkgMap[c.packageCode]?.name || c.packageCode,
                han_tong: c.overallUntil,
                trang_thai: c.status
              }))
            }
          }
        }
      }
    } catch (e: any) {
      warrantyError = e?.message || String(e)
      console.error("[WARRANTY] Lỗi xử lý bảo hành:", warrantyError)
    }
    const finalTotalServer = finalTotalFromClient || (coreTotalServer + warrantyTotalFee)
    // Ghi thông báo hệ thống: Đơn hàng mới
    try {
      const customerName = body.customerName || body.ten_khach_hang || body.ho_ten || (body.khach_hang && (body.khach_hang.ten || body.khach_hang.ten_khach_hang)) || "Khách lẻ"
      await addNotification({
        tieu_de: `Đơn hàng mới ${idDonHang || ''}`.trim(),
        noi_dung: `Khách: ${customerName} • Tổng: ₫${Number(finalTotalServer || 0).toLocaleString('vi-VN')}`,
        loai: "ban_hang",
        nguoi_gui_id: body.employeeId || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) {
      console.warn("[NOTIFY] Không thể ghi thông báo đơn hàng mới:", e)
    }
    const __responsePayload = {
      ok: true,
      created: true,
      id_don_hang: idDonHang,
      warranties: warrantySummary,
      warrantySkipped,
      warrantyError,
      coreTotalServer,
      warrantyTotalServer: warrantyTotalFee,
      finalTotalServer
    }
    // Lưu kết quả để retry cùng clientRequestId được replay (idempotent), không tạo trùng.
    completeIdempotent(clientRequestId, __responsePayload, __nowTx)
    return NextResponse.json(__responsePayload, { status: 201 })
  } catch (error) {
    console.error("Ban_Hang POST error:", error)
    // Giải phóng khóa để cho phép thử lại (đơn có thể đã/chưa commit — natural key sẽ chặn trùng nếu đã commit).
    failIdempotent(clientRequestId)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}