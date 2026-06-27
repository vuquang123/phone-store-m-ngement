"use client"
// Hook parser giảm giá — tách verbatim từ app/dashboard/ban-hang/page.tsx (refactor thuần).
// Lưu ý: commitDiscount/applyQuickDiscount/handleDiscountInput vốn không được gọi ở đâu (dead code cũ),
// giữ lại nguyên trạng để KHÔNG đổi hành vi. Các handler cần discountBase nhận qua tham số
// (discountBase được tính sau trong component nên không thể đóng kín trong hook).
import { useState } from "react"
import { parseDiscount } from "@/lib/ban-hang/discount"

export function useDiscount() {
  const [giamGia, setGiamGia] = useState(0)
  const [giamGiaInput, setGiamGiaInput] = useState("")
  const [discountParseMsg, setDiscountParseMsg] = useState<string>("")

  function handleDiscountInput(v: string){
    setGiamGiaInput(v)
    setDiscountParseMsg('')
  }
  function commitDiscount(discountBase: number){
    const parsed = parseDiscount(giamGiaInput, discountBase)
    setGiamGia(parsed)
    setGiamGiaInput(parsed ? `${parsed.toLocaleString('vi-VN')}đ` : "")
  }
  function applyQuickDiscount(tag: string, discountBase: number){
    const parsed = parseDiscount(tag, discountBase)
    setGiamGia(parsed)
    setGiamGiaInput(parsed ? `${parsed.toLocaleString('vi-VN')}đ` : '')
    setDiscountParseMsg('')
  }
  // Handlers cho input Giảm giá
  const handleDiscountPreset = (preset: string) => {
    if (preset === 'Reset') {
      setGiamGiaInput(''); setGiamGia(0); setDiscountParseMsg('');
    } else {
      setGiamGiaInput(preset);
    }
  };

  return {
    giamGia, setGiamGia,
    giamGiaInput, setGiamGiaInput,
    discountParseMsg, setDiscountParseMsg,
    handleDiscountInput, commitDiscount, applyQuickDiscount, handleDiscountPreset,
  }
}
