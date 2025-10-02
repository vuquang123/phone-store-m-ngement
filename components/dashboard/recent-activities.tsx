"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Package, AlertCircle, RefreshCw } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

interface RecentActivity {
  type: string
  title: string
  description: string
  time: string
  icon: string
  customer?: string
  product?: string
  total?: string | number
}

interface RecentActivitiesProps {
  activities: RecentActivity[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function RecentActivities({ activities, isLoading = false, onRefresh }: RecentActivitiesProps) {
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case "shopping-cart":
        return <ShoppingCart className="h-4 w-4 text-emerald-600" />
      case "package":
        return <Package className="h-4 w-4 text-blue-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-orange-600" />
    }
  }

  const getIconBg = (iconType: string) => {
    switch (iconType) {
      case "shopping-cart":
        return "bg-emerald-100 dark:bg-emerald-900/20"
      case "package":
        return "bg-blue-100 dark:bg-blue-900/20"
      default:
        return "bg-orange-100 dark:bg-orange-900/20"
    }
  }

  return (
  <Card className="hover:shadow-md transition-shadow duration-200 h-fit w-full min-w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-emerald-100 to-blue-100 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-base lg:text-lg">Hoạt động gần đây</CardTitle>
            <CardDescription className="text-xs lg:text-sm">Nhập kho & Xuất hàng gần nhất</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
          {/* Nhập kho */}
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-100 text-indigo-700 rounded-full p-2"><Package className="h-4 w-4" /></span>
              <span className="font-semibold text-lg">Nhập kho</span>
            </div>
            <div className="space-y-3">
              {activities.filter(a => a.type === "nhap-kho").slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-indigo-50 transition-colors">
                  <span className="bg-indigo-100 text-indigo-700 rounded-full p-2"><Package className="h-4 w-4" /></span>
                  <div>
                    <span className="font-semibold">{activity.title}</span>
                    <span className="block text-[#888] text-sm">{activity.description}</span>
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-3 px-4 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-sm hover:bg-indigo-100">Xem tất cả</Button>
          </div>
          {/* Xuất hàng */}
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-green-100 text-green-700 rounded-full p-2"><ShoppingCart className="h-4 w-4" /></span>
              <span className="font-semibold text-lg">Xuất hàng</span>
            </div>
            <div className="space-y-3">
              {activities.filter(a => a.type === "xuat-hang").slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-green-50 transition-colors">
                  <span className="bg-green-100 text-green-700 rounded-full p-2"><ShoppingCart className="h-4 w-4" /></span>
                  <div>
                    <span className="font-semibold">{activity.customer} | {activity.product} | {activity.total}</span>
                    <span className="block text-[#888] text-sm">{activity.description}</span>
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-3 px-4 py-1 rounded-full bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100">Xem tất cả</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
