import Image from "next/image"
import Link from "next/link"
import { CategoryBadge } from "@/components/category-badge"
import { formatDate } from "@/lib/format"
import type { Post } from "@/lib/categories"

// Only the fields actually rendered below, so the card also accepts the
// content-free post summaries used by the client-side article search.
type PostCardPost = Pick<
  Post,
  "title" | "slug" | "excerpt" | "category" | "coverImage" | "createdAt"
>

/**
 * `headingLevel` exists because this card is reused under different section
 * structures. On the homepage and on category pages the grid sits beneath an
 * h2 ("Latest articles", "Related articles"), so h3 is correct. On /blog the
 * cards follow the page h1 with no intervening section heading, which made h3
 * a skipped level. Callers in that position pass 2.
 */
export function PostCard({
  post,
  headingLevel = 3,
}: {
  post: PostCardPost
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3"

  return (
    <article className="group flex flex-col">
      <Link
        href={`/blog/${post.slug}`}
        className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted"
      >
        <Image
          src={post.coverImage || "/blog/placeholder-cover.png"}
          alt=""
          fill
          // Measured slot widths: full-bleed in the single-column layout,
          // ~340px in the two-column band, and capped around 350px once the
          // container stops growing. The old flat "33vw" asked for ~530px on a
          // wide desktop for a slot that never exceeds ~350px.
          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 360px"
          // Cards sit below the fold on article pages, so the browser default
          // of lazy loading is what we want here.
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <CategoryBadge category={post.category} />
          <time className="text-xs text-muted-foreground" dateTime={post.createdAt}>
            {formatDate(post.createdAt)}
          </time>
        </div>
        <Heading className="text-balance font-serif text-xl font-semibold leading-snug">
          <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-primary">
            {post.title}
          </Link>
        </Heading>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
      </div>
    </article>
  )
}
