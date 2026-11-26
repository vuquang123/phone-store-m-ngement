"use client"

import { useEffect, useState } from "react"
import { getAuthHeaders } from "@/components/auth/protected-route"

export type Role = "chu_shop" | "quan_ly" | "nhan_vien"

export type AuthMe = {
  id?: string
  email?: string
  name?: string
  role?: Role
  status?: string
  employeeId?: string
  /** Chi nhánh gốc ('1' DEV PỒ, '2' T1s) */
  branch?: "1" | "2"
  branchName?: string
  /** Chi nhánh đang xem: '1' | '2' | 'all' */
  activeBranch?: "1" | "2" | "all"
  canSwitchBranch?: boolean
  branches?: { id: "1" | "2"; name: string }[]
  /** Lúc phiên đăng nhập hết hạn (ms) */
  sessionExpiresAt?: number | null
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let cachedMe: AuthMe | null = null
let cachedAt = 0
let pending: Promise<AuthMe | null> | null = null

async function fetchMe(): Promise<AuthMe | null> {
  try {
    const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as AuthMe
  } catch {
    return null
  }
}

async function loadMe(): Promise<AuthMe | null> {
  const now = Date.now()
  if (cachedMe && now - cachedAt < CACHE_TTL) return cachedMe
  if (pending) return pending
  pending = fetchMe().then((data) => {
    cachedMe = data
    cachedAt = Date.now()
    pending = null
    return data
  })
  return pending
}

/**
 * Hỏi lại server xem phiên còn không. Dùng khi mở lại app từ nền.
 * Trả false CHỈ khi server trả 401 (hết phiên thật); mất mạng / lỗi tạm -> coi như còn phiên.
 */
export async function kiemTraLaiPhien(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", { headers: getAuthHeaders(), cache: "no-store" })
    if (res.status === 401) {
      cachedMe = null
      cachedAt = 0
      return false
    }
    if (res.ok) {
      cachedMe = (await res.json()) as AuthMe
      cachedAt = Date.now()
    }
    return true
  } catch {
    return true
  }
}

export function useAuthMe() {
  const [me, setMe] = useState<AuthMe | null>(cachedMe)
  const [isLoading, setIsLoading] = useState(!cachedMe)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    if (cachedMe && Date.now() - cachedAt < CACHE_TTL) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    loadMe()
      .then((data) => {
        if (!mounted) return
        setMe(data)
        if (!data) setError("Phiên đăng nhập đã hết hạn")
      })
      .catch(() => {
        if (!mounted) return
        setError("Không lấy được thông tin tài khoản")
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { me, isLoading, error }
}
