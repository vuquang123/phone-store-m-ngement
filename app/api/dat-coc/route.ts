// API route: PATCH /api/dat-coc
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { productIds } = body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Thiếu danh sách sản phẩm" }, { status: 400 });
    }
    // Đọc dữ liệu hiện tại
    const { header, rows } = await readFromGoogleSheets("Dat_Coc");
    const idxIMEI = header.findIndex(h => h.trim().toLowerCase() === "imei");
    const idxTrangThai = header.findIndex(h => h.trim().toLowerCase() === "trạng thái");
    if (idxIMEI === -1 || idxTrangThai === -1) {
      return NextResponse.json({ error: "Không tìm thấy cột IMEI hoặc Trạng Thái" }, { status: 400 });
    }
    // Đổi trạng thái thành 'Đã hoàn thành' cho các dòng có IMEI nằm trong productIds
    const imeiSet = new Set(productIds.map(i => String(i).trim()));
    const updatedRows = rows.map(row => {
      if (imeiSet.has(String(row[idxIMEI]).trim())) {
        row[idxTrangThai] = "Đã hoàn thành";
      }
      return row;
    });
    // Ghi lại sheet: giữ header, ghi lại header + updatedRows
    const allRows = [header, ...updatedRows];
    await updateRangeValues("Dat_Coc!A1", allRows);
    return NextResponse.json({ ok: true, updated: productIds.length }, { status: 200 });
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

    // Nếu có mảng products, ghi từng dòng cho từng sản phẩm
    if (Array.isArray(products) && products.length > 0) {
      // Chỉ dòng đầu ghi tổng số tiền cọc và tổng còn lại, các dòng sau để trống
      const rows = products.map((p: any, idx: number) => [
        id_don_hang,
        ngay_dat_coc || new Date().toLocaleDateString("vi-VN"),
        ten_khach_hang || "",
        so_dien_thoai || "",
        p.ten_san_pham || "",
        p.loai_may || "",
        p.dung_luong || "",
        p.pin || "",
        p.mau_sac || "",
        p.imei || "",
        p.tinh_trang_may || "",
        idx === 0 ? (phu_kien || "") : "", // chỉ dòng đầu ghi phụ kiện
        p.gia_ban || "",
        hinh_thuc_thanh_toan || "",
        p.gia_nhap || "",
        idx === 0 ? (so_tien_coc || "") : "", // chỉ dòng đầu ghi số tiền cọc
        idx === 0 ? (so_tien_con_lai || "") : "", // chỉ dòng đầu ghi số tiền còn lại
        han_thanh_toan || "",
        nguoi_ban || "",
        loai_don || "",
        ghi_chu || "",
        "Đặt cọc" // Trạng thái
      ])
      // Ghi tất cả dòng vào sheet
      for (const row of rows) {
        await appendToGoogleSheets("Dat_Coc", row)
      }
      return NextResponse.json({ ok: true, created: true, id_don_hang }, { status: 201 })
    } else {
      // Nếu chỉ có 1 sản phẩm, ghi như cũ
      const {
        ten_san_pham,
        loai_may,
        dung_luong,
        pin,
        mau_sac,
        imei,
        tinh_trang_may,
        gia_ban: gia_ban_sp,
        gia_nhap: gia_nhap_sp
      } = body
      const row = [
        id_don_hang,
        ngay_dat_coc || new Date().toLocaleDateString("vi-VN"),
        ten_khach_hang || "",
        so_dien_thoai || "",
        ten_san_pham || "",
        loai_may || "",
        dung_luong || "",
        pin || "",
        mau_sac || "",
        imei || "",
        tinh_trang_may || "",
        phu_kien || "",
        gia_ban_sp || gia_ban || "",
        hinh_thuc_thanh_toan || "",
        gia_nhap_sp || gia_nhap || "",
        so_tien_coc || "",
        so_tien_con_lai || "",
        han_thanh_toan || "",
        nguoi_ban || "",
        loai_don || "",
        ghi_chu || ""
      ]
      await appendToGoogleSheets("Dat_Coc", row)
      return NextResponse.json({ ok: true, created: true, id_don_hang }, { status: 201 })
    }
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

