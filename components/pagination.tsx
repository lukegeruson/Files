"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Page numbers to render, with `"gap"` marking a truncated run.
 *
 * Renovation has 46 articles and the home page 125, so at six and twelve per
 * page that is 8 and 11 pages — too many to list in full on mobile. The window
 * always keeps the first page, the last page, and the current page's immediate
 * neighbours, which is enough to orient without wrapping the control.
 */
export function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages = new Set<number>([1, total, current])
  if (current - 1 > 1) pages.add(current - 1)
  if (current + 1 < total) pages.add(current + 1)

  // Keep the control a stable width near the ends, where a neighbour is clamped.
  if (current <= 3) {
    pages.add(2)
    pages.add(3)
    pages.add(4)
  }
  if (current >= total - 2) {
    pages.add(total - 1)
    pages.add(total - 2)
    pages.add(total - 3)
  }

  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const out: Array<number | "gap"> = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("gap")
    out.push(page)
    previous = page
  }
  return out
}

type Props = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Describes what is being paged, e.g. "articles", for screen readers. */
  label?: string
}

export function Pagination({ page, totalPages, onPageChange, label = "articles" }: Props) {
  if (totalPages <= 1) return null

  const items = pageWindow(page, totalPages)

  return (
    <nav aria-label={`${label} pagination`} className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span className="sr-only">Previous page</span>
      </button>

      {items.map((item, i) =>
        item === "gap" ? (
          <span
            // Gaps carry no identity of their own, so the index is the only key available.
            key={`gap-${i}`}
            aria-hidden="true"
            className="grid size-9 place-items-center text-sm text-muted-foreground"
          >
            &hellip;
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={
              item === page
                ? "inline-flex size-9 items-center justify-center rounded-md border border-primary bg-primary text-sm font-medium text-primary-foreground"
                : "inline-flex size-9 items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            }
          >
            {item}
            <span className="sr-only"> page</span>
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="sr-only">Next page</span>
      </button>
    </nav>
  )
}
