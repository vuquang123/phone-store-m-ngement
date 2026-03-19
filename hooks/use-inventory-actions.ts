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
      if (!res.ok) throw new Error("Thao tác thất bại")
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
    mutationFn: async ({ productIds, cncAddress, employeeId, products }: any) => {
      const res = await fetch("/api/kho-hang/send-cnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, cncAddress, employeeId, products })
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

  return {
    completeCNC: completeCNCMutation.mutateAsync,
    isCompletingCNC: completeCNCMutation.isPending,
    sendCNC: sendCNCMutation.mutateAsync,
    isSendingCNC: sendCNCMutation.isPending,
  }
}
