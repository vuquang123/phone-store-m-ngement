"use client"

import { useEffect, useState } from "react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TablePaginationFooterProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  pageSize?: number
  itemLabel?: string
  className?: string
}

function buildPageList(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages: Array<number | "ellipsis-left" | "ellipsis-right"> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) pages.push("ellipsis-left")
  for (let current = start; current <= end; current += 1) pages.push(current)
  if (end < totalPages - 1) pages.push("ellipsis-right")

  pages.push(totalPages)
  return pages
}

export function TablePaginationFooter({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemLabel = "mục",
  className = "",
}: TablePaginationFooterProps) {
  const [pageInput, setPageInput] = useState(String(page))

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  if (totalPages <= 1) return null

  const startItem =
    totalItems && pageSize
      ? Math.min(totalItems, (page - 1) * pageSize + 1)
      : null
  const endItem =
    totalItems && pageSize
      ? Math.min(totalItems, page * pageSize)
      : null

  const submitPageJump = () => {
    const nextPage = Number(String(pageInput || "").replace(/[^\d]/g, ""))
    if (!Number.isFinite(nextPage) || nextPage < 1) {
      setPageInput(String(page))
      return
    }
    const clampedPage = Math.min(totalPages, Math.max(1, nextPage))
    setPageInput(String(clampedPage))
    if (clampedPage !== page) onPageChange(clampedPage)
  }

  return (
    <div className={`mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between ${className}`.trim()}>
      <div className="text-sm text-muted-foreground">
        {startItem !== null && endItem !== null && totalItems !== undefined
          ? `Hiển thị ${startItem}-${endItem} / ${totalItems} ${itemLabel}`
          : `Trang ${page} / ${totalPages}`}
      </div>

      <Pagination className="mx-0 w-full justify-start md:w-auto md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(event) => {
                event.preventDefault()
                if (page > 1) onPageChange(page - 1)
              }}
              className={page <= 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>

          {buildPageList(page, totalPages).map((item) => {
            if (typeof item !== "number") {
              return (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              )
            }

            return (
              <PaginationItem key={item}>
                <PaginationLink
                  href="#"
                  isActive={page === item}
                  onClick={(event) => {
                    event.preventDefault()
                    onPageChange(item)
                  }}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            )
          })}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(event) => {
                event.preventDefault()
                if (page < totalPages) onPageChange(page + 1)
              }}
              className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <div className="flex items-center gap-2 md:justify-end">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Đến trang</span>
        <Input
          inputMode="numeric"
          value={pageInput}
          onChange={(event) => {
            setPageInput(event.target.value.replace(/[^\d]/g, ""))
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              submitPageJump()
            }
          }}
          className="h-9 w-20"
        />
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={submitPageJump}>
          Đi
        </Button>
      </div>
    </div>
  )
}
