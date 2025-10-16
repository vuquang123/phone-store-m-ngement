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
    const idxIMEI = header.findIndex(h => h.trim().toLowerCase() === "imei");
    const idxTrangThai = header.findIndex(h => h.trim().toLowerCase() === "trạng thái");
    const idxMaDon = header.findIndex(h => h.trim().toLowerCase() === "mã đơn hàng" || h.trim().toLowerCase() === "id đơn hàng");
    if (idxIMEI === -1 || idxTrangThai === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột IMEI hoặc Trạng Thái" }, { status: 400 });
    }
    // Đổi trạng thái thành 'Đã hoàn thành' cho các dòng có IMEI nằm trong productIds
    const desired = String(newStatus || 'Đã hoàn thành');
    const imeiSet = new Set((productIds || []).map((i: any) => String(i).trim()));
    const updatedRows = rows.map(row => {
      const matchImei = imeiSet.size > 0 && imeiSet.has(String(row[idxIMEI]).trim());
      const matchOrder = !!orderId && (idxMaDon !== -1) && (String(row[idxMaDon] || '').trim() === String(orderId).trim());
      if (matchImei || matchOrder) {
        row[idxTrangThai] = desired;
      }
      return row;
    });
    // Ghi lại sheet: giữ header, ghi lại header + updatedRows
    const allRows = [header, ...updatedRows];
    await updateRangeValues("Dat_Coc!A1", allRows);
    return NextResponse.json({ ok: true, updated: productIds?.length || 0 }, { status: 200 });
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
    const idxIMEI = header.findIndex(h => h.trim().toLowerCase() === "imei");
    if (idxIMEI === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột IMEI" }, { status: 400 });
    }
    // Đổi trạng thái thành 'Hủy đặt cọc' cho các dòng có IMEI nằm trong productIds
    const idxTrangThai = header.findIndex(h => h.trim().toLowerCase() === "trạng thái");
    const imeiSet = new Set(productIds.map(i => String(i).trim()));
    const updatedRows = rows.map(row => {
      if (imeiSet.has(String(row[idxIMEI]).trim())) {
        if (idxTrangThai !== -1) row[idxTrangThai] = "Hủy đặt cọc";
      }
      return row;
    });
    // Ghi lại sheet: giữ header, ghi lại header + updatedRows
    const allRows = [header, ...updatedRows];
    await updateRangeValues("Dat_Coc!A1", allRows);
    return NextResponse.json({ ok: true, deleted: productIds.length }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
import { NextResponse } from "next/server"
import { appendToGoogleSheets, readFromGoogleSheets, updateRangeValues } from "@/lib/google-sheets"
import { sendTelegramMessage, formatOrderMessage } from "@/lib/telegram"

// API route: GET /api/dat-coc
export async function GET() {
  try {
    const { header, rows } = await readFromGoogleSheets("Dat_Coc")
    // Bỏ qua các dòng có trạng thái 'Hủy đặt cọc'
    const idxTrangThai = header.findIndex(h => h.trim().toLowerCase() === "trạng thái");
    const filteredRows = idxTrangThai === -1
      ? rows
      : rows.filter(row => (row[idxTrangThai] || "").trim().toLowerCase() !== "hủy đặt cọc");
    return NextResponse.json({ data: [header, ...filteredRows] }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


// API route: POST /api/dat-coc
export async function POST(req: Request) {
  try {
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
    const norm = (s: string) => (s||"")
      .normalize("NFD")
      // @ts-ignore
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim()
    const idx = (name: string) => header.findIndex(h => norm(h) === norm(name))

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

