"use client"

// ---------------------------------------------------------------------------
// Ô chọn ngày hiển thị theo kiểu Việt Nam: NGÀY/THÁNG/NĂM.
//
// Vì sao không dùng <input type="date">: trình duyệt tự vẽ ô đó theo locale của
// MÁY người dùng, không theo trang web. Máy để tiếng Anh (Mỹ) sẽ hiện 11/08/2026
// nghĩa là 8 tháng 11 — rất dễ đọc nhầm thành 11 tháng 8. HTML/CSS không đổi
// được định dạng đó, nên phải tự vẽ.
//
// Giá trị vào/ra vẫn là chuỗi "yyyy-MM-dd" để không phải sửa code gọi.
// ---------------------------------------------------------------------------

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { vi } from "date-fns/locale"
import type { Matcher } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** "yyyy-MM-dd" -> Date lúc 00:00 giờ máy. Tự dựng để tránh lệch ngày do UTC. */
function parseISODate(value?: string): Date | undefined {
  if (!value) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** Date -> "yyyy-MM-dd" theo giờ máy (KHÔNG dùng toISOString: lệch múi giờ). */
function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Date -> "dd/MM/yyyy" để hiển thị. */
function formatVN(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

export interface DatePickerVNProps {
  /** Ngày đang chọn, dạng "yyyy-MM-dd". */
  value: string
  onChange: (value: string) => void
  /** Ngày lớn nhất được chọn, dạng "yyyy-MM-dd". */
  max?: string
  /** Ngày nhỏ nhất được chọn, dạng "yyyy-MM-dd". */
  min?: string
  id?: string
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function DatePickerVN({
  value,
  onChange,
  max,
  min,
  id,
  className,
  placeholder = "Chọn ngày",
  disabled,
}: DatePickerVNProps) {
  const [open, setOpen] = React.useState(false)

  const selected = parseISODate(value)
  const maxDate = parseISODate(max)
  const minDate = parseISODate(min)

  const minTime = minDate?.getTime()
  const maxTime = maxDate?.getTime()
  const disabledDays = React.useMemo<Matcher[] | undefined>(() => {
    const rules: Matcher[] = []
    if (minTime !== undefined) rules.push({ before: new Date(minTime) })
    if (maxTime !== undefined) rules.push({ after: new Date(maxTime) })
    return rules.length ? rules : undefined
  }, [minTime, maxTime])

  const handleSelect = (d?: Date) => {
    if (!d) return
    onChange(toISODate(d))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            // `flex w-full` (không phải inline-flex mặc định của Button): nếu để
            // inline, nhãn phía trên sẽ bị kéo nằm cùng dòng với nút.
            "flex h-9 w-full justify-start gap-2 px-3 font-normal tabular-nums",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          {selected ? formatVN(selected) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={vi}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected ?? maxDate}
          onSelect={handleSelect}
          disabled={disabledDays}
          autoFocus
        />
        <div className="flex justify-end gap-1 border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handleSelect(new Date())}
          >
            Hôm nay
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
