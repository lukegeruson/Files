import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { absoluteUrl, jsonLdProps } from "@/lib/seo"

export type Crumb = {
  name: string
  /** Omitted on the final crumb, which is the current page. */
  href?: string
}

/**
 * Visible breadcrumb trail plus its matching BreadcrumbList JSON-LD.
 *
 * The markup and the structured data are generated from the same array, so the
 * two can never drift apart — Google treats a BreadcrumbList that doesn't match
 * the visible trail as a structured-data violation.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      // The last crumb intentionally has no `item`: it is the current page.
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  }

  return (
    <>
      <script {...jsonLdProps(schema)} />
      {/* The visible trail is only shown on mobile/tablet. On desktop the main
          top nav already covers navigation, so the mini trail is redundant —
          but the BreadcrumbList JSON-LD above still renders for SEO. */}
      <nav aria-label="Breadcrumb" className="lg:hidden">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {items.map((item, i) => {
            const last = i === items.length - 1
            return (
              <li key={item.name} className="flex items-center gap-1.5">
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {item.name}
                  </span>
                )}
                {!last && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
