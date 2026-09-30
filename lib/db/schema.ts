import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category").notNull(),
    // Secondary tags, additive to the single primary `category`. Lets a post
    // appear in a collection like Jobs without leaving its original category.
    tags: text("tags").array().notNull().default([]),
    excerpt: text("excerpt").notNull().default(""),
    content: text("content").notNull().default(""),
    author: text("author").notNull().default("Evergreen Team"),
    coverImage: text("cover_image").notNull().default("/blog/placeholder-cover.png"),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("posts_category_created_idx").on(table.category, table.createdAt),
    // GIN index backs the `'jobs' = any(tags)` containment lookups.
    index("posts_tags_idx").using("gin", table.tags),
  ],
)

export type PostRow = typeof posts.$inferSelect

/**
 * Job interest submissions from the Companies page.
 *
 * The database is the delivery mechanism, not a backup of one: nothing is
 * emailed, so this table is the only record of an applicant's message. Read
 * them in the admin inbox at /admin/inquiries.
 *
 * `readAt` is null until the message is marked handled, which is what drives
 * the unread count.
 */
export const jobInquiries = pgTable(
  "job_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromEmail: text("from_email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [index("job_inquiries_created_idx").on(table.createdAt)],
)

export type JobInquiryRow = typeof jobInquiries.$inferSelect

/**
 * Real, first-party job openings.
 *
 * These are Evergreen's own postings, entered by an admin — not aggregated from
 * a third-party board. That distinction is load-bearing in two places:
 *   - The job map renders these differently from the seeded sample employers in
 *     `lib/careers/companies.ts`, so nobody mistakes an illustrative pin for a
 *     job they can apply to.
 *   - Only these rows get `JobPosting` structured data. Marking up listings you
 *     do not own is what Google's job-posting guidelines exist to prevent.
 *
 * `careerId` is nullable on purpose. It points at the career taxonomy in
 * `lib/careers/careers.ts`, which is what lets a pin carry a tier, skill list
 * and training time. A real opening that does not map cleanly onto one of those
 * careers is still shown, but with `careerId` null it makes no claim about any
 * of that rather than being forced into the nearest wrong career.
 *
 * `lat`/`lng` are resolved from `zip` at write time via `lib/careers/geocode.ts`
 * and stored, so rendering the map never needs the 700KB ZIP table and a
 * posting's position cannot drift if that table is later regenerated.
 */
export const jobPostings = pgTable(
  "job_postings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    /** Career taxonomy id, or null when the role has no clean match. */
    careerId: text("career_id"),
    /** One of the four trades. Drives the pin colour and the map filters. */
    industry: text("industry").notNull(),
    employer: text("employer").notNull(),
    city: text("city").notNull(),
    /** Two-letter USPS code, matched against company records. */
    state: text("state").notNull(),
    zip: text("zip").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    employmentType: text("employment_type").notNull().default("full_time"),
    description: text("description").notNull().default(""),
    /** Pay range in whole dollars. Null means "not disclosed", not zero. */
    payMin: integer("pay_min"),
    payMax: integer("pay_max"),
    /** "hour" or "year", so a range is never ambiguous. */
    payPeriod: text("pay_period").notNull().default("hour"),
    /** Where to apply. At least one of these is required at the form level. */
    applyUrl: text("apply_url"),
    applyEmail: text("apply_email"),
    published: boolean("published").notNull().default(false),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * When the listing stops being shown. Null means no expiry.
     *
     * Stale openings are the fastest way a job board loses trust, so the public
     * queries filter on this rather than relying on someone remembering to
     * unpublish.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Backs the public "live openings" lookup, which always filters on both.
    index("job_postings_live_idx").on(table.published, table.expiresAt),
    index("job_postings_state_idx").on(table.state),
  ],
)

export type JobPostingRow = typeof jobPostings.$inferSelect

/**
 * Consumer project leads from /find-a-pro.
 *
 * Like job_inquiries, this row IS the lead — nothing is emailed, so
 * /admin/leads is the only record. `readAt` drives the unhandled count, and the
 * `category`, `service`, `zip` columns are the fields lead-to-company matching
 * is built on. `matchedCompanyId` is null until Evergreen routes the lead; it
 * makes no claim that a match exists on its own.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** One of the four trades, mirrors CATEGORIES. Drives matching. */
    category: text("category").notNull(),
    /** Consumer-facing service picked in step 2, scoped to the category. */
    service: text("service").notNull(),
    zip: text("zip").notNull(),
    description: text("description").notNull(),
    /** Optional at the form level, so stored as "" rather than null. */
    budget: text("budget").notNull().default(""),
    timeframe: text("timeframe").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    /** Set when a lead is routed to a company. Null means unrouted. */
    matchedCompanyId: uuid("matched_company_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("leads_created_idx").on(table.createdAt),
    // Backs the "which companies serve this trade + area" matching lookup.
    index("leads_category_zip_idx").on(table.category, table.zip),
  ],
)

export type LeadRow = typeof leads.$inferSelect

/**
 * B2B partnership applications from /partners.
 *
 * A single table rather than one per partnership type: every application shares
 * the same contact block, and the interest-specific fields (services/areas for
 * lead partners, jobs for employers, expertise for contributors) are additive
 * columns that stay empty when they do not apply. That keeps the admin inbox a
 * single list instead of several, matching how job_inquiries is handled.
 */
export const partnerApplications = pgTable(
  "partner_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which partnership option was chosen. See PARTNERSHIP_OPTIONS. */
    interest: text("interest").notNull(),
    name: text("name").notNull(),
    workEmail: text("work_email").notNull(),
    company: text("company").notNull(),
    companyWebsite: text("company_website").notNull().default(""),
    industry: text("industry").notNull(),
    location: text("location").notNull(),
    message: text("message").notNull().default(""),
    // Lead-partner specifics: what they do and where.
    services: text("services").array().notNull().default([]),
    serviceAreas: text("service_areas").array().notNull().default([]),
    zips: text("zips").array().notNull().default([]),
    // Employer specifics.
    jobs: text("jobs").array().notNull().default([]),
    hiringLocations: text("hiring_locations").array().notNull().default([]),
    // Expert-contributor specifics.
    jobTitle: text("job_title").notNull().default(""),
    expertise: text("expertise").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [index("partner_applications_created_idx").on(table.createdAt)],
)

export type PartnerApplicationRow = typeof partnerApplications.$inferSelect

/**
 * Participating company profiles.
 *
 * Supporting infrastructure behind both consumer and business flows rather than
 * a headline feature: Find a Professional matches leads against these rows, and
 * Partner with Evergreen is how a company eventually gets one. Only `published`
 * rows are ever shown or matched, so a draft profile can be prepared without
 * leaking a half-finished page or a false match.
 *
 * The `services`/`serviceAreas`/`zips` arrays mirror the lead-partner fields on
 * partner_applications on purpose: an approved application maps straight onto a
 * company record.
 */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    website: text("website"),
    /** One of the four trades, mirrors CATEGORIES. */
    industry: text("industry").notNull(),
    services: text("services").array().notNull().default([]),
    locations: text("locations").array().notNull().default([]),
    serviceAreas: text("service_areas").array().notNull().default([]),
    zips: text("zips").array().notNull().default([]),
    description: text("description").notNull().default(""),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    /** Accepts routed consumer leads. Only these are matched in /find-a-pro. */
    leadPartner: boolean("lead_partner").notNull().default(false),
    hiring: boolean("hiring").notNull().default(false),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("companies_industry_idx").on(table.industry),
    index("companies_published_idx").on(table.published),
  ],
)

export type CompanyRow = typeof companies.$inferSelect
