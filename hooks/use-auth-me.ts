"use client"

import { useEffect, useState } from "react"
import { getAuthHeaders } from "@/components/auth/protected-route"

export type Role = "quan_ly" | "nhan_vien"

export type AuthMe = {
  id?: string
  email?: string
  name?: string
  role?: Role
  status?: string
  employeeId?: string
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
