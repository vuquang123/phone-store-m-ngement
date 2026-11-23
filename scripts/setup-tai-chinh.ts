// scripts/setup-tai-chinh.ts
// Chuẩn bị phần Tài chính (lô hàng, công nợ đầu hàng, báo cáo 21h). Chạy lại nhiều lần vẫn an toàn.
//
//   pnpm db:tai-chinh                 # XEM TRƯỚC: in ra sẽ làm gì, không ghi gì
//   pnpm db:tai-chinh --yes           # ghi vào Supabase
//   pnpm db:tai-chinh --yes --sheet   # ghi xong chép các bảng mới sang Google Sheet
//
// Chỉ THÊM, không sửa/xoá dữ liệu cũ:
//  1. Sao lưu Kho_Hang + Ban_Hang ra file JSON (thư mục backups/).
//  2. Tạo 8 bảng mới: Dau_Hang, Lo_Nhap, Chi_Tiet_Lo, Tra_No_Dau_Hang, CTV,
//     Cai_Dat_Tai_Chinh (ghi sẵn giá trị mặc định), Lich_Su_Gia, Bao_Cao_21h.
//  3. Tạo đầu hàng "Không rõ" và lô LO-CU-KHONG-RO cho mỗi chi nhánh có máy tồn
//     (lô này KHÔNG tính nợ đầu hàng), rồi chép mọi máy đang tồn chưa có lô vào sổ lô của nó.
//  Đơn bán cũ không gán vào lô (báo cáo lô tính từ lúc bắt đầu dùng).
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()
import { mkdirSync, writeFileSync } from "fs"

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL
process.env.DATA_BACKEND = "postgres"

const APPLY = process.argv.includes("--yes")
const TO_SHEET = process.argv.includes("--sheet")
const LO_CU = "LO-CU-KHONG-RO"
const TRANG_THAI_LO_CU = "Lô cũ (không tính nợ)"

async function main() {
  const gs = await import("../lib/google-sheets")
  const pg = await import("../lib/sheet-store/pg")
  const { BANG, COT, damBaoBang, docBang } = await import("../lib/tai-chinh/bang")
  const { ghiCaiDatMacDinh } = await import("../lib/tai-chinh/cai-dat")
  const { docKho, homNayVN } = await import("../lib/tai-chinh/du-lieu")
  const { themDauHang, taoLo, suaLo, ganMayKhoVaoLo } = await import("../lib/tai-chinh/ghi")
  const { BRANCHES } = await import("../lib/branches")

  const host = (() => {
    try {
      return new URL(pg.cleanConnectionString(process.env.DATABASE_URL)).hostname
    } catch {
      return "?"
    }
  })()
  console.log(APPLY ? `== GHI THẬT vào ${host} ==` : `== XEM TRƯỚC trên ${host} (thêm --yes để ghi) ==`)

  // 1. sao lưu
  const kho = await gs.readFromGoogleSheets("Kho_Hang", undefined, { force: true })
  const ban = await gs.readFromGoogleSheets("Ban_Hang", undefined, { force: true })
  console.log(`Kho_Hang: ${kho.rows.length} dòng · Ban_Hang: ${ban.rows.length} dòng`)
  if (APPLY) {
    mkdirSync("backups", { recursive: true })
    const f = `backups/truoc-tai-chinh-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    writeFileSync(f, JSON.stringify({ Kho_Hang: kho, Ban_Hang: ban }))
    console.log(`Đã sao lưu: ${f}`)
  }

  // 2. bảng mới
  const coSan = new Set((await pg.listSheets()).map((s) => s.toLowerCase()))
  for (const t of Object.values(BANG)) {
    console.log(`${coSan.has(t.toLowerCase()) ? "✓ đã có" : "+ tạo  "} ${t} (${COT[t].length} cột)`)
    if (APPLY) await damBaoBang(t)
  }
  if (APPLY) console.log(`Cài đặt mặc định: thêm ${await ghiCaiDatMacDinh()} khoá`)

  // 3. lô cũ
  const mayKho = (await docKho()).filter((k) => k.trangThai !== "Đã bán")
  const soLo = APPLY ? (await docBang(BANG.CHI_TIET_LO)).dong : []
  const coLo = new Set(soLo.flatMap((d) => [d["IMEI"], d["Serial"]].filter(Boolean).map((s) => s.toUpperCase())))
  const chuaLo = mayKho.filter((k) => ![k.imei, k.serial].filter(Boolean).some((id) => coLo.has(id.toUpperCase())))
  let dauHangId = ""
  if (APPLY) {
    const dh = (await docBang(BANG.DAU_HANG)).dong.find((d) => d["Tên"] === "Không rõ")
    dauHangId = dh ? dh["ID"] : await themDauHang({ ten: "Không rõ", ghiChu: "Máy tồn trước khi dùng phần quản lý lô" })
  }
  for (const b of BRANCHES) {
    const ds = chuaLo.filter((k) => k.chiNhanh === b.name)
    const ma = b.id === "1" ? LO_CU : `${LO_CU}-${b.name.toUpperCase().replace(/[^A-Z0-9]/g, "")}`
    console.log(`${b.name}: ${ds.length} máy tồn chưa có lô -> ${ds.length ? ma : "(không cần lô cũ)"}`)
    const thieuGia = ds.filter((k) => !k.giaNhap)
    if (thieuGia.length) console.log(`   ⚠ ${thieuGia.length} máy giá nhập = 0: ${thieuGia.map((k) => k.ten + " " + (k.imei || k.serial)).join("; ")}`)
    if (!APPLY || !ds.length) continue
    const loDaCo = (await docBang(BANG.LO_NHAP)).dong.find((d) => d["Mã Lô"] === ma)
    if (!loDaCo) {
      const ngayMin = ds.map((k) => k.ngayNhap).filter(Boolean).sort()[0] || homNayVN()
      await taoLo({ ma, dauHangId, ngayNhap: ngayMin, chiNhanh: b.name, nguoiTao: "db:tai-chinh", ghiChu: "Máy tồn trước khi dùng phần quản lý lô" })
      await suaLo(ma, { trangThai: TRANG_THAI_LO_CU })
    }
    const n = await ganMayKhoVaoLo(ma, "tat-ca-chua-co-lo", b.name)
    console.log(`   đã chép ${n} máy vào sổ lô ${ma}`)
  }

  if (APPLY && TO_SHEET) {
    const { exportPostgresToSheets } = await import("../lib/sheet-store/export-to-sheets")
    const r = await exportPostgresToSheets(Object.values(BANG))
    console.log("Đã chép sang Google Sheet:", r.map((x) => `${x.tab} (${x.rows})`).join(", "))
  }
  console.log(APPLY ? "Xong." : "Chưa ghi gì. Chạy lại với --yes để ghi.")
  await pg.closePool()
}

main().catch(async (e) => {
  console.error("LỖI:", e?.message || e)
  process.exit(1)
})
