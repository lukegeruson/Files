// Data access for real, first-party job openings. SERVER ONLY.
//
// These are Evergreen's own postings, entered through /admin/openings. They are
// deliberately kept apart from the seeded employer directory in `companies.ts`:
// that one is illustrative sample data, this one is jobs a person can actually
// apply to, and the two must never be presented as the same thing.

import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { jobPostings, type JobPostingRow } from "@/lib/db/schema"
import { INDUSTRIES } from "./industries"
import { getCareer } from "./careers"
import { STATE_NAMES } from "@/lib/zip"
import { coordsForZip } from "./geocode"
import type { Industry } from "./types"

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/**
 * Employment types, keyed to schema.org's `employmentType` values.
 *
 * Using their vocabulary here means the structured data on the openings page is
 * a direct mapping rather than a translation table that can drift.
 */
export const EMPLOYMENT_TYPES = {
  full_time: { label: "Full time", schema: "FULL_TIME" },
  part_time: { label: "Part time", schema: "PART_TIME" },
  contract: { label: "Contract", schema: "CONTRACTOR" },
  temporary: { label: "Seasonal or temporary", schema: "TEMPORARY" },
  apprenticeship: { label: "Apprenticeship", schema: "FULL_TIME" },
  internship: { label: "Internship", schema: "INTERN" },
} as const

export type EmploymentType = keyof typeof EMPLOYMENT_TYPES

export const PAY_PERIODS = {
  hour: { label: "per hour", schema: "HOUR" },
  year: { label: "per year", schema: "YEAR" },
} as const

export type PayPeriod = keyof typeof PAY_PERIODS

function isIndustry(value: string): value is Industry {
  return (INDUSTRIES as string[]).includes(value)
}

function isEmploymentType(value: string): value is EmploymentType {
  return Object.hasOwn(EMPLOYMENT_TYPES, value)
}

