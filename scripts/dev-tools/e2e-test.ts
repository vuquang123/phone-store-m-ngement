// scripts/dev-tools/e2e-test.ts
// Test đầu-cuối trên server đang chạy ở máy với database THỬ (localhost):
//   1. Trang Quản trị dữ liệu: thêm / xem / sửa / chống ghi đè / nhập file / xoá cho từng bảng quan trọng
//   2. Các luồng nghiệp vụ: nhập kho, sửa máy, CNC, bảo hành, đặt cọc, bán hàng, hoàn trả,
//      phụ kiện, khách hàng, tiền mặt, ghi chú
//   3. Phân quyền: nhân viên không vào được trang quản trị
//
// Chuẩn bị: DATA_BACKEND=postgres DATABASE_URL=postgres://...localhost... pnpm start -p 3100
//   rồi:    BASE=http://localhost:3100 DATABASE_URL=... pnpm exec tsx scripts/dev-tools/e2e-test.ts
// Script tự tạo 2 tài khoản thử (test-ql@local / test-nv@local) trong bảng USERS của DB thử.
import bcrypt from "bcryptjs"
import { Pool } from "pg"

const BASE = process.env.BASE || "http://localhost:3100"
const DB = process.env.DATABASE_URL || ""
if (!/localhost|127\.0\.0\.1/.test(DB) || !/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error("Chỉ chạy với server và DATABASE_URL ở localhost.")
  process.exit(1)
}
const pool = new Pool({ connectionString: DB })
const sql = async (q: string, p: any[] = []) => (await pool.query(q, p)).rows

let pass = 0
const failures: string[] = []
let current = ""
function check(cond: any, msg: string) {
  if (cond) pass++
  else {
    failures.push(`[${current}] ${msg}`)
    console.log(`   ✗ ${msg}`)
  }
}
async function section(name: string, fn: () => Promise<void>) {
  current = name
  const before = failures.length
  try {
    await fn()
  } catch (e: any) {
    failures.push(`[${name}] lỗi: ${e?.message || e}`)
  }
  console.log(`${failures.length === before ? "✓" : "✗"} ${name}`)
}

/* ------------------------------ http ------------------------------ */
async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0]
  if (!res.ok || !cookie) throw new Error(`Đăng nhập ${email} thất bại: ${res.status}`)
  return cookie
}
let COOKIE = ""
async function call(method: string, path: string, body?: any, cookie = COOKIE) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, json }
}
const get = (p: string, c?: string) => call("GET", p, undefined, c)
const post = (p: string, b: any, c?: string) => call("POST", p, b, c)

/* ------------------------------ db helpers ------------------------------ */
async function tableRows(t: string) {
  const meta = (await sql(`select columns from _sheet_meta where sheet = $1`, [t]))[0]
  const rows = await sql(`select * from "${t.replace(/"/g, '""')}" order by _row`)
  return { columns: meta.columns as string[], rows }
}
function snapshot(rows: any[], skip: (r: any) => boolean) {
  return JSON.stringify(rows.filter((r) => !skip(r)).map((r) => { const { _row, _updated_at, ...rest } = r; return rest }))
}
const stamp = Date.now().toString().slice(-6)

