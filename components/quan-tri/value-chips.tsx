// Hiển thị màu máy và loại máy (Lock / Quốc tế / Wifi / 4G) thành nhãn có màu cho dễ phân biệt.
import { cn } from "@/lib/utils"

const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim()

// Thứ tự quan trọng: tên ghép (vd "black titanium") phải đứng trước tên đơn ("black").
const COLOR_RULES: [RegExp, string][] = [
  [/natural titan|titan tu nhien/, "#bfb5a3"],
  [/desert titan|titan sa mac/, "#c9a27e"],
  [/black titan|titan den/, "#3f3f46"],
  [/white titan|titan trang/, "#e7e5e4"],
  [/blue titan|titan xanh/, "#4b5d73"],
  [/rose gold|vang hong/, "#e8b4a8"],
  [/burgundy|maroon|do do|do man/, "#7f1d1d"],
  [/glacier|mist|ice|bang/, "#c7dcef"],
  [/mint|bac ha/, "#6ee7b7"],
  [/space black|midnight|jet black|den/, "#1f2937"],
  [/black/, "#1f2937"],
  [/space gr[ae]y|graphite|xam|gr[ae]y/, "#6b7280"],
  [/starlight|anh sao/, "#ece3d0"],
  [/white|trang/, "#fafaf9"],
  [/silver|bac/, "#c4c8cc"],
  [/gold|vang|yellow/, "#e0b43a"],
  [/cosmic orange|orange|cam/, "#f97316"],
  [/coral|san ho/, "#fb7185"],
  [/pink|hong/, "#f472b6"],
  [/red|do\b/, "#dc2626"],
  [/purple|lavender|tim/, "#a855f7"],
  [/teal|ultramarine/, "#0d9488"],
  [/green|xanh la|alpine|sage/, "#22c55e"],
  [/blue|xanh|sierra|pacific|navy/, "#3b82f6"],
]

export function colorHex(name: string): string | null {
  const f = fold(name)
  if (!f) return null
  for (const [re, hex] of COLOR_RULES) if (re.test(f)) return hex
  return null
}

export function ColorChip({ value, className }: { value: string; className?: string }) {
  const hex = colorHex(value)
  if (!value) return null
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/20 dark:border-white/30"
        style={{ background: hex || "transparent" }}
      />
      <span className="truncate">{value}</span>
    </span>
  )
}

export function typeTone(value: string) {
  const f = fold(value)
  if (!f) return ""
  if (f.includes("lock")) return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
  if (f.includes("quoc te") || f === "qt") return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
  if (f.includes("cellular") || f.includes("4g")) return "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
  if (f.includes("wifi")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
  return "bg-muted text-foreground"
}

export function TypeChip({ value }: { value: string }) {
  if (!value) return null
  return <span className={cn("inline-block max-w-full truncate rounded px-1.5 py-px text-[12px] font-medium", typeTone(value))}>{value}</span>
}

/** Cột nào cần tô màu: trả "color" | "type" | null theo tên cột. */
export function chipKind(header: string | null | undefined): "color" | "type" | null {
  const f = fold(String(header || ""))
  if (f === "mau sac" || f === "mau") return "color"
  if (f === "loai may") return "type"
  return null
}
