import { NextResponse } from "next/server";
import { updateProductsStatus, logProductHistory, readFromGoogleSheets, updateRowInGoogleSheets, updateRangeValues, colIndex } from "@/lib/google-sheets";

import { addNotification } from "@/lib/notifications";
import { sendStockEventNotification } from "@/lib/telegram";

export async function POST(req: Request) {
  try {
    const { productIds, employeeId } = await req.json();
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu danh sách sản phẩm" }, { status: 400 });
    }
    // Đọc dữ liệu sheet CNC
    const { header: cncHeader, rows: cncRows } = await readFromGoogleSheets("CNC")
    const idxIMEI = colIndex(cncHeader, "IMEI")
    const idxIdMay = colIndex(cncHeader, "ID Máy")
    const idxTen = colIndex(cncHeader, "Tên Sản Phẩm", "Tên máy", "Sản phẩm", "Model")
    const idxSerial = colIndex(cncHeader, "Serial", "Số sê-ri")
    const idxTrangThai = colIndex(cncHeader, "Trạng Thái")
    const idxNgayNhanLai = colIndex(cncHeader, "Ngày nhận lại")

    if (idxIMEI === -1) {
      return NextResponse.json({ success: false, error: "Sheet CNC thiếu cột IMEI" }, { status: 500 })
    }
    // Chuẩn hóa: nhận cả IMEI, 5 số cuối IMEI hoặc ID Máy
    const imeisToProcess = cncRows
      .filter(row => {
        const imei = row[idxIMEI] || ""
        const idMay = idxIdMay !== -1 ? row[idxIdMay] : ""
        const imeiLast5 = imei.slice(-5)
        const isMatch = productIds.includes(imei) || productIds.includes(idMay) || productIds.includes(imeiLast5)
        const isProcessing = idxTrangThai !== -1 && row[idxTrangThai] === "Đang CNC"
        return isMatch && isProcessing
      })
      .map(row => row[idxIMEI])
    if (imeisToProcess.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy sản phẩm cần hoàn thành CNC" }, { status: 400 });
    }
    // Chuẩn hóa: lấy 5 số cuối IMEI cho logProductHistory
    const productIds5 = imeisToProcess.map(imei => imei.slice(-5));
    // Lấy trạng thái cũ từ sheet CNC
    const trangThaiCuArr = cncRows.filter(row => imeisToProcess.includes(row[idxIMEI]) && idxTrangThai !== -1 && row[idxTrangThai] === "Đang CNC").map(row => idxTrangThai !== -1 ? row[idxTrangThai] : "");

    // Cập nhật trạng thái trong sheet CNC sang 'Hoàn thành CNC' và ngày nhận lại
    let updatedCncRows = cncRows;
    if (idxTrangThai !== -1 || idxNgayNhanLai !== -1) {
      updatedCncRows = cncRows.map(row => {
        if (imeisToProcess.includes(row[idxIMEI]) && row[idxTrangThai] === "Đang CNC") {
          if (idxTrangThai !== -1) row[idxTrangThai] = "Hoàn thành CNC";
          if (idxNgayNhanLai !== -1) row[idxNgayNhanLai] = new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN");
        }
        return row;
      });
      const cncUpdateResult = await updateRowInGoogleSheets("CNC", "IMEI", "", updatedCncRows);
      if (!cncUpdateResult.success) {
        return NextResponse.json({ success: false, error: "Lỗi cập nhật trạng thái CNC: " + cncUpdateResult.error }, { status: 500 });
      }
    }

    // Cập nhật trạng thái về 'Còn hàng' trong kho chỉ với máy nguồn 'Kho shop'
    const { header: khoHeader, rows: khoRows } = await readFromGoogleSheets("Kho_Hang");
    const idxKhoId = colIndex(khoHeader, "ID Máy");
    const idxKhoIMEI = colIndex(khoHeader, "IMEI");
    const idxKhoTen = colIndex(khoHeader, "Tên Sản Phẩm", "Tên máy", "Sản phẩm", "Model");
    const idxKhoTrangThai = colIndex(khoHeader, "Trạng Thái");
    const idxKhoGhiChu = colIndex(khoHeader, "Ghi Chú");


    // Cập nhật trạng thái trong sheet Kho_Hang cho tất cả sản phẩm hoàn thành CNC
    const updatedKhoRows = khoRows.map(row => {
      // Tạo lại ID Máy từ IMEI nếu cần
      if (idxKhoIMEI !== -1 && row[idxKhoIMEI]) {
        row[idxKhoId] = row[idxKhoIMEI].slice(-5);
      }

      // Nếu IMEI nằm trong danh sách hoàn thành CNC, cập nhật trạng thái
      if (idxKhoIMEI !== -1 && imeisToProcess.includes(row[idxKhoIMEI])) {
        if (idxKhoTrangThai !== -1) row[idxKhoTrangThai] = "Còn hàng";
      }
      return row;
    });
    const syncKhoResult = await import("@/lib/google-sheets").then(m => m.syncToGoogleSheets("Kho_Hang", updatedKhoRows));
    if (!syncKhoResult.success) {
      return NextResponse.json({ success: false, error: "Lỗi đồng bộ kho hàng: " + syncKhoResult.error }, { status: 500 });
    }

    // --- Đồng bộ trạng thái máy về Dat_Coc ---
    try {
      // Đọc sheet Dat_Coc
      const { header: datCocHeader, rows: datCocRows } = await readFromGoogleSheets("Dat_Coc");
      const idxIMEI_DC = datCocHeader.findIndex(h => h.trim().toLowerCase() === "imei");
      const idxTrangThaiMay_DC = datCocHeader.findIndex(h => h.trim().toLowerCase() === "trạng thái máy");
      if (idxIMEI_DC !== -1 && idxTrangThaiMay_DC !== -1) {
        const imeiSet = new Set(imeisToProcess.map(i => String(i).trim()));
        const updatedDatCocRows = datCocRows.map(row => {
          if (imeiSet.has(String(row[idxIMEI_DC]).trim())) {
            row[idxTrangThaiMay_DC] = "Còn hàng";
          }
          return row;
        });
        // Ghi lại sheet Dat_Coc (giữ header)
        const allRows = [datCocHeader, ...updatedDatCocRows];
        await updateRangeValues("Dat_Coc!A1", allRows);
      }
    } catch (e) {
      console.warn("[SYNC CNC→Dat_Coc] Không thể đồng bộ trạng thái máy:", e);
    }

    // Ghi lịch sử trạng thái
  await logProductHistory(productIds5, "Hoàn thành CNC", employeeId, trangThaiCuArr);
  try {
    await addNotification({
      tieu_de: "Hoàn thành CNC",
      noi_dung: `Số lượng: ${imeisToProcess.length}`,
      loai: "kho_hang",
      nguoi_gui_id: employeeId || "system",
      nguoi_nhan_id: "all",
    })
  } catch (e) { console.warn('[NOTIFY] complete-cnc fail:', e) }
  try {
    const processedImeis = new Set<string>();
    const devices = cncRows
      .filter(row => {
        const imei = row[idxIMEI] as string;
        if (!imeisToProcess.includes(imei)) return false;
        if (processedImeis.has(imei)) return false; // Prevent duplicates for Telegram notification
        processedImeis.add(imei);
        return true;
      })
      .map(row => {
        let name = idxTen !== -1 ? row[idxTen] : undefined;
        const imei = row[idxIMEI];

        // Fallback to Kho_Hang if name is missing in CNC sheet
        if (!name && imei && khoRows && idxKhoIMEI !== -1 && idxKhoTen !== -1) {
          const khoRow = khoRows.find(k => k[idxKhoIMEI] === imei);
          if (khoRow) name = khoRow[idxKhoTen];
        }

        return {
          name,
          imei,
          serial: idxSerial !== -1 ? row[idxSerial] : undefined,
        };
      })
    await sendStockEventNotification({
      type: "complete_cnc",
      total: devices.length, // use actual deduplicated length
      devices,
      employee: employeeId,
    })
  } catch (e) { console.warn('[TG] complete-cnc message fail:', e) }
  return NextResponse.json({ success: true, message: `Đã hoàn thành CNC cho ${imeisToProcess.length} sản phẩm!` });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Lỗi xử lý hoàn thành CNC" }, { status: 500 });
  }
}
