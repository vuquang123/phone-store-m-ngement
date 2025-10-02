// app/api/ban-hang/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { sendTelegramMessage, formatOrderMessage } from "@/lib/telegram"
import { readFromGoogleSheets, appendToGoogleSheets, updateRangeValues } from "@/lib/google-sheets"

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

/* =================== Sheet-specific index helpers =================== */
function idxBanHang(header: string[]) {
  return {
    idDon: colIndex(header, "ID Đơn Hàng"),
    ngayXuat: colIndex(header, "Ngày Xuất"),
    tenKH: colIndex(header, "Tên Khách Hàng"),
    sdt: colIndex(header, "Số Điện Thoại"),
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
  const nowVN = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })

  if (foundIdx === -1) {
    // Thêm KH mới
    const row = Array(header.length).fill("")
    if (K.ten !== -1) row[K.ten] = name || "Khách lẻ"
    row[K.sdt] = target
    if (K.tongMua !== -1) row[K.tongMua] = Number(amountToAdd) || 0
    if (K.lanMuaCuoi !== -1) row[K.lanMuaCuoi] = nowVN
    if (K.ngayTao !== -1) row[K.ngayTao] = nowVN    // ⬅️ ghi Ngày tạo
    await appendToGoogleSheets("Khach_Hang", row)
    return { ten: row[K.ten] || "Khách lẻ", sdt: target, tongMua: row[K.tongMua] || amountToAdd }
  } else {
    // Cập nhật KH cũ
    const rowNumber = foundIdx + 2
    // Chuẩn hoá tổng mua hiện tại (có thể đang là chuỗi định dạng: 16.000.001 đ)
    let currentTotal = 0
    if (K.tongMua !== -1) {
      const raw = rows[foundIdx][K.tongMua]
      if (typeof raw === "number") currentTotal = raw
      else if (raw) {
        const cleaned = String(raw).replace(/[^\d.-]/g, "")
        const num = Number(cleaned)
        if (Number.isFinite(num)) currentTotal = num
      }
    }
    const newTotal = currentTotal + (Number(amountToAdd) || 0)

    if (K.ten !== -1 && name && !rows[foundIdx][K.ten]) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.ten + 1)}${rowNumber}`, [[name]])
    }
    if (K.tongMua !== -1) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.tongMua + 1)}${rowNumber}`, [[newTotal]])
    }
    if (K.lanMuaCuoi !== -1) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.lanMuaCuoi + 1)}${rowNumber}`, [[nowVN]])
    }
    // Nếu ô Ngày tạo đang trống thì bổ sung
    if (K.ngayTao !== -1 && !rows[foundIdx][K.ngayTao]) {
      await updateRangeValues(`Khach_Hang!${toColumnLetter(K.ngayTao + 1)}${rowNumber}`, [[nowVN]])
    }

    return { ten: (K.ten !== -1 ? rows[foundIdx][K.ten] : "") || name || "Khách lẻ", sdt: target, tongMua: newTotal }
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
      mayList = body.products
    } else if (body.id_may) {
      mayList = [{ ...body, id_may: body.id_may }]
    } else if (normalizedAccessories.length > 0) {
      // Nếu chỉ có phụ kiện, vẫn ghi một dòng vào sheet
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

    let allResults = []
    let errorFlag = false
    for (let i = 0; i < mayList.length; i++) {
      const may = mayList[i]
      // Dòng đầu tiên: cộng phụ kiện, các dòng sau chỉ ghi máy
      let phuKien = ""
      let giaNhapPhuKien = 0
      if (i === 0 && normalizedAccessories.length > 0) {
        phuKien = normalizedAccessories.map((pk: any) => pk.ten_phu_kien || pk.ten || pk.name).join(", ")
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
      const newRow = header.map((k) => {
        if (k === "ID Đơn Hàng") return idDonHang
        if (k === "Phụ Kiện") return i === 0 ? phuKien : ""
        if (k === "Giá Nhập") {
          const rounded = Math.round(tongGiaNhap)
          return rounded > 0 ? rounded : ""
        }
        if (k === "Giá Bán") {
          // Nếu có cả máy và phụ kiện, chỉ dòng máy (imei) ghi giá, dòng phụ kiện để trống
          // Nếu chỉ có phụ kiện, ghi giá ở dòng phụ kiện
          if (hasMay) {
            if (isMayRow) {
              let thanhToan = 0;
              if (may["gia_ban"] !== undefined && may["gia_ban"] !== "") {
                thanhToan = Number(String(may["gia_ban"]).replace(/\D/g, "")) * (may["so_luong"] || 1)
              } else if (body["Thanh Toan"] !== undefined && body["Thanh Toan"] !== "") {
                thanhToan = Number(String(body["Thanh Toan"]).replace(/\D/g, ""))
              }
              return thanhToan > 0 ? thanhToan : ""
            } else {
              return ""
            }
          } else if (isOnlyPhuKien) {
            let thanhToan = 0;
            if (may["gia_ban"] !== undefined && may["gia_ban"] !== "") {
              thanhToan = Number(String(may["gia_ban"]).replace(/\D/g, "")) * (may["so_luong"] || 1)
            } else if (body["Thanh Toan"] !== undefined && body["Thanh Toan"] !== "") {
              thanhToan = Number(String(body["Thanh Toan"]).replace(/\D/g, ""))
            }
            return thanhToan > 0 ? thanhToan : ""
          } else {
            return ""
          }
        }
        if (k === "Lãi") {
          let giaBan = 0;
          if (may["gia_ban"] !== undefined && may["gia_ban"] !== "") {
            giaBan = Number(String(may["gia_ban"]).replace(/\D/g, "")) * (may["so_luong"] || 1)
          } else if (body["Thanh Toan"] !== undefined && body["Thanh Toan"] !== "") {
            giaBan = Number(String(body["Thanh Toan"]).replace(/\D/g, ""))
          }
          const lai = giaBan - Math.round(tongGiaNhap)
          return lai > 0 ? lai : 0
        }
        if (k === "Loại Đơn") {
          return body["Loại Đơn"] || body["loai_don"] || may["Loại Đơn"] || may["loai_don"] || ""
        }
        if (k === "Hình Thức Vận Chuyển") {
          return body["Hình Thức Vận Chuyển"] || body["hinh_thuc_van_chuyen"] || may["Hình Thức Vận Chuyển"] || may["hinh_thuc_van_chuyen"] || ""
        }
        if (k === "Người Bán") {
          // Ưu tiên lấy từ body['employeeId'] nếu có
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
        return may[k] || body[k] || ""
      })
      const result = await appendToGoogleSheets(SHEETS.BAN_HANG, newRow)
      allResults.push(result)
      if (!result.success) errorFlag = true
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
        let amountToAdd = 0
        const explicitTotal = body["Thanh Toan"] || body.thanh_toan || body.tong_tien || body.tongTien || body.total
        if (explicitTotal) {
          amountToAdd = toNumber(explicitTotal)
        } else {
          // Sum giá bán từng máy trong mayList (đã chuẩn hoá ở trên)
          if (Array.isArray(mayList) && mayList.length > 0) {
            for (const m of mayList) {
              if (m && m.gia_ban !== undefined) {
                const line = toNumber(m.gia_ban) * (m.so_luong ? toNumber(m.so_luong) : 1)
                amountToAdd += line
              }
            }
          }
          // Cộng giá bán phụ kiện nếu có và nếu mỗi phụ kiện có trường gia_ban
          if (normalizedAccessories.length > 0) {
            for (const pk of normalizedAccessories) {
              if (pk && pk.gia_ban !== undefined) {
                amountToAdd += toNumber(pk.gia_ban) * (pk.so_luong ? toNumber(pk.so_luong) : 1)
              }
            }
          }
        }
        // Phòng trường hợp không tính được gì: fallback giá bán dòng đầu tiên / Thanh Toan
        if (amountToAdd <= 0) {
          amountToAdd = toNumber(explicitTotal) || 0
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
      const orderInfo = {
        ma_don_hang: idDonHang,
        nhan_vien_ban: body.employeeName || body.employeeId || body.nhan_vien_ban || body.nhan_vien || body["Người Bán"] || "N/A",
        khach_hang: body.khach_hang || {
          ten: body.customerName || body.ten_khach_hang || body.ho_ten || body["Tên Khách Hàng"] || "Khách lẻ",
          so_dien_thoai: body.customerPhone || body.so_dien_thoai || body.sdt || body["Số Điện Thoại"] || "N/A"
        },
        tong_tien: body["Thanh Toan"] || body.tong_tien || body.thanh_toan || 0,
        phuong_thuc_thanh_toan: body["Phuong Thuc Thanh Toan"] || body["phuong_thuc_thanh_toan"] || body.paymentMethod || body.hinh_thuc_thanh_toan || body["Hình Thức Thanh Toán"] || "N/A",
        ngay_tao: Date.now(),
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
      await sendTelegramMessage(formatOrderMessage(orderInfo, "new"), orderType)
    } catch (err) {
      console.error("Lỗi gửi thông báo Telegram:", err)
    }

    return NextResponse.json({ ok: true, created: true, id_don_hang: idDonHang }, { status: 201 })
  } catch (error) {
    console.error("Ban_Hang POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}