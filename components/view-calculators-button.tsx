"use client"

import { ChevronDown } from "lucide-react"

/**
 * Small header action shown next to each explorer's title. It smooth-scrolls
 * the page down to that category's calculator switcher, whose element carries
 * the matching `targetId` (with `scroll-mt-24` so it clears the sticky header).
 */
export function ViewCalculatorsButton({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ring hover:bg-accent"
    >
      View Calculator
      <ChevronDown className="size-3.5" aria-hidden="true" />
    </button>
  )
}
