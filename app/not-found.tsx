import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/posts"

// Next already emits `noindex` and a real 404 status for this route, so only
// the title is set here — adding a `robots` key would duplicate the meta tag.
export const metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-2xl px-4 py-24 md:px-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Error 404</p>
          <h1 className="mt-3 text-balance font-serif text-4xl font-semibold tracking-tight md:text-5xl">
            We couldn&apos;t find that page
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            The link may be broken or the page may have moved. Here are the places most people are
            looking for.
          </p>

          {/* Real internal links rather than a dead end: gives readers a route
              onward and lets crawlers keep moving through the site. */}
          <nav aria-label="Suggested pages" className="mt-8 flex flex-col gap-3">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/category/${category}`}
                className="group flex items-baseline justify-between gap-4 border-b border-border pb-3 text-sm transition-colors hover:text-primary"
              >
                <span className="font-medium">{CATEGORY_LABELS[category]}</span>
                <span className="text-muted-foreground">Calculators and guides</span>
              </Link>
            ))}
            <Link
              href="/jobs"
              className="group flex items-baseline justify-between gap-4 border-b border-border pb-3 text-sm transition-colors hover:text-primary"
            >
              <span className="font-medium">Career paths</span>
              <span className="text-muted-foreground">Explore trade careers</span>
            </Link>
          </nav>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Back to home
            </Link>
            <Link
              href="/blog"
              className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm font-medium transition-colors hover:border-primary"
            >
              Browse all articles
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
