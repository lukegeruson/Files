import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ArticleSearch } from "@/components/article-search"
import {
  CATEGORIES,
  CATEGORY_HOME_TEASERS,
  CATEGORY_LABELS,
  getPostSummaries,
} from "@/lib/posts"
import { buildSearchDocs } from "@/lib/search"
import { pageMetadata, SITE_NAME, SITE_TAGLINE } from "@/lib/seo"

// `title.absolute` opts out of the root template, so the homepage reads as the
// brand itself rather than "Home — Evergreen Builders".
export const metadata = {
  ...pageMetadata({
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Free calculators and guides for solar, landscaping, renovation, and agriculture. Work out what a project costs before you commit, and explore skilled trade careers in each field.",
    path: "/",
  }),
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
}

export default async function HomePage() {
  // Listing projection: omits article bodies, so the query stays small.
  const posts = await getPostSummaries()
  // Search index built server-side; the docs sent to the browser carry no
  // article bodies.
  const docs = buildSearchDocs(posts)

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Intro */}
        <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Education
          </p>
          <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Explore the Horizon. <br />
            Make Better Decisions.
          </h1>
          <p className="mt-4 max-w-3xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Do you know how much it costs to go solar? Want to renovate your front yard? Looking to
            upgrade your home? Explore our tools to make better decisions about your property.
          </p>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-6xl px-4 pb-8 pt-8 md:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/category/${category}`}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                {/* h2, not h3: these four cards are the top-level sections of
                    the homepage and they precede the "Latest articles" h2, so
                    marking them h3 skipped a level and implied they were
                    subsections of something that never existed. The classes are
                    unchanged, so this is a semantics-only fix. */}
                <h2 className="font-serif text-lg font-semibold">
                  {CATEGORY_LABELS[category]}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {CATEGORY_HOME_TEASERS[category].question}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {CATEGORY_HOME_TEASERS[category].tool}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Browse
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Search field sits in the articles header, beside "Latest articles". */}
        <ArticleSearch docs={docs} />
      </main>
      <SiteFooter />
    </div>
  )
}
