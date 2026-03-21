import { NextResponse } from "next/server";
import { readFromGoogleSheets, syncToGoogleSheets, colIndex } from "@/lib/google-sheets";


export async function POST(req: Request) {
  try {
    const { productIds } = await req.json();
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
    }
    // Đọc sheet Kho_Hang
    const { header, rows } = await readFromGoogleSheets("Kho_Hang");
    const idxIMEI = colIndex(header, "IMEI");
    const idxSerial = colIndex(header, "Serial");
    const idxId = colIndex(header, "ID Máy");

    // Chuẩn hóa danh sách IDs cần xóa
    const normProductIds = (productIds || []).map((id: any) => String(id || "").trim().toLowerCase()).filter(Boolean);

    // Lọc các dòng không thuộc sản phẩm cần xóa (match theo IMEI, Serial hoặc ID Máy)
    const newRows = rows.filter(row => {
      const imei = idxIMEI !== -1 ? String(row[idxIMEI] || "").trim().toLowerCase() : "";
      const serial = idxSerial !== -1 ? String(row[idxSerial] || "").trim().toLowerCase() : "";
      const idMay = idxId !== -1 ? String(row[idxId] || "").trim().toLowerCase() : "";
      
      const imeiLast5 = imei.length >= 5 ? imei.slice(-5) : "";
      const serialLast5 = serial.length >= 5 ? serial.slice(-5) : "";

      const matched = normProductIds.some(pid => 
        (imei && pid === imei) || 
        (serial && pid === serial) || 
        (idMay && pid === idMay) ||
        (imeiLast5 && pid === imeiLast5) ||
        (serialLast5 && pid === serialLast5)
      );
      
      return !matched;
    });

    await syncToGoogleSheets("Kho_Hang", newRows);
    return NextResponse.json({ success: true, count: productIds.length });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
