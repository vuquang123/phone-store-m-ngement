"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { RefreshCw } from "lucide-react"

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  pullThreshold?: number
}

export function PullToRefresh({
  onRefresh,
  children,
  pullThreshold = 100,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only pull if we are at the top of the page
    if (window.scrollY === 0) {
      startY.current = e.touches[0].pageY
      isPulling.current = true
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return

    currentY.current = e.touches[0].pageY
    const diff = currentY.current - startY.current

    if (diff > 0) {
      // Apply some resistance
      const pull = Math.min(diff * 0.4, pullThreshold + 20)
      setPullDistance(pull)
      
      // Prevent default scrolling if pulling
      if (diff > 10 && e.cancelable) {
        e.preventDefault()
      }
    } else {
      setPullDistance(0)
    }
  }

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || isRefreshing) return
    isPulling.current = false

    if (pullDistance >= pullThreshold) {
      setIsRefreshing(true)
      setPullDistance(pullThreshold)
      try {
        await onRefresh()
      } finally {
        // Delay slightly for smooth transition
        setTimeout(() => {
          setIsRefreshing(false)
          setPullDistance(0)
        }, 500)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, pullThreshold, onRefresh, isRefreshing])

  return (
    <div
      className="relative w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance / pullThreshold,
          transition: isPulling.current ? "none" : "height 0.3s ease, opacity 0.3s ease",
        }}
        className="flex items-center justify-center overflow-hidden bg-slate-50/50 w-full"
      >
        <div className={`transition-transform duration-300 ${pullDistance >= pullThreshold ? "rotate-180" : ""}`}>
          <RefreshCw className={`w-6 h-6 text-emerald-500 ${isRefreshing ? "animate-spin" : ""}`} />
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling.current ? "none" : "transform 0.3s ease",
        }}
        className="w-full"
      >
        {children}
      </div>
    </div>
  )
}
