import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export function useInventoryActions() {
  const queryClient = useQueryClient()

  const completeCNCMutation = useMutation({
    mutationFn: async ({ productIds, employeeId }: { productIds: string[], employeeId: string }) => {
      const res = await fetch("/api/kho-hang/complete-cnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, employeeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Thao tác hoàn thành CNC thất bại")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["cnc-inventory"] })
      toast.success("Đã hoàn thành CNC")
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`)
    }
  })

  const sendCNCMutation = useMutation({
    mutationFn: async ({ productIds, cncAddress, employeeId, products, doSim }: any) => {
      const res = await fetch("/api/kho-hang/send-cnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, cncAddress, employeeId, products, doSim })
      })
      if (!res.ok) throw new Error("Gửi CNC thất bại")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["cnc-inventory"] })
      toast.success("Đã gửi CNC thành công")
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`)
    }
  })

  // Add more mutations as needed (Warranty, etc.)

  const sendPartnerMutation = useMutation({
    mutationFn: async ({ productIds, partnerName, employeeId }: any) => {
      const res = await fetch("/api/kho-hang/send-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, partnerName, employeeId })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Giao đối tác thất bại")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast.success("Đã giao đối tác thành công")
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`)
    }
  })

  const returnPartnerMutation = useMutation({
    mutationFn: async ({ productIds, employeeId }: { productIds: string[], employeeId: string }) => {
      const res = await fetch("/api/kho-hang/return-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, employeeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Hoàn kho thất bại")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast.success("Đã hoàn sản phẩm về kho")
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`)
    }
  })

  const bulkUpdateNguonMutation = useMutation({
    mutationFn: async ({ productIds, nguon, employeeId }: { productIds: string[], nguon: string, employeeId: string }) => {
      const res = await fetch("/api/kho-hang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_update_nguon", productIds, nguon, employeeId })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Chuyển kho thất bại")
      }
      return res.json()
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast.success(`Đã chuyển ${variables.productIds.length} máy sang ${variables.nguon}`)
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`)
    }
  })

  return {
    completeCNC: completeCNCMutation.mutateAsync,
    isCompletingCNC: completeCNCMutation.isPending,
    sendCNC: sendCNCMutation.mutateAsync,
    isSendingCNC: sendCNCMutation.isPending,
    sendPartner: sendPartnerMutation.mutateAsync,
    isSendingPartner: sendPartnerMutation.isPending,
    returnPartner: returnPartnerMutation.mutateAsync,
    isReturningPartner: returnPartnerMutation.isPending,
    bulkUpdateNguon: bulkUpdateNguonMutation.mutateAsync,
    isUpdatingNguon: bulkUpdateNguonMutation.isPending,
  }
}
