
// app/api/ban-hang/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { sendTelegramMessage, formatOrderMessage } from "@/lib/telegram"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues, syncToGoogleSheets } from "@/lib/google-sheets"
import { DateTime } from "luxon"
import { addNotification } from "@/lib/notifications"
import { loadWarrantyPackages, buildContracts, saveContracts, type WarrantySelectionInput } from "@/lib/warranty"

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
const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .toLowerCase()

function colIndex(header: string[], ...names: string[]) {
  const h = header.map((x) => x.trim())
  for (const n of names) {
    const i = h.findIndex((x) => x === n)
    if (i !== -1) return i
  }
  // fallback nhẹ bằng normalize (phòng sai khác dấu)
  const hh = header.map((x) => norm(x))
  for (const n of names) {
    const i = hh.findIndex((x) => x === norm(n))
    if (i !== -1) return i
  }
  return -1
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
      const idxIMEI = header.indexOf("IMEI")
      const idxTrangThai = header.indexOf("Trạng Thái")
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
    const { header, rows } = await readFromGoogleSheets(SHEETS.BAN_HANG)
    const idx = idxBanHang(header)
    const mapped = rows.map((row) => ({
      id: row[idx.idDon],
      ma_don_hang: row[idx.idDon],
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
      gia_ban: row[idx.giaBan],
      hinh_thuc_thanh_toan: row[idx.hinhThucTT],
      gia_nhap: row[idx.giaNhap],
      lai: row[idx.lai],
      nhan_vien: row[idx.nguoiBan] ? { id: row[idx.nguoiBan] } : undefined,
      loai_don: row[header.indexOf("Loại Đơn")],
    }))
    return NextResponse.json({ data: mapped })
  } catch (error) {
    console.error("Ban_Hang GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* =================== POST: Xuất hàng 1 máy =================== */
export async function POST(request: NextRequest) {
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

    let allResults = []
    let errorFlag = false
    // Tính tổng phí bảo hành theo selections (sẽ dùng cho dòng đầu tiên)
    let warrantyPkgCodes: string[] = []
    let warrantyTotalFee = 0
    if (warrantySelectionsInput.length) {
      try {
        const pkgMapPre = await loadWarrantyPackages()
        for (const sel of warrantySelectionsInput) {
          const pkg = pkgMapPre[sel.packageCode]
            if (pkg) {
              warrantyPkgCodes.push(pkg.code)
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
          .includes("đối tác") ||
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
          if (isPartner) return "Đối tác (mua lại)";
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
      const result = await appendToGoogleSheets(SHEETS.BAN_HANG, newRow)
      allResults.push(result)
      if (!result.success) errorFlag = true

      // Sau khi ghi đơn thành công: nếu là máy đối tác thì xoá khỏi sheet đối tác
      try {
        const sourceStr = String(
          may.nguon || may["Nguồn Hàng"] || body["Nguồn Hàng"] || body["nguon_hang"] || may.source || "",
        ).toLowerCase()
        const isPartner = sourceStr.includes("đối tác") || sourceStr.includes("partner")
        if (isPartner) {
          const partnerSheetName = may.partner_sheet || may.sheet || body.partner_sheet || ""
          const partnerRowIndex = Number(may.partner_row_index || may.row_index || body.partner_row_index)
          if (partnerSheetName && Number.isFinite(partnerRowIndex) && partnerRowIndex > 1) {
            await tryRemoveRowByIndex(partnerSheetName, partnerRowIndex)
          } else if (may.imei) {
            await tryRemovePartnerRowByIMEI(String(may.imei))
          }
        }
      } catch (e) {
        console.warn("[Partner] Không thể xoá dòng đối tác sau khi bán:", e)
      }
    }
    if (errorFlag) {
      return NextResponse.json({ error: "Lỗi ghi Google Sheets" }, { status: 500 })
    }

    // Giảm số lượng phụ kiện trong kho
    if (normalizedAccessories.length > 0) {
      const { header, rows } = await readFromGoogleSheets(SHEETS.PHU_KIEN)
      const idx = {
        id: colIndex(header, "ID"),
        soLuong: colIndex(header, "Số Lượng")
      }
      for (const pk of normalizedAccessories) {
        const foundIdx = rows.findIndex((r) => r[idx.id] === pk.id)
        if (foundIdx !== -1 && idx.soLuong !== -1) {
          let current = Number(rows[foundIdx][idx.soLuong] || 0)
          let sold = pk.so_luong !== undefined ? Number(pk.so_luong) : 1
          let newQty = Math.max(current - sold, 0)
          const rowNumber = foundIdx + 2 // Google Sheets row index (1-based, header is row 1)
          await updateRangeValues(`Phu_Kien!${toColumnLetter(idx.soLuong + 1)}${rowNumber}`, [[newQty]])
        }
      }
    }

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
        productList.push({
          ten_san_pham: may.ten_san_pham || may["Tên Sản Phẩm"] || '',
          loai_may: may.loai_may || may["Loại Máy"] || '',
          dung_luong: may.dung_luong || may["Dung Lượng"] || '',
          mau_sac: may.mau_sac || may["Màu Sắc"] || '',
          imei: may.imei || may["IMEI"] || '',
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
    await sendTelegramMessage(formatOrderMessage(orderInfo, "new"), orderType)
  }
    } catch (err) {
      console.error("Lỗi gửi thông báo Telegram:", err)
    }

    /* =================== WARRANTY (Optional) =================== */
    let warrantySummary: any[] = []
    let warrantyError: string | null = null
    let warrantySkipped: any[] = []
    try {
      const selectionsRaw: any = warrantySelectionsInput
      if (Array.isArray(selectionsRaw) && selectionsRaw.length > 0) {
        // Only keep selections that have imei & packageCode
        const selections: WarrantySelectionInput[] = selectionsRaw
          .filter((s: any) => s && s.imei && s.packageCode)
          .map((s: any) => ({
            imei: String(s.imei),
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
                warrantySummary = contracts.map(c => ({
                  ma_hd: c.contractCode,
                  imei: c.imei,
                  ma_goi: c.packageCode,
                  han_tong: c.overallUntil,
                  trang_thai: c.status
                }))
              }
            } catch (dupErr) {
              console.warn('[WARRANTY] Duplicate check failed, fallback tạo tất cả:', dupErr)
              const contracts = buildContracts(idDonHang, customerPhoneEarly, validSelections, pkgMap, body.employeeId)
              await saveContracts(contracts)
              warrantySummary = contracts.map(c => ({
                ma_hd: c.contractCode,
                imei: c.imei,
                ma_goi: c.packageCode,
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
    return NextResponse.json({
      ok: true,
      created: true,
      id_don_hang: idDonHang,
      warranties: warrantySummary,
      warrantySkipped,
      warrantyError,
      coreTotalServer,
      warrantyTotalServer: warrantyTotalFee,
      finalTotalServer
    }, { status: 201 })
  } catch (error) {
    console.error("Ban_Hang POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}