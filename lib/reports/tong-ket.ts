// ---------------------------------------------------------------------------
// Tổng hợp hoạt động một ngày / một ca — NGUỒN SỰ THẬT DUY NHẤT.
//
// Dùng chung bởi:
//   - /api/nhan-vien/tong-ket-ca  (trang /nhanvien/dashboard)
//   - /api/cron/bao-cao-ngay      (báo cáo Telegram 22h hằng ngày)
//
// Cố ý gom về một chỗ: nếu mỗi nơi tự tính, con số trên dashboard và con số
// trong tin Telegram sẽ lệch nhau, và lúc đó không ai tin bên nào nữa.
// ---------------------------------------------------------------------------

import { DateTime } from "luxon"
import { readFromGoogleSheets, colIndex } from "@/lib/google-sheets"
import { sumByMethod, parseMoney as num } from "@/lib/utils/payment"
import { normalizeStatus, isConHangStatus, isDangCncStatus } from "@/lib/utils/inventory-helpers"
import {
  GIO_BAN_COL,
  SHIFTS,
  TIMEZONE,
  bucketOf,
  combineDateAndTime,
  inShift,
  parseSheetDateTime,
  parseVNDate,
  type ShiftDef,
  type ShiftBucket,
} from "@/lib/shift"

// Nhãn hiển thị chuẩn cho từng trạng thái (khoá = chuỗi đã chuẩn hoá).
const NHAN_TRANG_THAI: Record<string, string> = {
  conhang: "Còn hàng",
  dangcnc: "Đang CNC",
  daban: "Đã bán",
  baohanh: "Bảo hành",
  giaodoitac: "Giao đối tác",
  dadatcoc: "Đã đặt cọc",
}

type Row = any[]

function cell(row: Row, idx: number) {
  return idx === -1 ? "" : String(row[idx] ?? "").trim()
}

/** Đơn online đã bàn giao cho đơn vị vận chuyển chưa. */
function daGui(vanChuyen: string) {
  return /đã gửi/i.test(vanChuyen)
}

