import type { MetadataRoute } from "next"
import { CATEGORIES } from "@/lib/categories"
import { CAREERS } from "@/lib/careers/careers"
import { getPostSummaries } from "@/lib/posts"
import { getPublishedCompanies } from "@/lib/companies/companies"
import { absoluteUrl } from "@/lib/seo"

/**
 * Revalidate hourly. The post list comes from Postgres, so without this the
 * sitemap would be captured at build time and never pick up new articles.
 */
export const revalidate = 3600

/**
 * Deliberately excluded:
 *  - /admin/**        private CMS, also Disallow-ed in robots.ts
 *  - /jobs/matches    308 redirect to /jobs/quiz; a sitemap should only list
 *                     final destinations, never redirect hops
 *  - /blog?category=  query-parameter duplicates of /category/[category]
 *  - /category/home-improvement  permanent redirect to /category/renovation
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/blog"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/jobs"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/jobs/tree"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/jobs/quiz"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    {
      url: absoluteUrl("/jobs/openings"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/find-a-pro"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/partners"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/companies"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ]

  const categoryEntries: MetadataRoute.Sitemap = CATEGORIES.map((category) => ({
    url: absoluteUrl(`/category/${category}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }))

  const careerEntries: MetadataRoute.Sitemap = CAREERS.map((career) => ({
    url: absoluteUrl(`/jobs/careers/${career.id}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  // getPostSummaries() already filters to published rows only, so unpublished
  // drafts can never leak into the sitemap.
  let postEntries: MetadataRoute.Sitemap = []
  try {
    const posts = await getPostSummaries()
    postEntries = posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.createdAt),
      changeFrequency: "monthly",
      priority: 0.7,
    }))
  } catch (error) {
    // A database blip should still yield a valid sitemap of static routes
    // rather than a 500, which Search Console would report as a fetch error.
    console.log("[v0] sitemap: could not load posts", error)
  }

  // getPublishedCompanies() returns published rows only, so a draft profile
  // never leaks into the sitemap.
  let companyEntries: MetadataRoute.Sitemap = []
  try {
    const companies = await getPublishedCompanies()
    companyEntries = companies.map((company) => ({
      url: absoluteUrl(`/companies/${company.slug}`),
      lastModified: company.updatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    }))
  } catch (error) {
    console.log("[v0] sitemap: could not load companies", error)
  }

  return [
    ...staticEntries,
    ...categoryEntries,
    ...careerEntries,
    ...postEntries,
    ...companyEntries,
  ]
}
