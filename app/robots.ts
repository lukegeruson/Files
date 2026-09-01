import type { MetadataRoute } from "next"
import { absoluteUrl, SITE_URL } from "@/lib/seo"

/**
 * Public site is fully crawlable; only the CMS and its API surface are closed.
 *
 * /admin is Disallow-ed here and also carries `robots: { index: false }` in its
 * page metadata. These are two independent defences, not a combination: a
 * crawler that respects this file never fetches /admin, so it never reads that
 * meta tag. The Disallow is kept deliberately — /admin is auth-gated and 307s
 * to /admin/login, so there is no indexable content behind it and no reason to
 * spend crawl budget there. The meta tag is the fallback for any crawler that
 * ignores robots.txt.
 *
 * The trade-off: because the URL is blocked, Google can still list it as a
 * URL-only result if it finds a link to it. The footer link is `rel="nofollow"`
 * to avoid feeding that discovery from all 224 pages.
 *
 * Note there is intentionally no Disallow for /blog?category=. Those filtered
 * views already carry a canonical pointing at /blog, and a canonical can only
 * be honoured on a URL the crawler is allowed to fetch. Blocking them would
 * suppress the consolidation signal instead of applying it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  }
}
