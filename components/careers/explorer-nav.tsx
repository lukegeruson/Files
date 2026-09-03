"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/jobs", label: "Overview" },
  { href: "/jobs/tree", label: "Skill Tree" },
  // Quiz and matches are one destination: finishing the quiz swaps to results
  // in place, so splitting them into two tabs advertised a navigation step
  // that no longer exists.
  { href: "/jobs/quiz", label: "Matches" },
  { href: "/jobs/openings", label: "Companies" },
] as const

/**
 * Sub-nav for the career explorer. Lives here rather than in the site header
 * because that header is the blog's category nav — mixing the two products
 * would leave every reader staring at explorer links they didn't ask for.
 */
export function ExplorerNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Career explorer"
      className="border-b border-border bg-background/60"
    >
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 md:px-6">
        {LINKS.map((link) => {
          // "Overview" is an exact match, otherwise every route would light it.
          // Individual career pages live under /jobs/careers/* but are reached
          // by browsing, so they keep "Skill Tree" lit rather than nothing.
          const active =
            link.href === "/jobs"
              ? pathname === "/jobs"
              : link.href === "/jobs/tree"
                ? pathname.startsWith("/jobs/tree") ||
                  pathname.startsWith("/jobs/careers")
                : pathname.startsWith(link.href)

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
