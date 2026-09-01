import { PaginatedPosts } from "@/components/paginated-posts"
import { getPostSummaries } from "@/lib/posts"

/** Anchor so links can deep-link straight to the reading list. */
export const JOBS_READING_ANCHOR = "jobs-reading"

/**
 * The "More on Jobs" reading list, rendered identically at the foot of every
 * page in the jobs section.
 *
 * The Jobs collection has no category route of its own, so this section is the
 * only way into those posts. It pages six at a time via the same control the
 * category pages use, which keeps the footer a fixed height everywhere instead
 * of running long on one page and short on the others.
 */
export async function JobsReading() {
  const posts = await getPostSummaries({ tag: "jobs" })
  if (posts.length === 0) return null

  return (
    <section
      id={JOBS_READING_ANCHOR}
      className="scroll-mt-24 border-t border-border bg-secondary/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          More on Jobs
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Learn more about entry level apprenticeships.
        </p>
        <div className="mt-8">
          <PaginatedPosts posts={posts} />
        </div>
      </div>
    </section>
  )
}
