import { NextResponse } from "next/server";
import { updateProductsStatus, logProductHistory, readFromGoogleSheets, updateRowInGoogleSheets } from "@/lib/google-sheets";

export async function POST(req: Request) {
  try {
    const { productIds, employeeId } = await req.json();
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu danh sách sản phẩm" }, { status: 400 });
    }
    // Đọc dữ liệu sheet CNC
    const { header: cncHeader, rows: cncRows } = await readFromGoogleSheets("CNC")
    const idxIMEI = cncHeader.indexOf("IMEI")
    const idxIdMay = cncHeader.indexOf("ID Máy")
    const idxTrangThai = cncHeader.indexOf("Trạng Thái")
    const idxNgayNhanLai = cncHeader.indexOf("Ngày nhận lại")
    if (idxIMEI === -1) {
      return NextResponse.json({ success: false, error: "Sheet CNC thiếu cột IMEI" }, { status: 500 })
    }
    // Chuẩn hóa: nhận cả IMEI, 5 số cuối IMEI hoặc ID Máy
    const imeisToProcess = cncRows
      .filter(row => {
        const imei = row[idxIMEI] || ""
        const idMay = idxIdMay !== -1 ? row[idxIdMay] : ""
        const imeiLast5 = imei.slice(-5)
        return productIds.includes(imei) || productIds.includes(idMay) || productIds.includes(imeiLast5)
      })
      .map(row => row[idxIMEI])
    if (imeisToProcess.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy sản phẩm cần hoàn thành CNC" }, { status: 400 });
    }
    // Chuẩn hóa: lấy 5 số cuối IMEI cho logProductHistory
    const productIds5 = imeisToProcess.map(imei => imei.slice(-5));
    // Lấy trạng thái cũ từ sheet CNC
    const trangThaiCuArr = cncRows.filter(row => imeisToProcess.includes(row[idxIMEI])).map(row => idxTrangThai !== -1 ? row[idxTrangThai] : "");

    // Cập nhật trạng thái trong sheet CNC sang 'Hoàn thành CNC' và ngày nhận lại
    let updatedCncRows = cncRows;
    if (idxTrangThai !== -1 || idxNgayNhanLai !== -1) {
      updatedCncRows = cncRows.map(row => {
        if (imeisToProcess.includes(row[idxIMEI])) {
          if (idxTrangThai !== -1) row[idxTrangThai] = "Hoàn thành CNC";
          if (idxNgayNhanLai !== -1) row[idxNgayNhanLai] = new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN");
        }
        return row;
      });
      await updateRowInGoogleSheets("CNC", "IMEI", "", updatedCncRows);
    }

    // Cập nhật trạng thái về 'Còn hàng' trong kho chỉ với máy nguồn 'Kho shop'
    const { header: khoHeader, rows: khoRows } = await readFromGoogleSheets("Kho_Hang");
    const idxKhoId = khoHeader.indexOf("ID Máy");
    const idxKhoIMEI = khoHeader.indexOf("IMEI");
    const idxKhoTrangThai = khoHeader.indexOf("Trạng Thái");
    const idxKhoGhiChu = khoHeader.indexOf("Ghi Chú");

    // Lấy nguồn từ sheet CNC
    const idxNguonCNC = cncHeader.indexOf("Nguồn");
    // Tạo danh sách IMEI máy nguồn 'Kho shop'
    const imeisKhoShop = cncRows
      .filter(row => imeisToProcess.includes(row[idxIMEI]) && row[idxNguonCNC] === "Kho shop")
      .map(row => row[idxIMEI]);

    const updatedKhoRows = khoRows.map(row => {
      // Tạo lại ID Máy từ IMEI nếu cần
      if (idxKhoIMEI !== -1 && row[idxKhoIMEI]) {
        row[idxKhoId] = row[idxKhoIMEI].slice(-5);
      }
      if (imeisKhoShop.includes(row[idxKhoIMEI])) {
        if (idxKhoTrangThai !== -1) row[idxKhoTrangThai] = "Còn hàng";
        if (idxKhoGhiChu !== -1) row[idxKhoGhiChu] = "đã CNC";
      }
      return row;
    });
    await import("@/lib/google-sheets").then(m => m.syncToGoogleSheets("Kho_Hang", updatedKhoRows));

    // Ghi lịch sử trạng thái
  await logProductHistory(productIds5, "Hoàn thành CNC", employeeId, trangThaiCuArr);
  return NextResponse.json({ success: true, message: `Đã hoàn thành CNC cho ${imeisToProcess.length} sản phẩm!` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi xử lý hoàn thành CNC" }, { status: 500 });
  }
}
