"use client"

// Dropdown có ô GÕ ĐỂ TÌM — dùng thay <Select> khi danh sách dài (vd 73 dòng
// máy iPhone + iPad): cuộn tay quá chậm, nhân viên gõ "15promax" là ra ngay.
//
// Trình bày cố ý bám sát <SelectTrigger> để đặt cạnh các ô Select khác trong
// cùng form không bị lệch khung.

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

/** Bỏ dấu, bỏ mọi ký tự không phải chữ/số rồi viết thường. */
function normalizeForSearch(s: string) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Khớp theo TỪNG TỪ, không đòi các từ phải liền nhau: mỗi từ người dùng gõ chỉ
 * cần xuất hiện đâu đó trong tên máy.
 *
 * Nếu chỉ so chuỗi liền thì "ipad m4" -> "ipadm4" KHÔNG khớp
 * "iPad Pro 11-inch (M4)" (vì ở giữa còn "pro11inch") — đúng kiểu người dùng
 * hay gõ nhất lại ra 0 kết quả.
 */
function matchesSearch(itemValue: string, search: string) {
  const target = normalizeForSearch(itemValue)
  const terms = search.trim().split(/\s+/).map(normalizeForSearch).filter(Boolean)
  if (!terms.length) return true
  return terms.every((term) => target.includes(term))
}

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: string[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  id?: string
  disabled?: boolean
  /** Class cho nút mở dropdown (chỉnh chiều cao / cỡ chữ cho khớp form). */
  className?: string
  /** Class cho panel kết quả (chỉnh bề rộng trong bảng nhập nhiều máy). */
  contentClassName?: string
  /** Class cho từng dòng kết quả. */
  itemClassName?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Chọn...",
  searchPlaceholder = "Gõ để tìm...",
  emptyText = "Không tìm thấy.",
  id,
  disabled,
  className,
  contentClassName,
  itemClassName,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  return (
    // modal: cần thiết khi đặt bên trong <Dialog> — không có thì ô tìm kiếm
    // không nhận được focus vì dialog giữ focus trap.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        {/*
          Không tự đặt role="combobox"/aria-expanded: PopoverTrigger (asChild) đã
          tiêm sẵn aria-haspopup + aria-expanded + aria-controls đầy đủ và đúng.
          Khai báo tay chỉ thừa và thiếu aria-controls.
        */}
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background dark:bg-input/40 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn("line-clamp-1 text-left", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0", contentClassName)}
        align="start"
      >
        <Command
          filter={(itemValue, search) => (matchesSearch(itemValue, search) ? 1 : 0)}
        >
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((item) => (
                <CommandItem
                  key={item}
                  value={item}
                  // Dùng `item` từ closure chứ KHÔNG dùng tham số của onSelect:
                  // cmdk trả về chuỗi đã viết thường, lưu vào sheet sẽ sai tên máy.
                  onSelect={() => {
                    onValueChange(item)
                    setOpen(false)
                  }}
                  className={itemClassName}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === item ? "opacity-100" : "opacity-0")} />
                  {item}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
