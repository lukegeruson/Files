"use client"

import { useRef, useState } from "react"
import { PostCard } from "@/components/post-card"
import { Pagination } from "@/components/pagination"
import type { PostSummary } from "@/lib/posts"

const PER_PAGE = 6

type Props = {
  posts: PostSummary[]
}

/**
 * Category article grid, six per page.
 *
 * Renovation carries 46 articles, so paging keeps the section from burying the
 * calculators and guide above it.
 */
export function PaginatedPosts({ posts }: Props) {
  const [page, setPage] = useState(1)
  const gridRef = useRef<HTMLDivElement>(null)

  const totalPages = Math.max(1, Math.ceil(posts.length / PER_PAGE))
  // Guard against a stale page if the post list ever shrinks beneath it.
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PER_PAGE

  const visible = posts.slice(start, start + PER_PAGE)

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages))
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={gridRef} className="scroll-mt-24">
      <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Pagination page={safePage} totalPages={totalPages} onPageChange={goToPage} />
      </div>
    </div>
  )
}