function isPayPeriod(value: string): value is PayPeriod {
  return Object.hasOwn(PAY_PERIODS, value)
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type PostingInput = {
  title: string
  /** Career taxonomy id, or null when the role has no clean match. */
  careerId: string | null
  industry: Industry
  employer: string
  city: string
  state: string
  zip: string
  employmentType: EmploymentType
  description: string
  payMin: number | null
  payMax: number | null
  payPeriod: PayPeriod
  applyUrl: string | null
  applyEmail: string | null
  published: boolean
  /** ISO date (yyyy-mm-dd) or null for no expiry. */
  expiresOn: string | null
}

/**
 * Validate and normalise a submitted posting.
 *
 * Returns either clean input plus its resolved coordinate, or a single message
 * to show the admin. Every check here is also the reason a column can be
 * `notNull` in the schema.
 */
export function parsePosting(
  raw: Record<string, unknown>,
):
  | { ok: true; value: PostingInput & { lat: number; lng: number } }
  | { ok: false; error: string } {
  const str = (key: string) => String(raw[key] ?? "").trim()

  const title = str("title")
  if (!title) return { ok: false, error: "Job title is required." }

  const employer = str("employer")
  if (!employer) return { ok: false, error: "Employer name is required." }

  const industry = str("industry")
  if (!isIndustry(industry)) {
    return { ok: false, error: "Choose one of the four trades." }
  }

  // Empty string is the "no clean match" option in the form, which is a valid
  // choice rather than a missing field. Anything else must exist in the
  // taxonomy, so a stale or crafted id cannot create a pin that links nowhere.
  const rawCareer = str("careerId")
  let careerId: string | null = null
  if (rawCareer) {
    if (!getCareer(rawCareer)) {
      return { ok: false, error: "That role is not in the career library." }
    }
    careerId = rawCareer
  }

  const city = str("city")
  if (!city) return { ok: false, error: "City is required." }

  const state = str("state").toUpperCase()
  if (!STATE_NAMES[state]) {
    return { ok: false, error: "Choose a valid state." }
  }

  // The coordinate is what puts the pin on the map, so a ZIP we cannot place is
  // a hard failure rather than something to guess at.
  const zip = str("zip")
  const coords = coordsForZip(zip)
  if (!coords) {
    return {
      ok: false,
      error: "That ZIP code isn't recognised. Enter a 5-digit US ZIP.",
    }
  }

  const employmentType = str("employmentType")
  if (!isEmploymentType(employmentType)) {
    return { ok: false, error: "Choose a valid employment type." }
  }

  const payPeriod = str("payPeriod")
  if (!isPayPeriod(payPeriod)) {
    return { ok: false, error: "Choose a valid pay period." }
  }

  // Pay is optional as a pair, but a value that was typed and cannot be read is
  // an error rather than a silent null. Treating "-5" or "abuot 20" as
  // "not disclosed" would quietly publish a wage the employer never agreed to
  // omit, and nothing downstream could tell the difference.
  //
  // The ceiling is a typo guard, not a judgement about wages: it catches the
  // cent/dollar and hourly/annual mix-ups ($4500 an hour, $30 a year) that
  // would otherwise go straight onto a public listing and into search results.
  const PAY_CEILING: Record<PayPeriod, number> = { hour: 500, year: 1_000_000 }
  const ceiling = PAY_CEILING[payPeriod]

  const parsePay = (
    key: string,
    label: string,
  ): { ok: true; value: number | null } | { ok: false; error: string } => {
    const raw = str(key).replace(/[$,\s]/g, "")
    if (!raw) return { ok: true, value: null }
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      return { ok: false, error: `${label} must be a number.` }
    }
    if (n < 0) return { ok: false, error: `${label} cannot be negative.` }
    if (n > ceiling) {
      return {
        ok: false,
        error:
          payPeriod === "hour"
            ? `${label} of $${Math.round(n).toLocaleString("en-US")} per hour looks like a typo. Did you mean per year?`
            : `${label} of $${Math.round(n).toLocaleString("en-US")} per year looks like a typo.`,
      }
    }
    return { ok: true, value: Math.round(n) }
  }

  const min = parsePay("payMin", "Minimum pay")
  if (!min.ok) return { ok: false, error: min.error }
  const max = parsePay("payMax", "Maximum pay")
  if (!max.ok) return { ok: false, error: max.error }
  const payMin = min.value
  const payMax = max.value
  if (payMin !== null && payMax !== null && payMin > payMax) {
    return { ok: false, error: "Minimum pay cannot be above maximum pay." }
  }

  const applyUrl = str("applyUrl") || null
  const applyEmail = str("applyEmail") || null
  if (!applyUrl && !applyEmail) {
    return {
      ok: false,
      error: "Add an application link or an email so people can apply.",
    }
  }
  if (applyUrl && !/^https?:\/\/\S+$/i.test(applyUrl)) {
    return { ok: false, error: "The application link must start with http:// or https://." }
  }
  if (applyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyEmail)) {
    return { ok: false, error: "Enter a valid application email address." }
  }

  const expiresOn = str("expiresOn") || null
  if (expiresOn && Number.isNaN(Date.parse(expiresOn))) {
    return { ok: false, error: "Enter a valid closing date." }
  }

  const [lng, lat] = coords

  return {
    ok: true,
    value: {
      title,
      careerId,
      industry,
      employer,
      city,
      state,
      zip: zip.replace(/\D/g, "").slice(0, 5),
      employmentType,
      description: str("description"),
      payMin,
      payMax,
      payPeriod,
      applyUrl,
      applyEmail,
      published: raw.published === "on" || raw.published === true,
      expiresOn,
      lat,
      lng,
    },
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Only what the public should see: published, and not past its closing date.
 *
 * Expiry is enforced in the query rather than by remembering to unpublish,
 * because a listing that has quietly closed is worse than no listing at all —
 * someone spends effort applying into a void.
 */
export async function getLivePostings(): Promise<JobPostingRow[]> {
  return db
    .select()
    .from(jobPostings)
    .where(
      and(
        eq(jobPostings.published, true),
        // Null expiry means "open until removed".
        or(isNull(jobPostings.expiresAt), gt(jobPostings.expiresAt, new Date())),
      ),
    )
    .orderBy(asc(jobPostings.state), asc(jobPostings.city))
}

/** Everything, including drafts and expired rows, for the admin list. */
export async function getAllPostings(): Promise<JobPostingRow[]> {
  return db.select().from(jobPostings).orderBy(desc(jobPostings.updatedAt))
}

export async function getPosting(id: string): Promise<JobPostingRow | null> {
  const [row] = await db.select().from(jobPostings).where(eq(jobPostings.id, id)).limit(1)
  return row ?? null
}

/** True when a row is published but its closing date has passed. */
export function isExpired(row: JobPostingRow): boolean {
  return Boolean(row.expiresAt && row.expiresAt.getTime() <= Date.now())
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type PostingValues = PostingInput & { lat: number; lng: number }

function toRow(value: PostingValues) {
  return {
    title: value.title,
    careerId: value.careerId,
    industry: value.industry,
    employer: value.employer,
    city: value.city,
    state: value.state,
    zip: value.zip,
    lat: value.lat,
    lng: value.lng,
    employmentType: value.employmentType,
    description: value.description,
    payMin: value.payMin,
    payMax: value.payMax,
    payPeriod: value.payPeriod,
    applyUrl: value.applyUrl,
    applyEmail: value.applyEmail,
    published: value.published,
    // Stored end-of-day so a closing date of the 30th stays live through the
    // 30th rather than expiring at midnight as it begins.
    expiresAt: value.expiresOn ? new Date(`${value.expiresOn}T23:59:59Z`) : null,
  }
}

export async function createPosting(value: PostingValues): Promise<void> {
  await db.insert(jobPostings).values(toRow(value))
}

export async function updatePosting(id: string, value: PostingValues): Promise<void> {
  await db
    .update(jobPostings)
    .set({ ...toRow(value), updatedAt: new Date() })
    .where(eq(jobPostings.id, id))
}

export async function deletePosting(id: string): Promise<void> {
  await db.delete(jobPostings).where(eq(jobPostings.id, id))
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Human-readable pay range, or null when nothing was disclosed. */
export function payLabel(row: JobPostingRow): string | null {
  const { payMin, payMax } = row
  if (payMin === null && payMax === null) return null

  const period = isPayPeriod(row.payPeriod) ? PAY_PERIODS[row.payPeriod].label : ""
  const money = (n: number) => `$${n.toLocaleString("en-US")}`

  if (payMin !== null && payMax !== null) {
    // A single figure when both ends match, rather than "$25–$25".
    if (payMin === payMax) return `${money(payMin)} ${period}`
    return `${money(payMin)}–${money(payMax)} ${period}`
  }
  if (payMin !== null) return `From ${money(payMin)} ${period}`
  return `Up to ${money(payMax as number)} ${period}`
}

export function employmentLabel(value: string): string {
  return isEmploymentType(value) ? EMPLOYMENT_TYPES[value].label : value
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

/**
 * `JobPosting` schema for real openings.
 *
 * Only ever called with first-party rows. Google expects job markup to come
 * from the authoritative source, so marking up listings aggregated from someone
 * else's board — while linking out to apply on their site — invites a manual
 * action. That is why the seeded sample employers get no markup at all, and why
 * a future third-party feed must not be passed through here.
 */
export function jobPostingSchema(rows: JobPostingRow[]) {
  return rows.map((row) => {
    const period = isPayPeriod(row.payPeriod) ? PAY_PERIODS[row.payPeriod] : null

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: row.title,
      // Google requires a description and treats an empty one as invalid, so
      // fall back to something true rather than emitting a broken field.
      description:
        row.description ||
        `${row.title} with ${row.employer} in ${row.city}, ${row.state}.`,
      datePosted: row.postedAt.toISOString(),
      hiringOrganization: {
        "@type": "Organization",
        name: row.employer,
      },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: row.city,
          addressRegion: row.state,
          postalCode: row.zip,
          addressCountry: "US",
        },
      },
    }

    // Omitted rather than defaulted. `parsePosting` rejects unknown types, so
    // this only trips on a row written straight to the database — and guessing
    // "FULL_TIME" for what might be a seasonal role would state something
    // untrue about the job in the markup Google reads.
    if (isEmploymentType(row.employmentType)) {
      schema.employmentType = EMPLOYMENT_TYPES[row.employmentType].schema
    }

    if (row.expiresAt) schema.validThrough = row.expiresAt.toISOString()

    // Omitted entirely when undisclosed. An incomplete `baseSalary` is a
    // structured-data error, and inventing a figure would be worse.
    if (period && (row.payMin !== null || row.payMax !== null)) {
      schema.baseSalary = {
        "@type": "MonetaryAmount",
        currency: "USD",
        value: {
          "@type": "QuantitativeValue",
          ...(row.payMin !== null ? { minValue: row.payMin } : {}),
          ...(row.payMax !== null ? { maxValue: row.payMax } : {}),
          unitText: period.schema,
        },
      }
    }

    return schema
  })
}