/* ============================== main ============================== */
async function main() {
  // tài khoản thử
  const hash = bcrypt.hashSync("test1234", 10)
  await sql(`delete from "USERS" where "Email" in ('test-ql@local','test-nv@local')`)
  const maxRow = Number((await sql(`select max(_row) m from "USERS"`))[0].m)
  await sql(
    `insert into "USERS" (_row,"ID Nhân Viên","Email","Tên","Vai Trò","Trạng Thái","Mật Khẩu") values
     ($1,'NVT01','test-ql@local','QL Test','quan_ly','hoat_dong',$3), ($2,'NVT02','test-nv@local','NV Test','nhan_vien','hoat_dong',$3)`,
    [maxRow + 1, maxRow + 2, hash],
  )
  COOKIE = await login("test-ql@local", "test1234")
  const NV = await login("test-nv@local", "test1234")

  /* ------------------------- 1. phân quyền ------------------------- */
  await section("Phân quyền trang Quản trị", async () => {
    check((await get("/api/quan-tri?table=Kho_Hang", NV)).status === 403, "nhân viên bị chặn (403)")
    check((await get("/api/quan-tri?table=Kho_Hang", "")).status === 401, "chưa đăng nhập bị chặn (401)")
    check((await get("/api/quan-tri?table=USERS")).status === 400, "không mở được bảng USERS")
    check((await get("/api/quan-tri?table=DongTien_GiaoDich")).status === 400, "không mở được bảng dòng tiền")
    const list = await get("/api/quan-tri?list=1")
    check(list.json.tables?.length >= 10, "có danh sách bảng")
  })

  /* --------------------- 2. CRUD từng bảng quản trị --------------------- */
  const TABLES: Array<{ t: string; key: string; field: string }> = [
    { t: "Kho_Hang", key: "ID Máy", field: "Giá Bán" },
    { t: "Phu_Kien", key: "ID", field: "Số Lượng" },
    { t: "Khach_Hang", key: "Số Điện Thoại", field: "Ghi Chú" },
    { t: "Ban_Hang", key: "Mã đơn hàng", field: "Ghi chú" },
    { t: "Dat_Coc", key: "ID Đơn Hàng", field: "Số Tiền Cọc" },
    { t: "GOI_BAO_HANH", key: "Mã Gói", field: "Ghi Chú" },
    { t: "HOP_DONG_BAO_HANH", key: "Mã HĐ", field: "Ghi Chú" },
    { t: "Bao_Hanh", key: "IMEI", field: "Lỗi" },
    { t: "CNC", key: "IMEI", field: "Địa chỉ CNC" },
    { t: "Hoan_Tra", key: "ID", field: "Ghi Chú" },
    { t: "Hang_Doi_Tac", key: "ID Máy", field: "Giá Bán" },
  ]
  for (const { t, key, field } of TABLES) {
    await section(`Quản trị: ${t} (thêm/xem/sửa/xung đột/nhập file/xoá)`, async () => {
      const k1 = `TEST${stamp}A`
      const k2 = `TEST${stamp}B`
      const before = await get(`/api/quan-tri?table=${t}`)
      check(before.status === 200, `đọc được (${before.status})`)
      const header: string[] = before.json.header
      const ki = header.findIndex((h) => String(h ?? "").trim() === key)
      const fi = header.findIndex((h) => String(h ?? "").trim() === field)
      const K = header[ki] as string // tên cột gốc (có thể dính dấu cách như " ID Máy")
      const F = header[fi] as string
      check(ki >= 0 && fi >= 0, `có cột ${key} và ${field}`)
      const dbBefore = await tableRows(t)
      const isTest = (r: any) => Object.values(r).some((v) => typeof v === "string" && v.startsWith(`TEST${stamp}`))
      const snapBefore = snapshot(dbBefore.rows, isTest)

      // Create
      const add = await post("/api/quan-tri", { action: "append", table: t, rows: [{ [K]: k1, [F]: "100" }] })
      check(add.json.added === 1, "thêm 1 dòng")
      // Read
      let cur = await get(`/api/quan-tri?table=${t}`)
      let row = cur.json.rows.find((r: any) => r.cells[ki] === k1)
      check(row && row.cells[fi] === "100", "đọc lại thấy dòng mới đúng giá trị")
      check(cur.json.rows.length === before.json.rows.length + 1, "số dòng tăng 1")
      // Update
      const up = await post("/api/quan-tri", { action: "update", table: t, changes: [{ row: row.rowNumber, col: fi, old: "100", value: "200" }] })
      check(up.json.saved === 1 && up.json.conflicts.length === 0, "sửa 1 ô")
      // Conflict: gửi giá trị cũ sai -> không ghi
      const cf = await post("/api/quan-tri", { action: "update", table: t, changes: [{ row: row.rowNumber, col: fi, old: "100", value: "999" }] })
      check(cf.json.saved === 0 && cf.json.conflicts.length === 1, "phát hiện xung đột khi ô đã bị đổi")
      cur = await get(`/api/quan-tri?table=${t}`)
      row = cur.json.rows.find((r: any) => r.cells[ki] === k1)
      check(row?.cells[fi] === "200", "giá trị sau khi sửa là 200, không bị ghi đè 999")
      // Import: cập nhật k1 + thêm k2
      const imp = { action: "import", table: t, rows: [{ [K]: k1, [F]: "300" }, { [K]: k2, [F]: "50" }] }
      const dry = await post("/api/quan-tri", { ...imp, dryRun: true })
      check(dry.json.updatedRows === 1 && dry.json.added === 1, `xem trước nhập file: 1 sửa, 1 thêm (${JSON.stringify(dry.json)})`)
      cur = await get(`/api/quan-tri?table=${t}`)
      check(cur.json.rows.find((r: any) => r.cells[ki] === k1)?.cells[fi] === "200", "xem trước không ghi gì")
      const real = await post("/api/quan-tri", imp)
      check(real.json.updatedRows === 1 && real.json.added === 1, "nhập file: 1 sửa, 1 thêm")
      cur = await get(`/api/quan-tri?table=${t}`)
      const r1 = cur.json.rows.find((r: any) => r.cells[ki] === k1)
      const r2 = cur.json.rows.find((r: any) => r.cells[ki] === k2)
      check(r1?.cells[fi] === "300" && r2?.cells[fi] === "50", "sau nhập file giá trị đúng")
      // Delete: thử xoá với dữ liệu cũ -> từ chối; rồi xoá đúng
      const stale = await post("/api/quan-tri", { action: "delete", table: t, rows: [{ row: r1.rowNumber, cells: r1.cells.map((v: string, i: number) => (i === fi ? "1" : v)) }] })
      check(stale.json.deleted === 0 && stale.json.conflicts.length === 1, "không xoá dòng đã bị đổi")
      const del = await post("/api/quan-tri", { action: "delete", table: t, rows: [r1, r2].map((r: any) => ({ row: r.rowNumber, cells: r.cells })) })
      check(del.json.deleted === 2, "xoá 2 dòng thử")
      cur = await get(`/api/quan-tri?table=${t}`)
      check(!cur.json.rows.some((r: any) => String(r.cells[ki]).startsWith(`TEST${stamp}`)), "dòng thử đã biến mất")
      check(cur.json.rows.length === before.json.rows.length, "số dòng trở về như cũ")
      const dbAfter = await tableRows(t)
      check(snapshot(dbAfter.rows, isTest) === snapBefore, "các dòng khác không bị đụng tới")
    })
  }

  await section("Quản trị: Kho_Hang đổi Trạng Thái ghi lịch sử máy", async () => {
    const d = await get(`/api/quan-tri?table=Kho_Hang`)
    const h: string[] = d.json.header
    const st = h.findIndex((x) => x === "Trạng Thái")
    const row = d.json.rows.find((r: any) => r.cells[st] && r.cells[h.indexOf("IMEI")])
    const n0 = Number((await sql(`select count(*) c from "Lich_Su_Trang_Thai_May"`))[0].c)
    const old = row.cells[st]
    await post("/api/quan-tri", { action: "update", table: "Kho_Hang", changes: [{ row: row.rowNumber, col: st, old, value: "Đang xử lý test" }] })
    const n1 = Number((await sql(`select count(*) c from "Lich_Su_Trang_Thai_May"`))[0].c)
    check(n1 === n0 + 1, "có thêm 1 dòng lịch sử")
    await post("/api/quan-tri", { action: "update", table: "Kho_Hang", changes: [{ row: row.rowNumber, col: st, old: "Đang xử lý test", value: old }] })
  })

  /* ------------------------- 3. luồng nghiệp vụ ------------------------- */
  const imei = `35${stamp}0000001`.slice(0, 15)
  const imei2 = `35${stamp}0000002`.slice(0, 15)
  const findKho = async (im: string) => (await get("/api/kho-hang")).json.data?.find((x: any) => x.imei === im)

  await section("Nhập kho 2 máy", async () => {
    const r = await post("/api/kho-hang", {
      employeeId: "NVT01",
      products: [
        { ten_san_pham: "iPhone 15 Pro TEST", imei, dung_luong: "128GB", mau_sac: "Black", gia_nhap: "15000000", gia_ban: "17990000", loai_phu_kien: "Lock", pin: "90" },
        { ten_san_pham: "iPhone 14 TEST", imei: imei2, dung_luong: "128GB", mau_sac: "Blue", gia_nhap: "9000000", gia_ban: "10990000", loai_phu_kien: "Quốc tế", pin: "88" },
      ],
    })
    check(r.json.added === 2, `thêm 2 máy (${JSON.stringify(r.json)})`)
    const m = await findKho(imei)
    check(m && m.gia_ban === 17990000 && m.trang_thai === "Còn hàng", "máy hiện trong kho, giá và trạng thái đúng")
  })

  await section("Sửa thông tin máy", async () => {
    const m = await findKho(imei)
    const r = await call("PUT", `/api/kho-hang/${m.id}`, { gia_ban: "18500000", ghi_chu: "test sửa" })
    check(r.status === 200, `PUT ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`)
    const m2 = await findKho(imei)
    check(m2?.gia_ban === 18500000, "giá mới 18.500.000")
  })

  await section("Gửi CNC rồi nhận về", async () => {
    const s = await post("/api/kho-hang/send-cnc", { productIds: [imei2], cncAddress: "Tiệm CNC test", employeeId: "NVT01" })
    check(s.status === 200, `gửi CNC ${s.status} ${JSON.stringify(s.json).slice(0, 120)}`)
    const cnc = (await get("/api/kho-hang/cnc")).json.data || []
    check(cnc.some((x: any) => x.imei === imei2), "máy xuất hiện ở danh sách CNC")
    const c = await post("/api/kho-hang/complete-cnc", { productIds: [imei2], employeeId: "NVT01" })
    check(c.status === 200, `hoàn tất CNC ${c.status} ${JSON.stringify(c.json).slice(0, 120)}`)
    const m = await findKho(imei2)
    check(m && /còn hàng/i.test(m.trang_thai), `máy về kho, trạng thái: ${m?.trang_thai}`)
  })

  await section("Gửi bảo hành rồi hoàn tất", async () => {
    const a = await post("/api/kho-hang/add-bao-hanh-machine", {
      ten_san_pham: "iPhone 13 BH TEST", loai_may: "Lock", dung_luong: "128GB", tinh_trang: "99", imei: `35${stamp}0000009`.slice(0, 15),
      dia_chi_bao_hanh: "Trung tâm BH", ngay_gui: "22/11/2026", khach_hang: "Khách BH", so_dien_thoai: "0900000002", employeeId: "NVT01", loi: "Lỗi loa",
    })
    check(a.status === 200, `thêm máy bảo hành ${a.status} ${JSON.stringify(a.json).slice(0, 120)}`)
    const bh = await get("/api/kho-hang/baohanh-history")
    check(bh.status === 200, "đọc lịch sử bảo hành")
    const done = await post("/api/kho-hang/complete-baohanh", { ids: [`35${stamp}0000009`.slice(0, 15)], employeeId: "NVT01" })
    check(done.status === 200, `hoàn tất bảo hành ${done.status} ${JSON.stringify(done.json).slice(0, 120)}`)
    const row = (await sql(`select "Trạng Thái" s from "Bao_Hanh" where "IMEI" = $1`, [`35${stamp}0000009`.slice(0, 15)]))[0]
    check(row && /hoàn thành/i.test(row.s), `trạng thái bảo hành: ${row?.s}`)
  })

  await section("Phụ kiện: đọc, sửa, trừ tồn khi bán", async () => {
    const list = (await get("/api/phu-kien")).json.data
    check(Array.isArray(list) && list.length > 10, "có danh sách phụ kiện")
    const pk = list.find((x: any) => Number(x.so_luong_ton) >= 2)
    const put = await call("PUT", `/api/phu-kien/${pk.id}`, { gia_ban: 155000 })
    check(put.status === 200 && String(put.json.gia_ban) === "155000", "sửa giá phụ kiện")
    ;(globalThis as any).__pk = { id: pk.id, qty: Number(pk.so_luong_ton) }
  })

  await section("Khách hàng: thêm mới", async () => {
    const r = await post("/api/khach-hang", { ten_khach: "Khách E2E", sdt: `09${stamp}99` })
    check(r.status === 200 || r.status === 201, `thêm khách ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`)
    const all = (await get("/api/khach-hang")).json
    check(Array.isArray(all) && all.some((c: any) => c.sdt === `09${stamp}99`), "khách hiện trong danh sách")
  })

  await section("Đặt cọc", async () => {
    const m = await findKho(imei)
    const r = await post("/api/dat-coc", {
      ten_khach_hang: "Khách Cọc", so_dien_thoai: `09${stamp}88`, id_may: m.id, ten_san_pham: m.ten_san_pham, loai_may: m.loai_may,
      dung_luong: m.dung_luong, mau_sac: m.mau_sac, imei, gia_ban: 18500000, gia_nhap: 15000000, so_tien_coc: 2000000,
      han_thanh_toan: "30/11/2026", nguoi_ban: "NVT01", payments: [{ method: "Tiền mặt", amount: 2000000 }],
    })
    check(r.status === 200 || r.status === 201, `tạo đơn cọc ${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
    const list = await get("/api/dat-coc")
    check(list.status === 200, "đọc danh sách cọc")
    const rows = await sql(`select * from "Dat_Coc" where "IMEI" = $1`, [imei])
    check(rows.length === 1, "có 1 dòng cọc cho máy")
  })

  await section("Bán hàng: máy + phụ kiện", async () => {
    const pk = (globalThis as any).__pk
    const m = await findKho(imei2)
    const nOrders = Number((await sql(`select count(*) c from "Ban_Hang"`))[0].c)
    await post("/api/update-product-status", { productIds: [imei2], newStatus: "Đã bán" })
    await post("/api/delete-product-from-kho", { productIds: [imei2] })
    const r = await post("/api/ban-hang", {
      "Tên Khách Hàng": "Khách Mua E2E", "Số Điện Thoại": `09${stamp}77`, "Giá Bán": 11145000, "Thanh Toan": 11145000, "Giá Nhập": 9000000,
      "Hình Thức Thanh Toán": "Chuyển khoản", "Người Bán": "NVT01", "Loại Đơn": "Đơn off", "Hình Thức Vận Chuyển": "Tại cửa hàng",
      products: [{ id: m.id, ten_san_pham: m.ten_san_pham, loai_may: m.loai_may, dung_luong: m.dung_luong, imei: imei2, mau_sac: m.mau_sac, pin: m.pin, gia_ban: 10990000, gia_nhap: 9000000 }],
      accessories: [{ id: pk.id, ten_phu_kien: "pk", gia_ban: 155000, gia_nhap: 0, so_luong: 1 }],
      coreTotal: 11145000, warrantyTotal: 0, grossTotal: 11145000, finalThanhToan: 11145000, payments: [{ method: "Chuyển khoản", amount: 11145000 }], employeeId: "NVT01",
    })
    check(r.json.ok && r.json.id_don_hang, `tạo đơn ${JSON.stringify(r.json).slice(0, 150)}`)
    check(Number((await sql(`select count(*) c from "Ban_Hang"`))[0].c) === nOrders + 1, "Ban_Hang thêm 1 dòng")
    check(!(await findKho(imei2)), "máy đã rời kho")
    const pkAfter = (await get("/api/phu-kien")).json.data.find((x: any) => x.id === pk.id)
    check(Number(pkAfter.so_luong_ton) === pk.qty - 1, `tồn phụ kiện ${pk.qty} -> ${pkAfter.so_luong_ton}`)
    const order = (await get("/api/ban-hang")).json.data.find((o: any) => o.ma_don_hang === r.json.id_don_hang)
    check(!!order, "đơn hiện trong danh sách đơn hàng")
    ;(globalThis as any).__order = r.json.id_don_hang
  })

  await section("Hoàn trả", async () => {
    const r = await post("/api/hoan-tra", {
      khach_hang: "Khách Mua E2E", so_dien_thoai: `09${stamp}77`, san_pham: "iPhone 14 TEST", imei: imei2,
      ly_do: "Test hoàn trả", ma_don_hang: (globalThis as any).__order, clientRequestId: `rt-${stamp}`,
    })
    check(r.status === 200 || r.status === 201, `tạo hoàn trả ${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
    const again = await post("/api/hoan-tra", {
      khach_hang: "Khách Mua E2E", so_dien_thoai: `09${stamp}77`, san_pham: "iPhone 14 TEST", imei: imei2,
      ly_do: "Test hoàn trả", ma_don_hang: (globalThis as any).__order, clientRequestId: `rt-${stamp}`,
    })
    const n = (await sql(`select count(*) c from "Hoan_Tra" where "IMEI" = $1`, [imei2]))[0].c
    check(Number(n) === 1, `bấm 2 lần chỉ tạo 1 phiếu (có ${n}, lần 2: ${again.status})`)
  })

  await section("Quỹ tiền mặt: thu rồi chi", async () => {
    const b0 = (await get("/api/tien-mat")).json.balance
    const t = await post("/api/tien-mat", { loai: "thu", so_tien: 500000, ly_do: "Test thu" })
    check(t.status === 200, `thu ${t.status} ${JSON.stringify(t.json).slice(0, 100)}`)
    const c = await post("/api/tien-mat", { loai: "chi", so_tien: 200000, ly_do: "Test chi" })
    check(c.status === 200, `chi ${c.status}`)
    const b1 = (await get("/api/tien-mat")).json.balance
    check(b1 === b0 + 300000, `số dư ${b0} -> ${b1} (+300.000)`)
    const over = await post("/api/tien-mat", { loai: "chi", so_tien: b1 + 1, ly_do: "Chi quá số dư" })
    check(over.status === 400, "không cho chi quá số dư")
  })

  await section("Ghi chú: tạo và hoàn thành", async () => {
    const r = await post("/api/ghi-chu", { noiDung: `Ghi chú E2E ${stamp}` })
    check(r.json.success, `tạo ghi chú ${JSON.stringify(r.json).slice(0, 100)}`)
    const id = r.json.id
    const p = await call("PATCH", "/api/ghi-chu", { id })
    check(p.json.success, `hoàn thành ghi chú ${JSON.stringify(p.json).slice(0, 100)}`)
  })

  await section("Trang tổng quan vẫn đọc được sau các thay đổi", async () => {
    for (const p of ["/api/dashboard/stats", "/api/dashboard/recent-activities", "/api/warranties", "/api/check-in/ton-kho", "/api/nhan-vien/tong-ket-ca"]) {
      const r = await get(p)
      check(r.status === 200, `${p} -> ${r.status}`)
    }
  })

  await section("Ghi đồng thời: 15 lệnh thêm dòng cùng lúc không đè nhau", async () => {
    const n0 = Number((await sql(`select count(*) c from "Ghi_chu"`))[0].c)
    await Promise.all(Array.from({ length: 15 }, (_, i) => post("/api/ghi-chu", { noiDung: `Song song ${stamp}-${i}` })))
    const n1 = Number((await sql(`select count(*) c from "Ghi_chu"`))[0].c)
    check(n1 === n0 + 15, `thêm đủ 15 dòng (${n1 - n0})`)
  })

  console.log(`\n${pass} kiểm tra đạt, ${failures.length} lỗi`)
  for (const f of failures) console.log(" - " + f)
  await sql(`delete from "USERS" where "Email" in ('test-ql@local','test-nv@local')`)
  await pool.end()
  process.exit(failures.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await pool.end()
  process.exit(1)
})