/** Tổng hợp một ngày (hoặc một ca trong ngày). */
export async function buildSummary(day: DateTime, shift: ShiftDef) {
  const sameDay = (dt: DateTime | null) => !!dt && dt.hasSame(day, "day")

  const [banHang, tienMat, datCoc, hoanTra, ghiChu, thongBao, khoHang] = await Promise.all([
    readFromGoogleSheets("Ban_Hang"),
    readFromGoogleSheets("Tien_mat").catch(() => ({ header: [], rows: [] })),
    readFromGoogleSheets("Dat_Coc").catch(() => ({ header: [], rows: [] })),
    readFromGoogleSheets("Hoan_Tra").catch(() => ({ header: [], rows: [] })),
    readFromGoogleSheets("Ghi_chu").catch(() => ({ header: [], rows: [] })),
    readFromGoogleSheets("Thong_Bao").catch(() => ({ header: [], rows: [] })),
    readFromGoogleSheets("Kho_Hang").catch(() => ({ header: [], rows: [] })),
  ])

  // Giờ tạo đơn CŨ: sheet Ban_Hang không lưu giờ, nhưng mỗi đơn đều sinh một
  // thông báo "Đơn hàng mới DHxxxxx" có Created At đầy đủ. Dùng làm nguồn dự
  // phòng cho đơn tạo trước khi cột "Giờ bán" ra đời — đo trên dữ liệu thật:
  // phủ 100% đơn trong 30 ngày gần nhất.
  const notifyTime = new Map<string, DateTime>()
  {
    const tbTitle = colIndex(thongBao.header, "Tiêu Đề")
    const tbCreated = colIndex(thongBao.header, "Created At")
    for (const r of thongBao.rows) {
      const m = cell(r, tbTitle).match(/^Đơn hàng mới\s+(DH\d+)/i)
      if (!m) continue
      const at = parseSheetDateTime(cell(r, tbCreated))
      if (!at) continue
      const cur = notifyTime.get(m[1])
      // Đơn có thể bắn thông báo nhiều lần -> lấy lần SỚM NHẤT (lúc tạo).
      if (!cur || at < cur) notifyTime.set(m[1], at)
    }
  }

  // ----- 1 & 2. Đơn hàng trong ngày ---------------------------------------
  const B = banHang.header
  const bi = {
    ma: colIndex(B, "Mã đơn hàng", "Mã Đơn Hàng", "ID Đơn Hàng"),
    ngay: colIndex(B, "Ngày bán", "Ngày Bán"),
    gio: colIndex(B, GIO_BAN_COL),
    khach: colIndex(B, "Tên Khách Hàng"),
    sdt: colIndex(B, "Số Điện Thoại"),
    sanPham: colIndex(B, "Tên Sản Phẩm"),
    imei: colIndex(B, "IMEI"),
    serial: colIndex(B, "Serial"),
    tongThu: colIndex(B, "Tổng Thu"),
    lai: colIndex(B, "Lãi"),
    thanhToan: colIndex(B, "Hình Thức Thanh Toán"),
    nguoiBan: colIndex(B, "Người Bán"),
    loaiDon: colIndex(B, "Loại Đơn"),
    vanChuyen: colIndex(B, "Hình Thức Vận Chuyển"),
    trangThai: colIndex(B, "Trạng Thái"),
    diaChi: colIndex(B, "Địa Chỉ Nhận"),
  }

  // Một đơn trải trên nhiều dòng (mỗi máy một dòng) -> gom theo mã đơn.
  type Order = {
    ma: string
    at: DateTime | null
    bucket: ShiftBucket
    khach: string
    sdt: string
    sanPham: string[]
    tongThu: number
    lai: number
    thanhToan: string
    nguoiBan: string
    loaiDon: string
    vanChuyen: string
    trangThai: string
    diaChi: string
  }
  const orders = new Map<string, Order>()
  for (const r of banHang.rows) {
    const ngay = cell(r, bi.ngay)
    const d = parseVNDate(ngay)
    if (!sameDay(d)) continue
    const ma = cell(r, bi.ma) || `(không mã) ${ngay}`
    let o = orders.get(ma)
    if (!o) {
      // Ưu tiên cột "Giờ bán" (đơn mới). Thiếu thì lấy GIỜ TRONG NGÀY từ
      // thông báo, nhưng vẫn giữ NGÀY của sheet: 3/630 đơn có ngày thông báo
      // lệch ngày bán (tạo quanh nửa đêm) — lấy nguyên mốc thông báo sẽ đẩy
      // đơn nhảy sang ngày khác, làm lệch tổng kết của cả hai ngày.
      const fromNotify = notifyTime.get(ma)
      const at =
        combineDateAndTime(ngay, cell(r, bi.gio)) ??
        (fromNotify ? combineDateAndTime(ngay, fromNotify.toFormat("HH:mm:ss")) : null)
      o = {
        ma,
        at,
        bucket: bucketOf(at),
        khach: cell(r, bi.khach),
        sdt: cell(r, bi.sdt),
        sanPham: [],
        tongThu: 0,
        lai: 0,
        thanhToan: cell(r, bi.thanhToan),
        nguoiBan: cell(r, bi.nguoiBan),
        loaiDon: cell(r, bi.loaiDon),
        vanChuyen: cell(r, bi.vanChuyen),
        trangThai: cell(r, bi.trangThai),
        diaChi: cell(r, bi.diaChi),
      }
      orders.set(ma, o)
    }
    const ten = cell(r, bi.sanPham)
    if (ten) o.sanPham.push(ten)
    o.tongThu += num(cell(r, bi.tongThu))
    o.lai += num(cell(r, bi.lai))
    if (!o.thanhToan) o.thanhToan = cell(r, bi.thanhToan)
    if (!o.vanChuyen) o.vanChuyen = cell(r, bi.vanChuyen)
  }

  const allOrders = [...orders.values()]
  // "Cả ngày" lấy luôn cả đơn ngoài 9h–21h và đơn chưa ghi giờ, vì mục đích là
  // tổng kết NGÀY — bỏ sót đơn nào thì tiền không khớp sheet nữa.
  const pickedOrders =
    shift.key === "all"
      ? allOrders
      : allOrders.filter((o) => inShift(o.at, shift))

  const isHoanTraRow = (o: Order) =>
    /hoàn trả/i.test(o.trangThai) || /hoàn trả/i.test(o.loaiDon)

  const banRa = pickedOrders.filter((o) => !isHoanTraRow(o))
  const theoPhuongThuc: Record<string, number> = {}
  for (const o of banRa) {
    for (const [k, v] of Object.entries(sumByMethod(o.thanhToan))) {
      theoPhuongThuc[k] = (theoPhuongThuc[k] || 0) + v
    }
  }

  // Đếm đơn theo từng ca cho thanh tóm tắt phía trên.
  const theoCa: Record<string, { soDon: number; doanhThu: number }> = {}
  for (const o of allOrders.filter((x) => !isHoanTraRow(x))) {
    const k = o.bucket
    theoCa[k] = theoCa[k] || { soDon: 0, doanhThu: 0 }
    theoCa[k].soDon += 1
    theoCa[k].doanhThu += o.tongThu
  }

  // ----- Quỹ tiền mặt (Tien_mat có mốc thời gian đầy đủ) -------------------
  const T = tienMat.header
  const ti = {
    loai: colIndex(T, "Loại"),
    soTien: colIndex(T, "Số Tiền"),
    lyDo: colIndex(T, "Lý Do"),
    nhanVien: colIndex(T, "Nhân Viên"),
    createdAt: colIndex(T, "Created At"),
    soDuSau: colIndex(T, "Số Dư Sau"),
  }
  const tienMatRows = tienMat.rows
    .map((r) => ({ at: parseSheetDateTime(cell(r, ti.createdAt)), r }))
    .filter((x) => sameDay(x.at))
  const tienMatTrongCa = tienMatRows.filter(
    (x) => shift.key === "all" || inShift(x.at, shift),
  )
  let quyThu = 0
  let quyChi = 0
  const giaoDichTienMat = tienMatTrongCa.map(({ at, r }) => {
    const loai = cell(r, ti.loai).toLowerCase()
    const soTien = num(cell(r, ti.soTien))
    if (loai === "thu") quyThu += soTien
    else if (loai === "chi") quyChi += soTien
    return {
      gio: at ? at.toFormat("HH:mm") : "",
      loai,
      so_tien: soTien,
      ly_do: cell(r, ti.lyDo),
      nhan_vien: cell(r, ti.nhanVien),
    }
  })
  // Số dư quỹ mới nhất trong ngày (dòng cuối cùng của sheet trong ngày đó).
  const soDuCuoi = tienMatRows.length
    ? num(cell(tienMatRows[tienMatRows.length - 1].r, ti.soDuSau))
    : null

  // ----- 3. Việc còn tồn ---------------------------------------------------
  // Cố ý KHÔNG lọc theo ca: việc tồn là việc tồn, ca nào nhận cũng phải thấy.
  const donOnlineChuaGui = allOrders
    .filter((o) => /onl/i.test(o.loaiDon) && !daGui(o.vanChuyen) && !isHoanTraRow(o))
    .map((o) => ({
      ma: o.ma,
      khach: o.khach,
      sdt: o.sdt,
      san_pham: o.sanPham.join(", "),
      van_chuyen: o.vanChuyen || "(chưa chọn)",
      dia_chi: o.diaChi,
      tong_thu: o.tongThu,
    }))

  const D = datCoc.header
  const di = {
    ma: colIndex(D, "ID Đơn Hàng"),
    ngay: colIndex(D, "Ngày Đặt Cọc"),
    khach: colIndex(D, "Tên Khách Hàng"),
    sdt: colIndex(D, "Số Điện Thoại"),
    sanPham: colIndex(D, "Tên Sản Phẩm"),
    conLai: colIndex(D, "Số Tiền Còn Lại"),
    han: colIndex(D, "Hạn Thanh Toán"),
    trangThai: colIndex(D, "Trạng Thái"),
  }
  const cocChuaTatToan = datCoc.rows
    .filter((r) => /đặt cọc/i.test(cell(r, di.trangThai)))
    .map((r) => {
      const han = cell(r, di.han)
      const hanDt = DateTime.fromISO(han, { zone: TIMEZONE })
      return {
        ma: cell(r, di.ma),
        khach: cell(r, di.khach),
        sdt: cell(r, di.sdt),
        san_pham: cell(r, di.sanPham),
        con_lai: num(cell(r, di.conLai)),
        han_thanh_toan: han,
        qua_han: hanDt.isValid ? hanDt.startOf("day") < day : false,
      }
    })

  const H = hoanTra.header
  const hi = {
    id: colIndex(H, "ID"),
    ngay: colIndex(H, "Ngày Yêu Cầu"),
    khach: colIndex(H, "Khách Hàng"),
    sdt: colIndex(H, "Số Điện Thoại"),
    sanPham: colIndex(H, "Sản Phẩm"),
    lyDo: colIndex(H, "Lý Do"),
    trangThai: colIndex(H, "Trạng Thái"),
  }
  const hoanTraChoXuLy = hoanTra.rows
    .filter((r) => {
      const tt = cell(r, hi.trangThai).toLowerCase()
      return tt && !/hoàn thành|đã xử lý|từ chối|huỷ|hủy/i.test(tt)
    })
    .map((r) => ({
      id: cell(r, hi.id),
      ngay: cell(r, hi.ngay),
      khach: cell(r, hi.khach),
      sdt: cell(r, hi.sdt),
      san_pham: cell(r, hi.sanPham),
      ly_do: cell(r, hi.lyDo),
      trang_thai: cell(r, hi.trangThai),
    }))

  const G = ghiChu.header
  const gi = {
    noiDung: colIndex(G, "Nội Dung"),
    nguoiTao: colIndex(G, "Người Tạo"),
    trangThai: colIndex(G, "Trạng Thái"),
    createdAt: colIndex(G, "Created At"),
  }
  const ghiChuChuaXong = ghiChu.rows
    .filter((r) => cell(r, gi.trangThai) !== "hoan_thanh")
    .map((r) => {
      const at = parseSheetDateTime(cell(r, gi.createdAt))
      return {
        noi_dung: cell(r, gi.noiDung),
        nguoi_tao: cell(r, gi.nguoiTao),
        tao_luc: at ? at.toFormat("HH:mm dd/MM") : "",
      }
    })

  // ----- Tồn kho (ảnh chụp HIỆN TẠI, không theo ngày) ---------------------
  // Sheet không lưu lịch sử tồn nên không thể dựng lại tồn của một ngày quá
  // khứ. Báo cáo 22h chạy trong ngày nên con số này đúng với lúc gửi.
  const K = khoHang.header
  const ki = {
    trangThai: colIndex(K, "Trạng Thái"),
    trangThaiKho: colIndex(K, "Trạng Thái Kho"),
    giaNhap: colIndex(K, "Giá nhập", "Giá Nhập"),
    giaBan: colIndex(K, "Giá Bán"),
    ten: colIndex(K, "Tên Sản Phẩm"),
    imei: colIndex(K, "IMEI"),
    serial: colIndex(K, "Serial"),
    id: colIndex(K, "ID Máy"),
  }
  const tonTheoTrangThai: Record<string, number> = {}
  const tonTheoKho: Record<string, number> = {}
  let tonSoMay = 0
  let tonVon = 0
  let tonGiaBan = 0
  let chuaRoTrangThai = 0
  for (const r of khoHang.rows) {
    // Bỏ dòng trắng ở cuối sheet (không tên, không IMEI/Serial, không ID).
    const coDuLieu = !!(
      cell(r, ki.ten) || cell(r, ki.imei) || cell(r, ki.serial) || cell(r, ki.id)
    )
    if (!coDuLieu) continue

    const ttRaw = cell(r, ki.trangThai)
    if (!ttRaw) {
      // Máy có thật nhưng chưa điền Trạng Thái -> không lọt vào nhóm nào.
      // Đếm riêng và báo ra, đừng im lặng bỏ qua: đây là hàng trong kho.
      chuaRoTrangThai++
      continue
    }
    // Gộp theo trạng thái đã chuẩn hoá: sheet gõ tay nên có cả "Còn hàng" lẫn
    // "Còn Hàng" — để nguyên thì một trạng thái bị tách thành hai dòng báo cáo.
    const key = normalizeStatus(ttRaw)
    const nhan = NHAN_TRANG_THAI[key] || ttRaw
    tonTheoTrangThai[nhan] = (tonTheoTrangThai[nhan] || 0) + 1

    if (!isConHangStatus(ttRaw) && !isDangCncStatus(ttRaw)) continue
    tonSoMay++
    tonVon += num(cell(r, ki.giaNhap))
    tonGiaBan += num(cell(r, ki.giaBan))
    const kho = cell(r, ki.trangThaiKho) || "(chưa rõ)"
    tonTheoKho[kho] = (tonTheoKho[kho] || 0) + 1
  }

  return {
    ngay: day.toISODate(),
    ca: shift.key,
    ca_label: SHIFTS.find((s) => s.key === shift.key)?.label || "",
    ban_hang: {
      so_don: banRa.length,
      doanh_thu: banRa.reduce((s, o) => s + o.tongThu, 0),
      lai: banRa.reduce((s, o) => s + o.lai, 0),
      so_may: banRa.reduce((s, o) => s + o.sanPham.length, 0),
      theo_phuong_thuc: theoPhuongThuc,
      don_hang: banRa
        .slice()
        .sort((a, b) => (a.at?.toMillis() || 0) - (b.at?.toMillis() || 0))
        .map((o) => ({
          ma: o.ma,
          gio: o.at ? o.at.toFormat("HH:mm") : "",
          bucket: o.bucket,
          khach: o.khach,
          sdt: o.sdt,
          san_pham: o.sanPham.join(", "),
          tong_thu: o.tongThu,
          lai: o.lai,
          thanh_toan: o.thanhToan,
          nguoi_ban: o.nguoiBan,
          loai_don: o.loaiDon,
        })),
    },
    ton_kho: {
      so_may: tonSoMay,
      von: tonVon,
      gia_ban: tonGiaBan,
      theo_trang_thai: tonTheoTrangThai,
      theo_kho: tonTheoKho,
      chua_ro_trang_thai: chuaRoTrangThai,
    },
    theo_ca: theoCa,
    quy_tien_mat: {
      thu: quyThu,
      chi: quyChi,
      so_du_cuoi: soDuCuoi,
      giao_dich: giaoDichTienMat,
    },
    can_xu_ly: {
      don_online_chua_gui: donOnlineChuaGui,
      coc_chua_tat_toan: cocChuaTatToan,
      hoan_tra_cho_xu_ly: hoanTraChoXuLy,
      ghi_chu_chua_xong: ghiChuChuaXong,
    },
    // Cảnh báo cho FE: còn bao nhiêu đơn trong ngày chưa có giờ nên không
    // xếp được vào ca.
    canh_bao: {
      don_chua_ghi_gio: allOrders.filter((o) => o.bucket === "unknown").length,
      don_ngoai_gio: allOrders.filter((o) => o.bucket === "ngoai_ca").length,
    },
  }
}

export type Summary = Awaited<ReturnType<typeof buildSummary>>
