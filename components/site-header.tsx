"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AcornLogo } from "@/components/acorn-logo"
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories"
import { cn } from "@/lib/utils"

/** Always keep the header visible within this distance of the top. */
const REVEAL_ZONE = 80
/** Ignore scroll jitter below this many pixels. */
const THRESHOLD = 8

export function SiteHeader() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const frame = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY

    const update = () => {
      frame.current = 0
      // Clamp to avoid iOS rubber-band overscroll flipping the direction.
      const y = Math.max(0, window.scrollY)
      const delta = y - lastY.current

      if (Math.abs(delta) < THRESHOLD) return
      lastY.current = y

      setHidden(y > REVEAL_ZONE && delta > 0)
    }

    const onScroll = () => {
      if (frame.current) return
      frame.current = requestAnimationFrame(update)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  return (
    <header
      // Reveal when a keyboard user tabs into the hidden header.
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        hidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <AcornLogo className="size-5" />
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">
            Evergreen
          </span>
        </Link>

        <nav
          aria-label="Categories"
          className="hidden items-center gap-6 md:flex"
        >
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/category/${category}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {CATEGORY_LABELS[category]}
            </Link>
          ))}
        </nav>

        <Link
          href="/jobs"
          className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Jobs
        </Link>
      </div>
    </header>
  )
}
