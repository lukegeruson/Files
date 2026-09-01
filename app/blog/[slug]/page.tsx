import Image from "next/image"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PostCard } from "@/components/post-card"
import { CategoryBadge } from "@/components/category-badge"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { formatDate } from "@/lib/format"
import { CATEGORY_LABELS, getPostBySlug, getPosts } from "@/lib/posts"
import { absoluteUrl, jsonLdProps, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo"

// Parse inline Markdown within a line of text: **bold**, *italic* / _italic_,
// `code`, and [links](url). Returns an array of React nodes so pasted
// formatting is preserved instead of showing raw asterisks/underscores.
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Ordered so bold (**) is matched before single-char italic (*).
  const pattern =
    /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }

    if (match[2] !== undefined || match[4] !== undefined) {
      nodes.push(<strong key={key++}>{match[2] ?? match[4]}</strong>)
    } else if (match[6] !== undefined || match[8] !== undefined) {
      nodes.push(<em key={key++}>{match[6] ?? match[8]}</em>)
    } else if (match[10] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
        >
          {match[10]}
        </code>,
      )
    } else if (match[12] !== undefined) {
      nodes.push(
        <a
          key={key++}
          href={match[13]}
          className="font-medium text-foreground underline underline-offset-4"
          target={match[13].startsWith("http") ? "_blank" : undefined}
          rel={
            match[13].startsWith("http") ? "noopener noreferrer" : undefined
          }
        >
          {match[12]}
        </a>,
      )
    }

    last = pattern.lastIndex
  }

  if (last < text.length) {
    nodes.push(text.slice(last))
  }

  return nodes
}

