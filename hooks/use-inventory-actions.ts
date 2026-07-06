import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getAuthHeaders } from "@/components/auth/protected-route"

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

  const toggleDangXuLyMutation = useMutation({
    mutationFn: async ({ productIds, employeeName, value }: { productIds: string[], employeeName?: string, value?: string }) => {
      const res = await fetch("/api/kho-hang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_dang_xu_ly", productIds, employeeName, value })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Cập nhật trạng thái đang xử lý thất bại")
      }
      return res.json()
    },
    // Optimistic update: đổi badge ngay trên UI, rollback nếu lỗi
    onMutate: async ({ productIds, employeeName, value }) => {
      await queryClient.cancelQueries({ queryKey: ["inventory"] })
      const previous = queryClient.getQueryData<any>(["inventory"])
      queryClient.setQueryData(["inventory"], (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((p: any) => {
            if (!productIds.includes(p.id)) return p
            const current = String(p.dang_xu_ly || "").trim()
            const isProcessing = current !== "" && current.toLowerCase() !== "no"
            return { ...p, dang_xu_ly: value ?? (isProcessing ? "No" : (employeeName || "Yes")) }
          })
        }
      })
      return { previous }
    },
    onError: (error: any, _vars, context: any) => {
      if (context?.previous) queryClient.setQueryData(["inventory"], context.previous)
      toast.error(`Lỗi: ${error.message}`)
    },
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái đang xử lý")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
    }
  })

  // ===== Hàng đối tác (sheet Hang_doi_tac) =====
  const addHangDoiTacMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/hang-doi-tac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Thêm máy đối tác thất bại")
      return data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["hang-doi-tac"] })
      toast.success(`Đã thêm ${data.added || 1} máy đối tác`)
      if (data.duplicated?.length) {
        toast.warning(`IMEI trùng, bỏ qua: ${data.duplicated.join(", ")}`)
      }
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`)
    }
  })

  const deleteHangDoiTacMutation = useMutation({
    mutationFn: async ({ productIds }: { productIds: string[] }) => {
      const res = await fetch("/api/hang-doi-tac", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action: "delete", productIds })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Xóa máy đối tác thất bại")
      return data
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["hang-doi-tac"] })
      toast.success(`Đã xóa ${data.removed || 0} máy đối tác`)
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`)
    }
  })

  const transferHangDoiTacMutation = useMutation({
    mutationFn: async ({ productIds, khoDich, employeeId }: { productIds: string[], khoDich: "Kho trong" | "Kho ngoài", employeeId?: string }) => {
      const res = await fetch("/api/hang-doi-tac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer", productIds, khoDich, employeeId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Chuyển kho thất bại")
      return data
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hang-doi-tac"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast.success(`Đã chuyển ${data.transferred || 0} máy sang ${variables.khoDich}`)
      if (data.skipped?.length) {
        toast.warning(`Bỏ qua (IMEI đã có trong kho): ${data.skipped.join(", ")}`)
      }
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
    toggleDangXuLy: toggleDangXuLyMutation.mutateAsync,
    isTogglingDangXuLy: toggleDangXuLyMutation.isPending,
    addHangDoiTac: addHangDoiTacMutation.mutateAsync,
    isAddingHangDoiTac: addHangDoiTacMutation.isPending,
    deleteHangDoiTac: deleteHangDoiTacMutation.mutateAsync,
    isDeletingHangDoiTac: deleteHangDoiTacMutation.isPending,
    transferHangDoiTac: transferHangDoiTacMutation.mutateAsync,
    isTransferringHangDoiTac: transferHangDoiTacMutation.isPending,
  }
}
