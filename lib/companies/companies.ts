// Data access for participating company profiles. SERVER ONLY.
//
// Company profiles are supporting infrastructure for two flows:
//   - Find a Professional matches consumer leads against published companies.
//   - Partner with Evergreen is how a company eventually gets a profile.
//
// Only `published` rows are ever returned to the public or used for matching,
// so a draft can be prepared without leaking a page or creating a false match.

import { and, asc, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { companies, type CompanyRow } from "@/lib/db/schema"
import { isCategory, type Category } from "@/lib/categories"

/**
 * Plain, serialisable summary safe to hand a client component (e.g. the
 * post-submission match list on /find-a-pro). Deliberately omits contact
 * details — those live on the profile page, reached via the slug.
 */
export type CompanyMatch = {
  id: string
  name: string
  slug: string
  industry: string
  description: string
  website: string | null
  services: string[]
}

export function toMatch(row: CompanyRow): CompanyMatch {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    description: row.description,
    website: row.website,
    services: row.services,
  }
}

/**
 * URL-safe slug from a company name. Not guaranteed unique on its own — callers
 * that insert must handle the unique constraint on `slug`.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Public directory: published only, alphabetical. */
export async function getPublishedCompanies(): Promise<CompanyRow[]> {
  return db
    .select()
    .from(companies)
    .where(eq(companies.published, true))
    .orderBy(asc(companies.name))
}

/** Public profile lookup. Returns null for a missing or unpublished slug. */
export async function getPublishedCompanyBySlug(slug: string): Promise<CompanyRow | null> {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.slug, slug), eq(companies.published, true)))
    .limit(1)
  return row ?? null
}

/** Everything, including drafts, for the admin list. */
export async function getAllCompanies(): Promise<CompanyRow[]> {
  return db.select().from(companies).orderBy(desc(companies.updatedAt))
}

export async function getCompanyById(id: string): Promise<CompanyRow | null> {
  const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1)
  return row ?? null
}

/**
 * Companies that could serve a lead: published lead-partners in the same trade
 * whose service ZIPs include the lead's ZIP.
 *
 * Returns [] when nothing genuinely matches — the caller must never imply a
 * match exists, so this errs toward showing none rather than a loose guess.
 */
export async function matchCompaniesForLead(
  category: Category,
  zip: string,
): Promise<CompanyMatch[]> {
  const rows = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.published, true),
        eq(companies.leadPartner, true),
        eq(companies.industry, category),
        // Postgres array containment: the company serves this ZIP.
        sql`${companies.zips} @> ARRAY[${zip}]::text[]`,
      ),
    )
    .orderBy(asc(companies.name))
    .limit(5)
  return rows.map(toMatch)
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type CompanyInput = {
  name: string
  industry: Category
  website: string | null
  logo: string | null
  description: string
  services: string[]
  locations: string[]
  serviceAreas: string[]
  zips: string[]
  contactEmail: string | null
  contactPhone: string | null
  leadPartner: boolean
  hiring: boolean
  published: boolean
}

/**
 * Validate a submitted company. Every check here is why a column can be
 * notNull, and why matching can trust the industry value.
 */
export function parseCompany(
  raw: Record<string, unknown>,
): { ok: true; value: CompanyInput } | { ok: false; error: string } {
  const str = (key: string) => String(raw[key] ?? "").trim()
  const list = (key: string) =>
    str(key)
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)

  const name = str("name")
  if (!name) return { ok: false, error: "Company name is required." }

  const industry = str("industry")
  if (!isCategory(industry)) return { ok: false, error: "Choose one of the four industries." }

  const website = str("website") || null
  if (website && !/^https?:\/\/\S+$/i.test(website)) {
    return { ok: false, error: "The website must start with http:// or https://." }
  }

  const contactEmail = str("contactEmail") || null
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) {
    return { ok: false, error: "Enter a valid contact email." }
  }

  return {
    ok: true,
    value: {
      name,
      industry,
      website,
      logo: str("logo") || null,
      description: str("description"),
      services: list("services"),
      locations: list("locations"),
      serviceAreas: list("serviceAreas"),
      zips: list("zips").map((z) => z.replace(/\D/g, "").slice(0, 5)).filter(Boolean),
      contactEmail,
      contactPhone: str("contactPhone") || null,
      leadPartner: raw.leadPartner === "on" || raw.leadPartner === true,
      hiring: raw.hiring === "on" || raw.hiring === true,
      published: raw.published === "on" || raw.published === true,
    },
  }
}

/** Insert a company, resolving slug collisions with a numeric suffix. */
export async function createCompany(value: CompanyInput): Promise<string> {
  const base = slugify(value.name) || "company"
  let slug = base
  for (let attempt = 1; ; attempt++) {
    const [existing] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1)
    if (!existing) break
    slug = `${base}-${attempt + 1}`
  }

  const [row] = await db
    .insert(companies)
    .values({ ...value, slug })
    .returning({ id: companies.id })
  return row.id
}

export async function setCompanyPublished(id: string, published: boolean): Promise<void> {
  await db
    .update(companies)
    .set({ published, updatedAt: new Date() })
    .where(eq(companies.id, id))
}

export async function deleteCompany(id: string): Promise<void> {
  await db.delete(companies).where(eq(companies.id, id))
}
