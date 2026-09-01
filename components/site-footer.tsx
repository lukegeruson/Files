import Link from "next/link"
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories"

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <p className="font-serif text-base font-semibold">Evergreen Builders</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore the Horizon. Make Better Decisions.
          </p>
        </div>
        <nav aria-label="Footer categories" className="flex flex-wrap gap-x-6 gap-y-2">
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
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <p className="py-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Evergreen Builders. All rights reserved.
          </p>
          {/* Deliberately still points at /admin, not /admin/login. The right
              destination depends on the session: a signed-in admin gets the
              dashboard at /admin directly, while /admin/login would bounce them
              back to /admin. Hard-coding the login URL would therefore *create*
              a redirect rather than remove one.

              rel="nofollow" is here because this is the one internal link on
              the site that targets a URL which always redirects for an
              anonymous crawler (307 -> /admin/login). The path is already
              Disallow-ed in robots.ts, so nofollow just stops crawlers
              queueing it from all 224 pages that render this footer. */}
          <Link
            href="/admin"
            rel="nofollow"
            className="flex min-h-11 items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  )
}
