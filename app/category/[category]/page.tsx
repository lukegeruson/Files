import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { SiteFooter } from "@/components/site-footer"
import { PaginatedPosts } from "@/components/paginated-posts"
import { SolarTools } from "@/components/solar-tools"
import { SolarGuideContent } from "@/components/solar-guide-content"
import { LandscapingTools } from "@/components/landscaping-tools"
import { LandscapingGuideContent } from "@/components/landscaping-guide-content"
import { RenovationTools } from "@/components/renovation-tools"
import { RenovationGuideContent } from "@/components/renovation-guide-content"
import { AgricultureTools } from "@/components/agriculture-tools"
import { AgricultureGuideContent } from "@/components/agriculture-guide-content"
import {
  CATEGORIES,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  getPostSummaries,
  isCategory,
} from "@/lib/posts"
import type { Category } from "@/lib/categories"
import { pageMetadata } from "@/lib/seo"

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }))
}

/**
 * Per-category page-level titles and descriptions. Each is unique so the four
 * category landing pages — the site's most important organic-search surfaces —
 * do not compete with one another or with the homepage.
 *
 * Every title already carries its own brand suffix ("| Evergreen"), so
 * generateMetadata opts these out of the root layout's title template to avoid
 * a doubled brand name. The description feeds both the meta description and the
 * Open Graph / Twitter cards via pageMetadata.
 */
const CATEGORY_SEO: Record<Category, { title: string; description: string }> = {
  solar: {
    title: "Free Solar Calculators | Evergreen",
    description:
      "Use free solar calculators and visual guides to estimate solar costs, system size, energy production, savings, payback periods, and more.",
  },
  landscaping: {
    title: "Free Landscaping Calculators | Evergreen",
    description:
      "Use free landscaping calculators and visual guides for mulch, soil, gravel, lawn, irrigation, plants, project costs, and other yard projects.",
  },
  renovation: {
    title: "Free Home Renovation Calculators | Evergreen",
    description:
      "Plan home improvement projects with free renovation calculators, cost estimators, visual guides, diagrams, and remodeling resources.",
  },
  agriculture: {
    title: "Free Agriculture Calculators | Evergreen",
    description:
      "Explore free agriculture calculators, farming tools, visual diagrams, and guides for land, crops, irrigation, equipment, costs, and planning.",
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  // The page itself calls notFound() for this case, so the metadata here only
  // needs to avoid emitting a canonical for a URL that will 404.
  if (!isCategory(category)) return { title: "Not found" }

  const seo = CATEGORY_SEO[category] ?? {
    title: `${CATEGORY_LABELS[category]} — Evergreen Journal`,
    description: CATEGORY_DESCRIPTIONS[category],
  }

  return {
    ...pageMetadata({
      title: seo.title,
      description: seo.description,
      path: `/category/${category}`,
    }),
    // These titles are already tuned and carry their own brand suffix, so opt
    // out of the root template rather than appending a second one.
    title: { absolute: seo.title },
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  if (!isCategory(category)) notFound()

  // Summaries, not full posts: this list now feeds a client component, and the
  // article bodies would otherwise be serialized into the page payload unused.
  const posts = await getPostSummaries({ category })

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Visually hidden: keeps a single descriptive H1 for assistive tech and SEO
            now that the visible category header has been removed. */}
        <h1 className="sr-only">{CATEGORY_LABELS[category]}</h1>

        {/* Secondary category nav (breadcrumb + sibling links). Redundant on
            desktop where the main SiteHeader nav already covers it, so it's
            hidden there and kept for mobile. The Breadcrumbs JSON-LD stays in
            the DOM regardless (display:none doesn't strip structured data). */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-8 md:px-6 lg:hidden">
          <Breadcrumbs
            items={[{ name: "Home", href: "/" }, { name: CATEGORY_LABELS[category] }]}
          />
          {/* Quick links to the sibling category pages so visitors can hop
              between guides without going back to the home page. */}
          <nav aria-label="Other categories" className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {CATEGORIES.filter((c) => c !== category).map((c) => (
              <a
                key={c}
                href={`/category/${c}`}
                className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {CATEGORY_LABELS[c]}
              </a>
            ))}
          </nav>
        </div>

        {category === "solar" ? (
          <>
            <section className="mx-auto max-w-6xl px-4 pt-8 md:px-6">
              <SolarTools />
            </section>
            <section className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
              <SolarGuideContent />
            </section>
            <div className="mx-auto mt-16 max-w-6xl px-4 md:px-6">
              <div className="border-t border-border" />
            </div>
          </>
        ) : null}

        {category === "landscaping" ? (
          <>
            <section className="mx-auto max-w-6xl px-4 pt-8 md:px-6">
              <LandscapingTools />
            </section>
            <section className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
              <LandscapingGuideContent />
            </section>
            <div className="mx-auto mt-16 max-w-6xl px-4 md:px-6">
              <div className="border-t border-border" />
            </div>
          </>
        ) : null}

        {category === "renovation" ? (
          <>
            <section className="mx-auto max-w-6xl px-4 pt-8 md:px-6">
              <RenovationTools />
            </section>
            <section className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
              <RenovationGuideContent />
            </section>
            <div className="mx-auto mt-16 max-w-6xl px-4 md:px-6">
              <div className="border-t border-border" />
            </div>
          </>
        ) : null}

        {category === "agriculture" ? (
          <>
            <section className="mx-auto max-w-6xl px-4 pt-8 md:px-6">
              <AgricultureTools />
            </section>
            <section className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
              <AgricultureGuideContent />
            </section>
            <div className="mx-auto mt-16 max-w-6xl px-4 md:px-6">
              <div className="border-t border-border" />
            </div>
          </>
        ) : null}

        {/* Scroll target for the "Blog" link in each category's tool switcher.
            `scroll-mt-24` keeps the heading clear of the 4rem sticky header. */}
        <section
          id="category-posts"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 md:px-6"
        >
          {posts.length > 0 ? (
            <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight">
              More on {CATEGORY_LABELS[category].toLowerCase()}
            </h2>
          ) : null}
          {posts.length === 0 ? (
            <p className="text-muted-foreground">
              No articles in this category yet.
            </p>
          ) : (
            <PaginatedPosts posts={posts} />
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
