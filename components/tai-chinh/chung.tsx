"use client"
// Dùng chung cho các trang Tài chính (chỉ chủ shop): gọi API, định dạng tiền, thanh tab, ô số tiền.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export async function goiApi<T = any>(url: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `Lỗi ${res.status}`)
  return json as T
}

export const vnd = (n: number | null | undefined) => Math.round(Number(n) || 0).toLocaleString("vi-VN")
export const ngayVN = (iso: string) => (iso ? `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}/${iso.slice(0, 4)}` : "")
export const pt = (n: number) => `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString("vi-VN")}%`

const TABS = [
  { href: "/dashboard/tai-chinh", label: "Tổng quan" },
  { href: "/dashboard/tai-chinh/lo-hang", label: "Lô hàng" },
  { href: "/dashboard/tai-chinh/cong-no", label: "Công nợ" },
  { href: "/dashboard/tai-chinh/chi-phi", label: "Chi phí ngoài" },
  { href: "/dashboard/tai-chinh/bao-cao-21h", label: "Báo cáo 21h" },
  { href: "/dashboard/tai-chinh/danh-muc", label: "Đầu hàng & CTV" },
  { href: "/dashboard/tai-chinh/cai-dat", label: "Cài đặt" },
]

export function TaiChinhTabs() {
  const p = usePathname()
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      <div className="inline-flex whitespace-nowrap rounded-lg border bg-card p-0.5">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              p === t.href ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function KhungTrang({ tieuDe, moTa, phai, children }: { tieuDe: string; moTa?: string; phai?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <TaiChinhTabs />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{tieuDe}</h1>
          {moTa && <p className="text-sm text-muted-foreground">{moTa}</p>}
        </div>
        {phai}
      </div>
      {children}
    </div>
  )
}

export function The({ nhan, giaTri, phu, mau }: { nhan: string; giaTri: React.ReactNode; phu?: React.ReactNode; mau?: "do" | "vang" | "xanh" }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3",
        mau === "do" && "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
        mau === "vang" && "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
        mau === "xanh" && "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
      )}
    >
      <div className="text-xs text-muted-foreground">{nhan}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums md:text-xl">{giaTri}</div>
      {phu && <div className="mt-0.5 text-xs text-muted-foreground">{phu}</div>}
    </div>
  )
}

export function Nhan({ mau, children }: { mau: "do" | "vang" | "xanh" | "xam" | "xanhduong"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        mau === "do" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        mau === "vang" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        mau === "xanh" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        mau === "xanhduong" && "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        mau === "xam" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

/** Ô nhập tiền: hiện 15.500.000, trả về số. */
export function OTien({ value, onChange, placeholder, className, autoFocus }: { value: number | ""; onChange: (n: number | "") => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  const [txt, setTxt] = useState(value === "" ? "" : vnd(value))
  useEffect(() => {
    setTxt(value === "" ? "" : vnd(value))
  }, [value])
  return (
    <Input
      inputMode="numeric"
      autoFocus={autoFocus}
      className={cn("tabular-nums", className)}
      placeholder={placeholder || "0"}
      value={txt}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, "")
        setTxt(d ? Number(d).toLocaleString("vi-VN") : "")
        onChange(d ? Number(d) : "")
      }}
    />
  )
}

export const homNayISO = () => {
  const d = new Date(Date.now() + 7 * 3600_000)
  return d.toISOString().slice(0, 10)
}

/** Xuất CSV có BOM để Excel mở đúng tiếng Việt. */
export function xuatCsv(ten: string, hang: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "")
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob(["﻿" + hang.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = ten
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function DangTai() {
  return <div className="py-16 text-center text-sm text-muted-foreground">Đang tải…</div>
}
