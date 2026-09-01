import type { Metadata } from "next"

/**
 * Single source of truth for everything canonical. Every sitemap entry, OG
 * URL, and JSON-LD `@id` derives from SITE_URL, so the production hostname is
 * defined in exactly one place.
 *
 * This is deliberately a hardcoded constant rather than VERCEL_URL: that env
 * var holds the per-deployment preview hostname, so using it would emit
 * preview URLs into production canonicals and leak duplicate content.
 */
export const SITE_URL = "https://www.evergreen.builders"

export const SITE_NAME = "Evergreen Builders"

/** The tagline already shown in the site footer. */
export const SITE_TAGLINE = "Explore the Horizon. Make Better Decisions."

/** Contact address already published on the careers page. */
export const SITE_EMAIL = "lukegeruson@hey.com"

export const SITE_DESCRIPTION =
  "Calculators, guides, and career maps for solar, landscaping, renovation, and agriculture — built to help you make better decisions about your home and your work."

/** Absolute URL for a site-relative path. Guarantees a single leading slash. */
export function absoluteUrl(path = "/"): string {
  if (!path.startsWith("/")) path = `/${path}`
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`
}

/**
 * The brand suffix the root layout's title template appends, and roughly the
 * width Google renders before truncating a title in results.
 *
 * The suffix costs 21 characters. Applied unconditionally it pushed most pages
 * past the limit, so the brand was the first thing cut — the worst possible
 * outcome, since it spent budget that the page's own topic needed and then
 * failed to display anyway.
 */
const BRAND_SUFFIX = ` — ${SITE_NAME}`
const TITLE_BUDGET = 60

/**
 * Decides whether a page can afford the brand suffix.
 *
 * Returns a plain string when it fits, letting the root template append the
 * brand as usual; returns `{ absolute }` when it does not, which opts that page
 * out of the template so the whole budget goes to the page's own title.
 *
 * This only controls the `<title>` element. Open Graph and Twitter titles keep
 * the bare page title in every case, and no title text is rewritten or
 * truncated here — a title longer than the budget on its own is a content
 * issue, not something to fix by clipping mid-word.
 */
export function brandedTitle(title: string): string | { absolute: string } {
  return title.length + BRAND_SUFFIX.length <= TITLE_BUDGET ? title : { absolute: title }
}

/**
 * Builds a page's metadata with a canonical URL plus matching Open Graph and
 * Twitter cards.
 *
 * `alternates.canonical` is set per page rather than globally because a single
 * site-wide canonical would point every URL at the homepage and de-index the
 * rest of the site. Relative values resolve against `metadataBase` in the root
 * layout, which is what keeps the www/HTTPS form consistent.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  images,
  noIndex = false,
}: {
  title: string
  description: string
  path: string
  type?: "website" | "article"
  publishedTime?: string
  images?: string[]
  noIndex?: boolean
}): Metadata {
  const url = absoluteUrl(path)
  const ogImages = images?.map((src) => (src.startsWith("http") ? src : absoluteUrl(src)))

  return {
    // Drops the brand suffix on pages whose own title already fills the SERP
    // budget. See brandedTitle above.
    title: brandedTitle(title),
    description,
    alternates: { canonical: url },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: "en_US",
      ...(publishedTime ? { publishedTime } : {}),
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImages ? { images: ogImages } : {}),
    },
  }
}

/**
 * Organization and WebSite graph for the site root.
 *
 * Intentionally omits address, telephone, founding date, ratings, and reviews:
 * none of those are published on the site, and inventing them would be both
 * false and a structured-data policy violation. For the same reason this is
 * Organization rather than LocalBusiness — LocalBusiness expects a physical
 * address this business has not published.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_TAGLINE,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/icon.svg"),
        },
        contactPoint: {
          "@type": "ContactPoint",
          email: SITE_EMAIL,
          contactType: "careers",
          availableLanguage: "English",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en-US",
      },
    ],
  }
}

/**
 * CollectionPage + ItemList for a page whose purpose is to list articles
 * (`/blog` and each `/category/[category]`).
 *
 * Shared by both templates so the two listing pages cannot describe themselves
 * differently. Every item is a real, visible link on the page, and the list is
 * built from the same array the page renders — so the markup cannot drift from
 * the content the way a hand-maintained list would.
 *
 * Deliberate omissions:
 * - No `itemListOrder`. That would assert a specific sort the page does not
 *   state, and the ordering is not part of what a reader sees.
 * - No `datePublished` / `author` on the ListItems. Those belong to each
 *   article's own BlogPosting node on the article page, and repeating them here
 *   would duplicate the same claim in two places with no way to keep them in
 *   sync.
 * - No `numberOfItems` beyond the items actually emitted, so the count can
 *   never overstate the list.
 */
export function collectionPageSchema({
  path,
  name,
  description,
  items,
}: {
  path: string
  name: string
  description: string
  items: { name: string; path: string }[]
}) {
  const url = absoluteUrl(path)

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name,
    description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-US",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  }
}

/** Renders a JSON-LD block. Callers pass an already-built schema object. */
export function jsonLdProps(schema: unknown) {
  return {
    type: "application/ld+json" as const,
    dangerouslySetInnerHTML: { __html: JSON.stringify(schema) },
  }
}
