import { NextRequest, NextResponse } from "next/server"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues, syncToGoogleSheets } from "@/lib/google-sheets"
import { getDeviceId, last5FromDeviceId } from "@/lib/device-id"
import { addNotification } from "@/lib/notifications"
import { cancelContractsByIMEIs } from "@/lib/warranty"
import { sendTelegramMessage, formatOrderMessage } from "@/lib/telegram"

const SHEET_CANDIDATES = [
  "Hoan_Tra",
  "Hoàn Trả",
  "Hoan Tra",
  "HoanTra",
]

const KHACH_HANG_SHEET = "Khach_Hang"

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

async function getHoanTraSheet() {
  let lastErr: any
  for (const name of SHEET_CANDIDATES) {
    try {
      const res = await readFromGoogleSheets(name, undefined, { silent: true })
      return { sheet: name, header: res.header, rows: res.rows }
    } catch (e) {
      lastErr = e
      continue
    }
  }
  throw new Error("Không tìm thấy sheet Hoàn Trả: " + (lastErr?.message || "unknown"))
}

function parseNumber(v: any): number {
  if (v === undefined || v === null || v === "") return 0
  const n = Number(String(v).replace(/[^\d.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

async function adjustCustomerTotal(phoneRaw: string | undefined, amountDelta: number) {
  if (!phoneRaw) return { adjusted: false }
  const phone = normalizePhone(String(phoneRaw))
  if (!phone) return { adjusted: false }
  const { header, rows } = await readFromGoogleSheets(KHACH_HANG_SHEET)
  const idx = {
    ten: header.indexOf("Tên Khách Hàng"),
    sdt: header.indexOf("Số Điện Thoại"),
    tongMua: header.indexOf("Tổng Mua"),
    lanMuaCuoi: header.indexOf("Lần Mua Cuối"),
  }
  if (idx.sdt === -1) return { adjusted: false }
  const found = rows.findIndex(r => normalizePhone(String(r[idx.sdt] || "")) === phone)
  if (found === -1) return { adjusted: false }
  const rowNum = found + 2
  let current = 0
  if (idx.tongMua !== -1) {
    current = parseNumber(rows[found][idx.tongMua])
  }
  const next = Math.max(0, current + amountDelta)
  if (idx.tongMua !== -1) {
    await updateRangeValues(`${KHACH_HANG_SHEET}!${toColumnLetter(idx.tongMua + 1)}${rowNum}`, [[next]])
  }
  if (idx.lanMuaCuoi !== -1) {
    const nowVN = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    await updateRangeValues(`${KHACH_HANG_SHEET}!${toColumnLetter(idx.lanMuaCuoi + 1)}${rowNum}`, [[nowVN]])
  }
  return { adjusted: true, newTotal: next }
}

export async function GET() {
  try {
    const { sheet, header, rows } = await getHoanTraSheet()
    const idx = (name: string) => header.indexOf(name)
    const data = rows.map(r => ({
      id: r[idx("ID")],
      ngay_yeu_cau: r[idx("Ngày Yêu Cầu")],
      khach_hang: r[idx("Khách Hàng")],
      so_dien_thoai: r[idx("Số Điện Thoại")],
      san_pham: r[idx("Sản Phẩm")],
      imei: r[idx("IMEI")],
      ly_do: r[idx("Lý Do")],
      trang_thai: r[idx("Trạng Thái")],
      nguoi_xu_ly: r[idx("Người Xử Lý")],
      ngay_xu_ly: r[idx("Ngày Xử Lý")],
      ghi_chu: r[idx("Ghi Chú")],
      sheet,
    }))
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      khach_hang,
      so_dien_thoai,
      san_pham,
      imei,
      serial,
      ly_do,
      trang_thai,
      nguoi_xu_ly,
      ma_don_hang,
      so_tien_hoan,
      ghi_chu,
      // Flags/metadata for processing
      restock_inhouse, // boolean: nếu hàng trong kho thì nhập lại
      partner_return,  // boolean: nếu hàng đối tác thì đánh dấu trả đối tác
      partner_sheet,   // tên sheet đối tác (nếu có)
      partner_row_index, // dòng đối tác (nếu có)
    } = body || {}

    const { header, rows, sheet } = await getHoanTraSheet()
    const H = {
      id: header.indexOf("ID"),
      ngayYC: header.indexOf("Ngày Yêu Cầu"),
      khach: header.indexOf("Khách Hàng"),
      sdt: header.indexOf("Số Điện Thoại"),
      sp: header.indexOf("Sản Phẩm"),
      imei: header.indexOf("IMEI"),
      lyDo: header.indexOf("Lý Do"),
      trangThai: header.indexOf("Trạng Thái"),
      nguoiXL: header.indexOf("Người Xử Lý"),
      ngayXL: header.indexOf("Ngày Xử Lý"),
      ghiChu: header.indexOf("Ghi Chú"),
    }

    // Sinh ID dạng RT00001
    let maxNum = 0
    if (H.id !== -1) {
      for (const r of rows) {
        const val = String(r[H.id] || "")
        const m = val.match(/^RT(\d{5})$/)
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
      }
    }
    const newId = `RT${String(maxNum + 1).padStart(5, "0")}`

    const line = Array(header.length).fill("")
    if (H.id !== -1) line[H.id] = newId
    if (H.ngayYC !== -1) line[H.ngayYC] = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    if (H.khach !== -1) line[H.khach] = khach_hang || ""
    if (H.sdt !== -1) line[H.sdt] = so_dien_thoai ? normalizePhone(String(so_dien_thoai)) : ""
    if (H.sp !== -1) line[H.sp] = san_pham || ""
  if (H.imei !== -1) line[H.imei] = imei || ""
    if (H.lyDo !== -1) line[H.lyDo] = ly_do || ""
    if (H.trangThai !== -1) line[H.trangThai] = trang_thai || "Đang xử lý"
    if (H.nguoiXL !== -1) line[H.nguoiXL] = nguoi_xu_ly || ""
    if (H.ngayXL !== -1) line[H.ngayXL] = ""

    // Ghi chú: chèn thông tin phụ như mã đơn / số tiền hoàn
    const extraNotes: string[] = []
    if (ma_don_hang) extraNotes.push(`Mã đơn: ${ma_don_hang}`)
    if (so_tien_hoan) extraNotes.push(`Hoàn: ${Number(so_tien_hoan).toLocaleString("vi-VN")}đ`)
    if (ghi_chu) extraNotes.push(String(ghi_chu))
    const noteStr = extraNotes.join(" | ")
    if (H.ghiChu !== -1) line[H.ghiChu] = noteStr

    const result = await appendToGoogleSheets(sheet, line)
    try {
      await addNotification({
        tieu_de: "Tạo yêu cầu hoàn trả",
        noi_dung: `${khach_hang || 'Khách lẻ'} • ${imei || san_pham || newId}`,
        loai: "hoan_tra",
        nguoi_gui_id: nguoi_xu_ly || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) { console.warn('[NOTIFY] hoan-tra POST fail:', e) }

    // Nếu có số tiền hoàn, cập nhật Khach_Hang (Tổng Mua -= so_tien_hoan)
    let customerAdjust: any = { adjusted: false }
    if (so_tien_hoan) {
      customerAdjust = await adjustCustomerTotal(so_dien_thoai, -Math.abs(Number(so_tien_hoan)))
    }

    // 1) Mark Ban_Hang rows as Hoàn trả; zero out Lãi & Tổng Thu; add note; and reconstruct Kho_Hang row for in-house items
    try {
      if (ma_don_hang || imei) {
        const { header: BH, rows: BR } = await readFromGoogleSheets('Ban_Hang')
      const bIdx = {
          idDon: BH.indexOf('ID Đơn Hàng'),
          tenSP: BH.indexOf('Tên Sản Phẩm'),
          loaiMay: BH.indexOf('Loại Máy'),
          dungLuong: BH.indexOf('Dung Lượng'),
          pin: BH.indexOf('Pin (%)'),
          mauSac: BH.indexOf('Màu Sắc'),
          imei: BH.indexOf('IMEI'),
        serial: BH.indexOf('Serial'),
          tinhTrang: BH.indexOf('Tình Trạng Máy'),
          giaNhap: BH.indexOf('Giá Nhập'),
          giaBan: BH.indexOf('Giá Bán'),
          lai: BH.indexOf('Lãi'),
          tongThu: BH.indexOf('Tổng Thu'),
          loaiDon: BH.indexOf('Loại Đơn'),
          trangThai: BH.indexOf('Trạng Thái'),
          ghiChu: BH.indexOf('Ghi Chú'),
          nguonHang: BH.indexOf('Nguồn Hàng') !== -1 ? BH.indexOf('Nguồn Hàng') : BH.indexOf('Nguồn'),
          tenDoiTac: BH.indexOf('Tên Đối Tác'),
          sdtDoiTac: BH.indexOf('SĐT Đối Tác'),
        }
        const targetId = String(ma_don_hang || '')
        const imeiStr = String(imei || '')
        const serialStr = String(serial || '')
        const matchedIndexes: number[] = []
        for (let i = 0; i < BR.length; i++) {
          const row = BR[i]
          // If IMEI is provided, only match by IMEI (avoid marking the whole order)
          let isMatch = false
          if (imeiStr) {
            isMatch = bIdx.imei !== -1 && String(row[bIdx.imei] || '') === imeiStr
          } else if (serialStr) {
            isMatch = bIdx.serial !== -1 && String(row[bIdx.serial] || '') === serialStr
          } else if (targetId) {
            // Fallback: only if IMEI is not provided, match by order ID
            isMatch = bIdx.idDon !== -1 && String(row[bIdx.idDon] || '') === targetId
          }
          if (isMatch) {
            // Mark Hoàn trả, zero Lãi & Tổng Thu, set Loại Đơn
            if (bIdx.trangThai !== -1) row[bIdx.trangThai] = 'Hoàn trả'
            if (bIdx.lai !== -1) row[bIdx.lai] = '0'
            if (bIdx.tongThu !== -1) row[bIdx.tongThu] = '0'
            if (bIdx.loaiDon !== -1) row[bIdx.loaiDon] = 'Hoàn trả'
            if (bIdx.ghiChu !== -1) {
              const prev = row[bIdx.ghiChu] || ''
              const extra = `Hoàn trả: ${newId}${ly_do?` - ${ly_do}`:''}`
              row[bIdx.ghiChu] = prev ? `${prev} | ${extra}` : extra
            }
            matchedIndexes.push(i)
          }
        }
        // Write back Ban_Hang if changes
        if (matchedIndexes.length) await syncToGoogleSheets('Ban_Hang', BR)

        // Re-create Kho_Hang rows for non-partner items
        try {
          // Load Kho_Hang header once
          const { header: KH, rows: KR } = await readFromGoogleSheets('Kho_Hang')
          const kIdx = {
            idMay: KH.indexOf('ID Máy'),
            ngayNhap: KH.indexOf('Ngày Nhập'),
            tenSP: KH.indexOf('Tên Sản Phẩm'),
            loaiMay: KH.indexOf('Loại Máy'),
            dungLuong: KH.indexOf('Dung Lượng'),
            pin: KH.indexOf('Pin (%)'),
            mauSac: KH.indexOf('Màu Sắc'),
            imei: KH.indexOf('IMEI'),
            serial: KH.indexOf('Serial'),
            tinhTrang: KH.indexOf('Tình Trạng Máy') !== -1 ? KH.indexOf('Tình Trạng Máy') : KH.indexOf('Tình Trạng'),
            giaNhap: KH.indexOf('Giá Nhập'),
            giaBan: KH.indexOf('Giá Bán'),
            nguon: KH.indexOf('Nguồn') !== -1 ? KH.indexOf('Nguồn') : KH.indexOf('Nguồn Hàng'),
            ghiChu: KH.indexOf('Ghi Chú'),
            trangThai: KH.indexOf('Trạng Thái'),
          }
          // Chỉ lấy ngày dạng dd/mm/yyyy theo múi giờ VN
          const nowVN = new Date()
          const ngayVN = nowVN.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
          const computeIdMay = (im: string, sr: string) => {
            const deviceId = getDeviceId({ IMEI: (im||'').trim(), Serial: (sr||'').trim().toUpperCase() })
            return deviceId ? last5FromDeviceId(deviceId) : ''
          }
          const toNum = (v:any) => { const n = Number(String(v).replace(/[^\d.-]/g,'')); return Number.isFinite(n)? n: 0 }
          for (const idxRow of matchedIndexes) {
            const r = BR[idxRow]
            const nguon = bIdx.nguonHang !== -1 ? String(r[bIdx.nguonHang]||'').toLowerCase() : ''
            const isPartner = nguon.includes('đối tác') || nguon.includes('doi tac') || nguon.includes('partner')
            if (isPartner) continue // không nhập lại kho shop cho hàng đối tác
            const im = bIdx.imei !== -1 ? String(r[bIdx.imei]||'') : ''
            const sr = bIdx.serial !== -1 ? String(r[bIdx.serial]||'') : ''
            if (!im && !sr) continue // không có định danh thì bỏ qua để tránh nhập nhầm
            const newRow = KH.map((col, ci) => {
              if (ci === kIdx.idMay) return computeIdMay(im, sr)
              if (ci === kIdx.ngayNhap) return ngayVN
              if (ci === kIdx.tenSP) return bIdx.tenSP !== -1 ? r[bIdx.tenSP] : ''
              if (ci === kIdx.loaiMay) return bIdx.loaiMay !== -1 ? r[bIdx.loaiMay] : ''
              if (ci === kIdx.dungLuong) return bIdx.dungLuong !== -1 ? r[bIdx.dungLuong] : ''
              if (ci === kIdx.pin) return bIdx.pin !== -1 ? r[bIdx.pin] : ''
              if (ci === kIdx.mauSac) return bIdx.mauSac !== -1 ? r[bIdx.mauSac] : ''
              if (ci === kIdx.imei) return im
              if (ci === kIdx.serial) return sr
              if (ci === kIdx.tinhTrang) return bIdx.tinhTrang !== -1 ? r[bIdx.tinhTrang] : ''
              if (ci === kIdx.giaNhap) return bIdx.giaNhap !== -1 ? toNum(r[bIdx.giaNhap]) : ''
              if (ci === kIdx.giaBan) return bIdx.giaBan !== -1 ? toNum(r[bIdx.giaBan]) : ''
              if (ci === kIdx.nguon) return 'Hoàn trả'
              // Yêu cầu: Ghi chú không cần ghi gì cả
              if (ci === kIdx.ghiChu) return ''
              if (ci === kIdx.trangThai) return 'Còn hàng'
              return ''
            })
            await appendToGoogleSheets('Kho_Hang', newRow)
          }
        } catch (err) {
          console.warn('[RETURN] Recreate Kho_Hang failed:', err)
        }
      }
    } catch (err) {
      console.warn('[RETURN] Mark Ban_Hang failed:', err)
    }

    // 2) Cancel/Update warranty contracts for returned IMEI
    try {
      if (imei) {
        await cancelContractsByIMEIs([String(imei)], { reason: 'return', actor: nguoi_xu_ly || '' })
      }
    } catch (err) {
      console.warn('[RETURN] Cancel warranties failed:', err)
    }

    // 3) Partner handling: mark or re-add to partner sheet (simple mark only)
    try {
      if (partner_return && (partner_sheet || partner_row_index)) {
        const sName = partner_sheet as string
        const rIdx = Number(partner_row_index)
        if (sName && Number.isFinite(rIdx) && rIdx > 1) {
          const { header: PH, rows: PR } = await readFromGoogleSheets(sName)
          const idxTrangThai = PH.indexOf('Trạng Thái')
          const zeroIdx = Math.max(0, rIdx - 2)
          if (idxTrangThai !== -1 && zeroIdx < PR.length) {
            PR[zeroIdx][idxTrangThai] = 'Trả về đối tác'
            await syncToGoogleSheets(sName, PR)
          }
        }
      }
    } catch (err) {
      console.warn('[RETURN] Partner mark failed:', err)
    }

    // Telegram: CHUYỂN sang chỉ gửi khi quản lý xác nhận (PATCH)

    return NextResponse.json({ ok: true, id: newId, sheet, appended: result?.success !== false, customerAdjust })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action, trang_thai, nguoi_xu_ly } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Authorization: only managers can complete
    const email = req.headers.get('x-user-email') || ''
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // check role from USERS sheet (reuse logic similar to /api/auth/me)
    try {
      const { header, rows } = await readFromGoogleSheets('USERS')
      const idxEmail = header.indexOf('Email')
      const idxRole = header.indexOf('Vai Trò')
      const userRow = rows.find(r => String(r[idxEmail]).trim().toLowerCase() === email.trim().toLowerCase())
      const role = userRow ? String(userRow[idxRole] || '') : ''
      if (role !== 'quan_ly') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Auth check failed' }, { status: 401 })
    }

    const { sheet, header, rows } = await getHoanTraSheet()
    const idx = (name: string) => header.indexOf(name)
    const idCol = idx('ID')
    if (idCol === -1) return NextResponse.json({ error: 'Sheet missing ID column' }, { status: 500 })
    const rowIndex = rows.findIndex(r => String(r[idCol] || '') === String(id))
    if (rowIndex === -1) return NextResponse.json({ error: 'Không tìm thấy yêu cầu hoàn trả' }, { status: 404 })

    const nowVN = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    const updates: Array<{ range: string; values: any[][] }> = []

    const rowNum = rowIndex + 2 // header at row 1
    const colTrangThai = idx('Trạng Thái')
    const colNgayXL = idx('Ngày Xử Lý')
    const colNguoiXL = idx('Người Xử Lý')

    const newStatus = trang_thai || (action === 'complete' ? 'Hoàn thành' : undefined)
    if (newStatus && colTrangThai !== -1) {
      updates.push({ range: `${sheet}!${toColumnLetter(colTrangThai + 1)}${rowNum}`, values: [[newStatus]] })
    }
    if (colNgayXL !== -1) {
      updates.push({ range: `${sheet}!${toColumnLetter(colNgayXL + 1)}${rowNum}`, values: [[nowVN]] })
    }
    if (nguoi_xu_ly && colNguoiXL !== -1) {
      updates.push({ range: `${sheet}!${toColumnLetter(colNguoiXL + 1)}${rowNum}`, values: [[nguoi_xu_ly]] })
    }

    for (const u of updates) {
      await updateRangeValues(u.range, u.values)
    }

    // Sau khi cập nhật trạng thái, chỉ gửi Telegram khi hoàn thành do quản lý xác nhận
    try {
      const shouldNotify = (newStatus && String(newStatus).toLowerCase().includes('hoàn thành')) || action === 'complete'
      if (shouldNotify) {
        // Lấy dữ liệu dòng để build message
        const colKhach = idx('Khách Hàng')
        const colSdt = idx('Số Điện Thoại')
        const colSp = idx('Sản Phẩm')
        const colImei = idx('IMEI')
        const colLyDo = idx('Lý Do')
        const colGhiChu = idx('Ghi Chú')
        const r = rows[rowIndex]

        // Cố gắng lấy mã đơn từ ghi chú nếu có định dạng "Mã đơn: XYZ"
        let maDon = String(r[idCol] || '')
        const note = colGhiChu !== -1 ? String(r[colGhiChu] || '') : ''
        const maMatch = note.match(/Mã\s*đơn\s*:\s*([^|]+)/i)
        if (maMatch) maDon = maMatch[1].trim()

        // Cố gắng lấy số tiền hoàn từ ghi chú: "Hoàn: 1.000.000đ"
        let soTienHoan = 0
        const hoanMatch = note.match(/Hoàn\s*:\s*([^|]+)/i)
        if (hoanMatch) soTienHoan = parseNumber(hoanMatch[1]) * -1 // âm để thể hiện hoàn

        const orderInfo = {
          ma_don_hang: maDon || String(r[idCol] || ''),
          nhan_vien_ban: nguoi_xu_ly || r[idx('Người Xử Lý')] || 'N/A',
          khach_hang: {
            ten: colKhach !== -1 ? (r[colKhach] || 'Khách lẻ') : 'Khách lẻ',
            so_dien_thoai: colSdt !== -1 ? (r[colSdt] || 'N/A') : 'N/A',
          },
          tong_tien: soTienHoan,
          phuong_thuc_thanh_toan: 'Hoàn trả',
          ngay_tao: Date.now(),
          reason: colLyDo !== -1 ? r[colLyDo] : undefined,
          products: [
            {
              ten_san_pham: colSp !== -1 ? (r[colSp] || '') : '',
              imei: colImei !== -1 ? (r[colImei] || '') : '',
              // best-effort: if Ban_Hang has Serial column, try include it
              serial: ((): string => {
                const colSerial = idx('Serial')
                return colSerial !== -1 ? (r[colSerial] || '') : ''
              })(),
            }
          ],
        }
        await sendTelegramMessage(formatOrderMessage(orderInfo, 'return'), 'return')
      }
    } catch (err) {
      console.warn('[RETURN] Telegram notify (PATCH) failed:', err)
    }

    try {
      await addNotification({
        tieu_de: "Cập nhật hoàn trả",
        noi_dung: `${id} → ${newStatus || 'cập nhật'}`,
        loai: "hoan_tra",
        nguoi_gui_id: nguoi_xu_ly || "system",
        nguoi_nhan_id: "all",
      })
    } catch (e) { console.warn('[NOTIFY] hoan-tra PATCH fail:', e) }
    return NextResponse.json({ ok: true, id, updated: updates.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
