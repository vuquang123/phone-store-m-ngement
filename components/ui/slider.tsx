"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const thumbCount = React.useMemo(() => {
    if (Array.isArray(props.value)) return props.value.length
    if (Array.isArray(props.defaultValue)) return props.defaultValue.length
    return 1
  }, [props.value, props.defaultValue])

  const thumbs = Array.from({ length: Math.max(1, thumbCount) })

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
      </SliderPrimitive.Track>
      {thumbs.map((_, idx) => (
        <SliderPrimitive.Thumb
          key={idx}
          className="block h-5 w-5 rounded-full border-2 border-blue-500 bg-white shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
