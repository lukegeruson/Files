import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PostCard } from "@/components/post-card"
import {
  CATEGORIES,
  CATEGORY_LABELS,
  getPosts,
  isCategory,
} from "@/lib/posts"
import { collectionPageSchema, jsonLdProps, pageMetadata } from "@/lib/seo"

// Canonical is the unfiltered /blog for every variant of this route: the
// ?category= views are filtered duplicates of /category/[category], so
// pointing them all here stops near-identical URLs competing with each other.
export const metadata = pageMetadata({
  title: "All articles",
  description:
    "Every article from the Evergreen team on solar, landscaping, renovation, and agriculture — practical guides on costs, planning, and getting the work done.",
  path: "/blog",
})

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const active = category && isCategory(category) ? category : undefined
  const posts = await getPosts({ category: active })

  // Emitted only on the unfiltered view, which is the canonical URL for every
  // variant of this route. The ?category= views render a subset, so describing
  // them would attach a different ItemList to the same canonical @id — two
  // conflicting descriptions of one page. Those views consolidate into /blog
  // anyway, so the canonical view is the only one worth describing.
  const collectionSchema = active
    ? null
    : collectionPageSchema({
        path: "/blog",
        name: "All articles",
        description:
          "Every article from the Evergreen team on solar, landscaping, renovation, and agriculture.",
        items: posts.map((post) => ({
          name: post.title,
          path: `/blog/${post.slug}`,
        })),
      })

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {collectionSchema ? <script {...jsonLdProps(collectionSchema)} /> : null}
        <section className="mx-auto max-w-6xl px-4 pt-16 md:px-6">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            All articles
          </h1>
          <p className="mt-3 text-muted-foreground">
            Browse everything from the Evergreen team, or filter by topic.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <FilterPill href="/blog" active={!active}>
              All
            </FilterPill>
            {CATEGORIES.map((c) => (
              <FilterPill
                key={c}
                href={`/blog?category=${c}`}
                active={active === c}
              >
                {CATEGORY_LABELS[c]}
              </FilterPill>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          {posts.length === 0 ? (
            <p className="text-muted-foreground">No articles here yet.</p>
          ) : (
            <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {/* headingLevel 2: this grid follows the page h1 directly, with
                  no section heading between them, so the default h3 would skip
                  a level. */}
              {posts.map((post) => (
                <PostCard key={post.id} post={post} headingLevel={2} />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  )
}