// Render plain-text/Markdown article content into styled elements.
// Parsing is line-by-line (not blank-line-separated blocks) so headings and
// list items pasted from other tools are detected even when they sit directly
// above/below other content with no blank line between them.
//
// The article title is the page's single H1, so content headings are demoted:
// whatever the shallowest heading in the post is becomes h2, the next level h3,
// and anything deeper h4.
//
// The offset is derived from the content rather than fixed at "# -> h2" because
// posts are not consistent about where they start. Most begin their sections at
// "#", but some begin at "##", and under a fixed mapping those rendered as h3
// directly beneath the h1 — a skipped level that misrepresents the article's
// outline to crawlers and screen readers. Normalising by the shallowest heading
// present means both conventions produce a correct h1 -> h2 -> h3 outline, and
// posts written either way stay correct without editing the content.
function renderContent(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n")

  // Shallowest heading level in this post; drives the demotion offset below.
  let shallowest = 6
  for (const rawLine of lines) {
    const m = rawLine.trim().match(/^(#{1,6})\s+\S/)
    if (m && m[1].length < shallowest) shallowest = m[1].length
  }
  const nodes: React.ReactElement[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listType: "ul" | "ol" | null = null
  let key = 0

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const text = paragraph.join(" ").trim()
    paragraph = []
    if (!text) return
    nodes.push(
      <p key={key++} className="text-pretty">
        {renderInline(text)}
      </p>,
    )
  }

  const flushList = () => {
    if (listItems.length === 0) return
    const items = listItems
    const type = listType
    listItems = []
    listType = null
    const itemNodes = items.map((item, i) => (
      <li key={i} className="pl-1.5 text-pretty">
        {renderInline(item)}
      </li>
    ))
    if (type === "ol") {
      nodes.push(
        <ol
          key={key++}
          className="flex list-decimal flex-col gap-2 pl-6 marker:text-muted-foreground"
        >
          {itemNodes}
        </ol>,
      )
    } else {
      nodes.push(
        <ul
          key={key++}
          className="flex list-disc flex-col gap-2 pl-6 marker:text-muted-foreground"
        >
          {itemNodes}
        </ul>,
      )
    }
  }

  const flushAll = () => {
    flushParagraph()
    flushList()
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushAll()
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushAll()
      // Rebase so the post's shallowest heading renders as h2.
      const level = heading[1].length - shallowest + 1
      const text = heading[2].trim()
      if (level === 1) {
        nodes.push(
          <h2
            key={key++}
            className="mt-4 text-balance font-serif text-3xl font-semibold leading-tight tracking-tight"
          >
            {renderInline(text)}
          </h2>,
        )
      } else if (level === 2) {
        nodes.push(
          <h3
            key={key++}
            className="mt-2 text-balance font-serif text-2xl font-semibold leading-snug tracking-tight"
          >
            {renderInline(text)}
          </h3>,
        )
      } else {
        nodes.push(
          <h4
            key={key++}
            className="mt-2 text-balance font-serif text-xl font-semibold leading-snug tracking-tight"
          >
            {renderInline(text)}
          </h4>,
        )
      }
      continue
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      if (listType && listType !== "ul") flushList()
      listType = "ul"
      listItems.push(bullet[1].trim())
      continue
    }

    const ordered = line.match(/^\d+[.)]\s+(.*)$/)
    if (ordered) {
      flushParagraph()
      if (listType && listType !== "ol") flushList()
      listType = "ol"
      listItems.push(ordered[1].trim())
      continue
    }

    const image = line.match(/^!\[(.*?)\]\((.*?)\)$/)
    if (image) {
      flushAll()
      const alt = image[1]
      const src = image[2]
      nodes.push(
        <figure key={key++} className="my-2">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
            <Image
              src={src || "/blog/placeholder-cover.png"}
              alt={alt}
              fill
              // Same 720px column as the cover. In-body figures are always
              // below the fold, so these keep the default lazy loading.
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
            />
          </div>
          {alt && (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">
              {alt}
            </figcaption>
          )}
        </figure>,
      )
      continue
    }

    // A regular text line ends any open list before starting a paragraph.
    flushList()
    paragraph.push(line)
  }

  flushAll()
  return nodes
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  // Unpublished drafts are reachable by slug but must never be indexed, so
  // they get a noindex alongside the 404 the page itself renders.
  if (!post || !post.published) {
    return { title: "Not found", robots: { index: false, follow: false } }
  }
  return pageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.createdAt,
    images: [post.coverImage || "/blog/placeholder-cover.png"],
  })
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post || !post.published) notFound()

  const related = (await getPosts({ category: post.category }))
    .filter((p) => p.id !== post.id)
    .slice(0, 3)

  // Only fields the post actually carries. No fabricated ratings, word counts,
  // or review data; `author` falls back to the team name used at write time.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": absoluteUrl(`/blog/${post.slug}#article`),
    headline: post.title,
    description: post.excerpt,
    image: absoluteUrl(post.coverImage || "/blog/placeholder-cover.png"),
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.author || SITE_NAME },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    articleSection: CATEGORY_LABELS[post.category],
    inLanguage: "en-US",
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 pt-12 md:px-6">
          <script {...jsonLdProps(articleSchema)} />

          {/* Replaces a bare "All articles" back-link: this exposes the real
              Home > Category > Article hierarchy to both readers and crawlers,
              and adds an internal link to the category hub. */}
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: CATEGORY_LABELS[post.category], href: `/category/${post.category}` },
              { name: post.title },
            ]}
          />

          <header className="mt-6">
            <div className="flex items-center gap-3">
              <CategoryBadge category={post.category} />
              <time
                className="text-sm text-muted-foreground"
                dateTime={post.createdAt}
              >
                {formatDate(post.createdAt)}
              </time>
            </div>
            <h1 className="mt-4 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              {post.title}
            </h1>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          </header>

          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
            <Image
              src={post.coverImage || "/blog/placeholder-cover.png"}
              // The cover is the article's lead image and carries meaning, so
              // it needs a real alt rather than being treated as decorative.
              alt={post.title}
              fill
              // This cover is the LCP element, so it must never be lazy
              // loaded. `priority` is deprecated as of Next 16; eager loading
              // plus a high fetch priority is the documented replacement.
              loading="eager"
              fetchPriority="high"
              // The column caps at 720px, so asking for 768px was fetching a
              // wider variant than the layout can ever display.
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
            />
          </div>

          <div className="mt-10 flex flex-col gap-6 text-lg leading-relaxed">
            {renderContent(post.content)}
          </div>
        </article>

        {related.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pt-20 md:px-6">
            <h2 className="mb-8 font-serif text-2xl font-semibold tracking-tight">
              More in {post.category.replace("-", " ")}
            </h2>
            <div className="grid gap-x-8 gap-y-12 md:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
