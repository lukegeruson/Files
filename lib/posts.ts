// Data layer for the blog CMS, backed by Neon Postgres via Drizzle.
// The exported types and function signatures are identical to the previous
// in-memory version, so pages and the admin UI need no changes.

import { and, arrayContains, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { posts, type PostRow } from "@/lib/db/schema"
import {
  type Category,
  type Post,
  type PostInput,
  type PostTag,
  isCategory,
  isPostTag,
} from "@/lib/categories"

// Re-export the pure category constants and types so existing
// `@/lib/posts` imports in server components keep working unchanged.
export {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_HOME_TEASERS,
  POST_TAGS,
  POST_TAG_LABELS,
  isCategory,
  isPostTag,
} from "@/lib/categories"
export type { Category, Post, PostInput, PostTag } from "@/lib/categories"

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: (isCategory(row.category) ? row.category : "solar") as Category,
    tags: row.tags.filter(isPostTag),
    excerpt: row.excerpt,
    content: row.content,
    author: row.author,
    coverImage: row.coverImage,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// --- Query helpers ---------------------------------------------------------

export async function getPosts(options?: {
  category?: Category
  includeUnpublished?: boolean
}): Promise<Post[]> {
  const filters = []
  if (!options?.includeUnpublished) filters.push(eq(posts.published, true))
  if (options?.category) filters.push(eq(posts.category, options.category))

  const rows = await db
    .select()
    .from(posts)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(posts.createdAt))

  return rows.map(toPost)
}

/**
 * Listing-only projection: every column a card or the article search needs,
 * minus the `content` body. Article bodies are ~830 KB across the catalog, so
 * omitting them keeps the homepage query small and its render fast.
 */
export type PostSummary = {
  id: string
  title: string
  slug: string
  category: Category
  excerpt: string
  coverImage: string
  createdAt: string
}

export async function getPostSummaries(options?: {
  category?: Category
  /** Secondary tag, e.g. "jobs". Additive to (not a substitute for) category. */
  tag?: PostTag
}): Promise<PostSummary[]> {
  const filters = [eq(posts.published, true)]
  if (options?.category) filters.push(eq(posts.category, options.category))
  if (options?.tag) filters.push(arrayContains(posts.tags, [options.tag]))

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      category: posts.category,
      excerpt: posts.excerpt,
      coverImage: posts.coverImage,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(...filters))
    .orderBy(desc(posts.createdAt))

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: (isCategory(row.category) ? row.category : "solar") as Category,
    excerpt: row.excerpt,
    coverImage: row.coverImage,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const [row] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1)
  return row ? toPost(row) : null
}

export async function getPostById(id: string): Promise<Post | null> {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  return row ? toPost(row) : null
}

async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "post"
  let slug = base
  let n = 1
  // Loop until we find a slug not used by another row.
  while (true) {
    const [existing] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1)
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${n++}`
  }
}

export async function createPost(input: PostInput): Promise<Post> {
  const slug = await uniqueSlug(input.title)
  const [row] = await db
    .insert(posts)
    .values({
      title: input.title,
      slug,
      category: input.category,
      tags: input.tags ?? [],
      excerpt: input.excerpt,
      content: input.content,
      author: input.author || "Evergreen Team",
      coverImage: input.coverImage || "/blog/placeholder-cover.png",
      published: input.published,
    })
    .returning()
  return toPost(row)
}

export async function updatePost(
  id: string,
  input: PostInput,
): Promise<Post | null> {
  const slug = await uniqueSlug(input.title, id)
  const values: Partial<PostRow> = {
    title: input.title,
    slug,
    category: input.category,
    tags: input.tags ?? [],
    excerpt: input.excerpt,
    content: input.content,
    author: input.author || "Evergreen Team",
    published: input.published,
    updatedAt: new Date(),
  }
  if (input.coverImage) values.coverImage = input.coverImage

  const [row] = await db
    .update(posts)
    .set(values)
    .where(eq(posts.id, id))
    .returning()
  return row ? toPost(row) : null
}

export async function deletePost(id: string): Promise<boolean> {
  const rows = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id })
  return rows.length > 0
}
