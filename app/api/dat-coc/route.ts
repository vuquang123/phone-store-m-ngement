function parseAmount(value: unknown) {
  const { parseVietnameseNumber } = require("@/lib/number")
  const numeric = parseVietnameseNumber(value)
  return Number.isFinite(numeric) ? numeric : 0
}

// API route: PATCH /api/dat-coc
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { productIds, newStatus, orderId } = body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      if (!orderId) {
        return NextResponse.json({ error: "Thiếu danh sách sản phẩm hoặc orderId" }, { status: 400 });
      }
    }
    // Đọc dữ liệu hiện tại
    const { header, rows } = await readFromGoogleSheets("Dat_Coc");
    const idxIMEI = colIndex(header, "IMEI");
    const idxSerial = colIndex(header, "Serial");
    const idxTrangThai = colIndex(header, "Trạng Thái");
    const idxMaDon = colIndex(header, "Mã Đơn Hàng", "ID Đơn Hàng");
    const idxTenKhach = colIndex(header, "Tên Khách Hàng");
    const idxSoDienThoai = colIndex(header, "Số Điện Thoại");
    const idxTenSanPham = colIndex(header, "Tên Sản Phẩm");
    const idxLoaiMay = colIndex(header, "Loại Máy");
    const idxDungLuong = colIndex(header, "Dung Lượng");
    const idxMauSac = colIndex(header, "Màu Sắc");
    const idxPin = colIndex(header, "Pin (%)");
    const idxTinhTrang = colIndex(header, "Tình Trạng Máy");
    const idxDoSim = colIndex(header, "Dạng Sim", "Dạng sim", "Kiểu dạng sim");
    const idxNguoiBan = colIndex(header, "Người Bán");
    const idxLoaiDon = colIndex(header, "Loại Đơn");
    const idxSoTienCoc = colIndex(header, "Số Tiền Cọc");
    const idxSoTienConLai = colIndex(header, "Số Tiền Còn Lại", "Còn Lại");
    const idxHanThanhToan = colIndex(header, "Hạn Thanh Toán");
    const idxGhiChu = colIndex(header, "Ghi Chú");
    
    if (idxIMEI === -1 || idxTrangThai === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột IMEI hoặc Trạng Thái" }, { status: 400 });
    }

    // Dat_Coc chỉ giữ các dòng đang ở trạng thái "Đặt cọc".
    // Khi hủy cọc hoặc thanh toán đủ, xóa luôn khỏi sheet này.
    const desired = String(newStatus || 'Đã hoàn thành');
    const imeiSet = new Set((productIds || []).map((i: any) => String(i).trim()));
    const matchedRows = rows.filter((row) => {
      const matchImei = imeiSet.size > 0 && imeiSet.has(String(row[idxIMEI]).trim());
      const matchOrder = !!orderId && (idxMaDon !== -1) && (String(row[idxMaDon] || '').trim() === String(orderId).trim());
      return matchImei || matchOrder;
    });
    const shouldKeepMatched = isActiveDepositStatus(desired)
    const nextRows = rows
      .map((row) => {
        const matchImei = imeiSet.size > 0 && imeiSet.has(String(row[idxIMEI]).trim());
        const matchOrder = !!orderId && (idxMaDon !== -1) && (String(row[idxMaDon] || '').trim() === String(orderId).trim());
        if (matchImei || matchOrder) {
          if (shouldKeepMatched) {
            row[idxTrangThai] = "Đặt cọc";
            return row;
          }
          return null
        }
        return isActiveDepositStatus(row[idxTrangThai]) ? row : null
      })
      .filter(Boolean) as any[][]
    await updateRangeValues("Dat_Coc!A1", [header, ...nextRows]);

    if (matchedRows.length > 0 && desired.toLowerCase() === "hủy đặt cọc") {
      try {
        const orderInfo: any = {
          ma_don_hang: (idxMaDon !== -1 ? matchedRows[0]?.[idxMaDon] : "") || orderId || "(chưa có)",
          nhan_vien_ban: idxNguoiBan !== -1 ? matchedRows[0]?.[idxNguoiBan] || "N/A" : "N/A",
          khach_hang: {
            ten: idxTenKhach !== -1 ? matchedRows[0]?.[idxTenKhach] || "Khách lẻ" : "Khách lẻ",
            so_dien_thoai: idxSoDienThoai !== -1 ? matchedRows[0]?.[idxSoDienThoai] || "" : "",
          },
          loai_don: idxLoaiDon !== -1 ? matchedRows[0]?.[idxLoaiDon] || "" : "",
          han_thanh_toan: idxHanThanhToan !== -1 ? matchedRows[0]?.[idxHanThanhToan] || "" : "",
          ghi_chu: idxGhiChu !== -1 ? matchedRows[0]?.[idxGhiChu] || "" : "",
          so_tien_coc: idxSoTienCoc !== -1 ? parseAmount(matchedRows[0]?.[idxSoTienCoc]) : 0,
          so_tien_con_lai: idxSoTienConLai !== -1 ? parseAmount(matchedRows[0]?.[idxSoTienConLai]) : 0,
          products: matchedRows.map((row) => ({
            ten_san_pham: idxTenSanPham !== -1 ? row[idxTenSanPham] : "",
            loai_may: idxLoaiMay !== -1 ? row[idxLoaiMay] : "",
            dung_luong: idxDungLuong !== -1 ? row[idxDungLuong] : "",
            mau_sac: idxMauSac !== -1 ? row[idxMauSac] : "",
            pin: idxPin !== -1 ? row[idxPin] : "",
            tinh_trang: idxTinhTrang !== -1 ? row[idxTinhTrang] : "",
            do_sim: idxDoSim !== -1 ? row[idxDoSim] : "",
            imei: idxIMEI !== -1 ? row[idxIMEI] : "",
            serial: idxSerial !== -1 ? row[idxSerial] : "",
          })),
          reason: "Hủy đặt cọc",
          ngay_tao: Date.now(),
        };
        await sendTelegramMessage(formatOrderMessage(orderInfo, "return"), "deposit", { message_thread_id: 5747 });
      } catch (telegramError) {
        console.warn("[TELE] Không thể gửi thông báo hủy đặt cọc:", telegramError);
      }
    }

    return NextResponse.json({ ok: true, updated: matchedRows.length || 0, removed: shouldKeepMatched ? 0 : matchedRows.length }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
// API route: DELETE /api/dat-coc
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { productIds } = body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Thiếu danh sách sản phẩm" }, { status: 400 });
    }
    // Đọc dữ liệu hiện tại
    const { header, rows } = await readFromGoogleSheets("Dat_Coc");
    const idxIMEI = colIndex(header, "IMEI");
    if (idxIMEI === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột IMEI" }, { status: 400 });
    }
    const idxTrangThai = colIndex(header, "Trạng Thái");
    const idxTrangThaiMay = colIndex(header, "Trạng Thái Máy", "Tình Trạng Máy");

    const imeiSet = new Set(productIds.map(i => String(i).trim()));
    // Lưu trạng thái máy hiện tại từ Dat_Coc
    const imeiToStatus: Record<string, string> = {};
    rows.forEach(row => {
      const imei = String(row[idxIMEI]).trim();
      if (imeiSet.has(imei) && idxTrangThaiMay !== -1) {
        imeiToStatus[imei] = row[idxTrangThaiMay] || "Còn hàng";
      }
    });
    const nextRows = rows.filter((row) => !imeiSet.has(String(row[idxIMEI]).trim()) && (idxTrangThai === -1 || isActiveDepositStatus(row[idxTrangThai])))
    await updateRangeValues("Dat_Coc!A1", [header, ...nextRows]);

    // --- Cập nhật trạng thái máy về kho ---
    // Đọc sheet Kho_Hang
    const { header: khoHeader, rows: khoRows } = await readFromGoogleSheets("Kho_Hang");
    const idxKhoIMEI = colIndex(khoHeader, "IMEI");
    const idxKhoTrangThai = colIndex(khoHeader, "Trạng Thái");
    if (idxKhoIMEI !== -1 && idxKhoTrangThai !== -1) {

      const updatedKhoRows = khoRows.map(row => {
        const imei = String(row[idxKhoIMEI]).trim();
        if (imeiSet.has(imei) && imeiToStatus[imei]) {
          row[idxKhoTrangThai] = imeiToStatus[imei];
        }
        return row;
      });
      await updateRangeValues("Kho_Hang!A1", [khoHeader, ...updatedKhoRows]);
    }

    return NextResponse.json({ ok: true, deleted: productIds.length }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
import { NextResponse } from "next/server"
import { appendToGoogleSheets, readFromGoogleSheets, updateRangeValues, colIndex, norm } from "@/lib/google-sheets"
import { sendTelegramMessage, formatOrderMessage } from "@/lib/telegram"

function isActiveDepositStatus(value: unknown) {
  const raw = String(value || "")
    .normalize("NFD")
    // @ts-ignore
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .trim()
  return raw === "dat_coc"
}

async function compactDatCocSheet() {
  const { header, rows } = await readFromGoogleSheets("Dat_Coc")
  const idxTrangThai = colIndex(header, "Trạng Thái")
  if (idxTrangThai === -1) return { header, rows }
  const activeRows = rows.filter((row) => isActiveDepositStatus(row[idxTrangThai]))
  if (activeRows.length !== rows.length) {
    await updateRangeValues("Dat_Coc!A1", [header, ...activeRows])
  }
  return { header, rows: activeRows }
}


// API route: GET /api/dat-coc
export async function GET() {
  try {
    const { header, rows } = await compactDatCocSheet()
    return NextResponse.json({ data: [header, ...rows] }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


// API route: POST /api/dat-coc
export async function POST(req: Request) {
  try {
    await compactDatCocSheet()
    const body = await req.json()
    // Nếu truyền vào là nhiều sản phẩm, ghi nhiều dòng
    const {
      ten_khach_hang,
      so_dien_thoai,
      products,
      phu_kien,
      gia_ban,
      hinh_thuc_thanh_toan,
      gia_nhap,
      so_tien_coc,
      so_tien_con_lai,
      han_thanh_toan,
      nguoi_ban,
      loai_don,
      ngay_dat_coc,
      ghi_chu
    } = body

    // Tạo id đơn hàng chung cho tất cả sản phẩm
    const id_don_hang = body.id_don_hang || `DC${Date.now()}`

    // Đọc header để map động theo tên cột (tránh lệch khi thêm 'Serial' hoặc cột khác)
    const { header } = await readFromGoogleSheets("Dat_Coc")
    
    // Sử dụng colIndex và norm từ lib/google-sheets
    const idx = (name: string) => colIndex(header, name)

    const setField = (row: any[], name: string, value: any) => {
      const i = idx(name)
      if (i !== -1) row[i] = value ?? ""
    }


    const buildRow = (p: any, idxLine: number) => {
      const row = Array(header.length).fill("")
      setField(row, "ID Đơn Hàng", id_don_hang)
      setField(row, "Mã Đơn Hàng", id_don_hang) // fallback nếu dùng tiêu đề này
      setField(row, "Ngày Đặt Cọc", ngay_dat_coc || new Date().toLocaleDateString("vi-VN"))
      setField(row, "Tên Khách Hàng", ten_khach_hang || "")
      setField(row, "Số Điện Thoại", so_dien_thoai || "")
      setField(row, "Tên Sản Phẩm", p.ten_san_pham || body.ten_san_pham || "")
      setField(row, "Loại Máy", p.loai_may || body.loai_may || "")
      setField(row, "Dung Lượng", p.dung_luong || body.dung_luong || "")
      setField(row, "Pin (%)", p.pin || body.pin || "")
      setField(row, "Màu Sắc", p.mau_sac || body.mau_sac || "")
      setField(row, "Dạng Sim", p.do_sim || body.do_sim || "")
      setField(row, "IMEI", p.imei || body.imei || "")
      setField(row, "Serial", (p.serial || body.serial || "").toString().toUpperCase())
      setField(row, "Tình Trạng Máy", p.tinh_trang_may || body.tinh_trang_may || "")
      if (idxLine === 0) setField(row, "Phụ Kiện", phu_kien || "")
      setField(row, "Giá Bán", p.gia_ban ?? body.gia_ban ?? "")
      setField(row, "Hình Thức Thanh Toán", hinh_thuc_thanh_toan || "")
      setField(row, "Giá Nhập", p.gia_nhap ?? body.gia_nhap ?? "")
      if (idxLine === 0) setField(row, "Số Tiền Cọc", so_tien_coc || "")
      if (idxLine === 0) setField(row, "Số Tiền Còn Lại", so_tien_con_lai || "")
      setField(row, "Hạn Thanh Toán", han_thanh_toan || "")
      setField(row, "Người Bán", nguoi_ban || "")
      setField(row, "Loại Đơn", loai_don || "")
      setField(row, "Ghi Chú", ghi_chu || "")
      setField(row, "Trạng Thái", "Đặt cọc")
      return row
    }

    if (Array.isArray(products) && products.length > 0) {
      let lineNo = 0
      for (const p of products) {
        const row = buildRow(p, lineNo)
        await appendToGoogleSheets("Dat_Coc", row)
        lineNo++
      }
      try {
        const orderInfo: any = {
          ma_don_hang: id_don_hang,
          nhan_vien_ban: nguoi_ban || "N/A",
          khach_hang: {
            ten: ten_khach_hang || "Khách lẻ",
            so_dien_thoai: so_dien_thoai || "",
            dia_chi: body.dia_chi_nhan || body["Địa Chỉ Nhận"] || undefined
          },
          ghi_chu: ghi_chu || body.ghi_chu || body["Ghi Chú"] || '',
          products: (products || []).map((m: any) => ({
            ten_san_pham: m.ten_san_pham,
            loai_may: m.loai_may,
            dung_luong: m.dung_luong,
            mau_sac: m.mau_sac,
            pin: m.pin,
            tinh_trang: m.tinh_trang_may || m.tinh_trang,
            do_sim: m.do_sim,
            imei: m.imei,
            serial: m.serial
          })),
          accessories: [],
          payments: Array.isArray(body.payments) ? body.payments : [],
          phuong_thuc_thanh_toan: hinh_thuc_thanh_toan || "",
          final_total: (Number(so_tien_coc) || 0) + (Number(so_tien_con_lai) || 0),
          tong_tien: (Number(so_tien_coc) || 0) + (Number(so_tien_con_lai) || 0),
          so_tien_coc: Number(so_tien_coc) || 0,
          so_tien_con_lai: Number(so_tien_con_lai) || 0,
          hinh_thuc_van_chuyen: body.hinh_thuc_van_chuyen || "",
          ngay_tao: Date.now(),
          order_type: /onl|online/i.test(String(body.loai_don_ban || loai_don || '')) ? 'online' : 'offline'
        }
  await sendTelegramMessage(formatOrderMessage(orderInfo, "new"), orderInfo.order_type, { message_thread_id: 5747 })
      } catch (e) {
        console.warn("[TELE] Không thể gửi thông báo đặt cọc:", e)
      }
      return NextResponse.json({ ok: true, created: true, id_don_hang }, { status: 201 })
    } else {
      const row = buildRow(body, 0)
      await appendToGoogleSheets("Dat_Coc", row)
      try {
        const orderInfo: any = {
          ma_don_hang: id_don_hang,
          nhan_vien_ban: nguoi_ban || "N/A",
          khach_hang: {
            ten: ten_khach_hang || "Khách lẻ",
            so_dien_thoai: so_dien_thoai || "",
            dia_chi: body.dia_chi_nhan || body["Địa Chỉ Nhận"] || undefined
          },
          ghi_chu: ghi_chu || body.ghi_chu || body["Ghi Chú"] || '',
          products: [{
            ten_san_pham: body.ten_san_pham,
            loai_may: body.loai_may,
            dung_luong: body.dung_luong,
            mau_sac: body.mau_sac,
            pin: body.pin,
            tinh_trang: body.tinh_trang_may || body.tinh_trang,
            do_sim: body.do_sim,
            imei: body.imei,
            serial: body.serial
          }],
          accessories: [],
          payments: Array.isArray(body.payments) ? body.payments : [],
          phuong_thuc_thanh_toan: hinh_thuc_thanh_toan || "",
          final_total: (Number(so_tien_coc) || 0) + (Number(so_tien_con_lai) || 0),
          tong_tien: (Number(so_tien_coc) || 0) + (Number(so_tien_con_lai) || 0),
          so_tien_coc: Number(so_tien_coc) || 0,
          so_tien_con_lai: Number(so_tien_con_lai) || 0,
          hinh_thuc_van_chuyen: body.hinh_thuc_van_chuyen || "",
          ngay_tao: Date.now(),
          order_type: /onl|online/i.test(String(body.loai_don_ban || loai_don || '')) ? 'online' : 'offline'
        }
  await sendTelegramMessage(formatOrderMessage(orderInfo, "new"), orderInfo.order_type, { message_thread_id: 5747 })
      } catch (e) {
        console.warn("[TELE] Không thể gửi thông báo đặt cọc:", e)
      }
      return NextResponse.json({ ok: true, created: true, id_don_hang }, { status: 201 })
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
