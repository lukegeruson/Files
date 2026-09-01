"use client"

import type { MouseEvent } from "react"

const TARGET_ID = "category-posts"

/**
 * Subtle "Blog" affordance that sits beside the calculator tabs on a category
 * hub and scrolls down to that category's article list.
 *
 * Deliberately styled as plain text rather than a bordered pill so it reads as
 * secondary navigation next to the tool tabs instead of competing with them for
 * a third tab.
 *
 * It stays a real anchor so the link is keyboard focusable, right-clickable and
 * still works before hydration; the click handler only upgrades the native jump
 * to a smooth scroll, matching how the rest of the page moves.
 */
export function JumpToPostsLink() {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(TARGET_ID)
    if (!target) return

    event.preventDefault()
    target.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <a
      href={`#${TARGET_ID}`}
      onClick={onClick}
      className="inline-flex items-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Blog
    </a>
  )
}
