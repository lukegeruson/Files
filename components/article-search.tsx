"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Search, X } from "lucide-react"
import { PostCard } from "@/components/post-card"
import { Pagination } from "@/components/pagination"
import { filterDocs, type SearchDoc } from "@/lib/search"
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories"

type Props = {
  docs: SearchDoc[]
}

const PER_PAGE = 12

export function ArticleSearch({ docs }: Props) {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [page, setPage] = useState(1)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Category narrows first, then the free-text query runs over what is left, so
  // the two controls compose instead of overriding each other.
  const results = useMemo(() => {
    const inCategory = activeCategory
      ? docs.filter((doc) => doc.post.category === activeCategory)
      : docs
    return filterDocs(inCategory, query, [])
  }, [docs, query, activeCategory])

  const hasQuery = query.trim().length > 0

  const totalPages = Math.max(1, Math.ceil(results.length / PER_PAGE))
  // A narrowing search can leave `page` past the end, so clamp before slicing.
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PER_PAGE

  const visible = results.slice(start, start + PER_PAGE)

  function scrollToResults() {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  /** Editing the query restarts paging, so results are never opened mid-list. */
  function updateQuery(next: string) {
    setQuery(next)
    setPage(1)
  }

  /** Switching category also restarts paging, for the same reason. */
  function selectCategory(next: Category | null) {
    setActiveCategory(next)
    setPage(1)
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages))
    scrollToResults()
  }

  return (
    // `scroll-mt-24` keeps the "Latest articles" heading clear of the 4rem
    // sticky navbar when linked to from a blog post.
    <section
      id="latest-articles"
      ref={resultsRef}
      className="mx-auto max-w-6xl scroll-mt-24 px-4 md:px-6"
    >
      {/* Heading sits left; the search field and "View all" sit together on the
          right, above the results the field filters. */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            {hasQuery ? "Search results" : "Latest articles"}
          </h2>
          <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
            {hasQuery
              ? `${results.length} ${results.length === 1 ? "article" : "articles"} matching “${query.trim()}”`
              : activeCategory
                ? `${results.length} ${CATEGORY_LABELS[activeCategory]} articles`
                : `${docs.length} articles`}
          </p>
        </div>

        {/* Each pill toggles: pressing the active one clears the filter, so no
            separate "All" control is needed and unfiltered is the default. */}
        <div
          role="group"
          aria-label="Filter articles by category"
          className="flex flex-wrap items-center gap-2"
        >
          {CATEGORIES.map((c) => {
            const active = activeCategory === c
            return (
              <CategoryPill
                key={c}
                active={active}
                onClick={() => selectCategory(active ? null : c)}
              >
                {CATEGORY_LABELS[c]}
              </CategoryPill>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              scrollToResults()
            }}
            className="flex-1 sm:w-72 sm:flex-none"
          >
            <label htmlFor="article-search" className="sr-only">
              Search articles
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="article-search"
                type="search"
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter can confirm CJK IME composition; don't submit mid-composition.
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  if (e.key === "Enter") {
                    e.preventDefault()
                    scrollToResults()
                  }
                }}
                placeholder="Search articles"
                aria-controls="article-results"
                className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
              />
              {query.length > 0 ? (
                <button
                  type="button"
                  onClick={() => updateQuery("")}
                  className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                  <span className="sr-only">Clear search</span>
                </button>
              ) : null}
            </div>
          </form>

          <Link
            href="/blog"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div id="article-results">
        {results.length > 0 ? (
          <>
            <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((doc) => (
                <PostCard key={doc.post.id} post={doc.post} />
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <Pagination page={safePage} totalPages={totalPages} onPageChange={goToPage} />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <p className="font-serif text-lg font-semibold">No articles found</p>
            <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
              {activeCategory
                ? `Nothing in ${CATEGORY_LABELS[activeCategory]} matches that search yet. Try a broader word, or browse every category.`
                : "Nothing matches that search yet. Try a broader word like solar, roofing or irrigation."}
            </p>
            <button
              type="button"
              onClick={() => {
                updateQuery("")
                selectCategory(null)
              }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <X className="size-4" aria-hidden="true" />
              {activeCategory ? "Clear filters" : "Clear search"}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
