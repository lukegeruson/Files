"use server"

import { desc, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { leads, type LeadExtraProject, type LeadRow } from "@/lib/db/schema"
import { isCategory, type Category, type LeadSource } from "@/lib/categories"
import {
  QUOTE_CATEGORIES,
  QUOTE_TIMELINES,
  type QuoteCategory,
  type QuoteLead,
  type QuoteProject,
} from "@/lib/quote-capture"
import { SERVICES_BY_CATEGORY } from "@/lib/leads/constants"
import { matchCompaniesForLead, type CompanyMatch } from "@/lib/companies/companies"

const MAX_TEXT = 4000
const MAX_SHORT = 200

export type LeadState = {
  status: "idle" | "sent" | "error"
  message?: string
  /** Only populated on success, and only with companies that genuinely match. */
  matches?: CompanyMatch[]
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

/**
 * Records a consumer project lead from /find-a-pro.
 *
 * The row IS the lead — nothing is emailed — so a failed insert means the
 * request was lost and must surface to the visitor. On success it looks for
 * genuinely matching companies; finding none is normal and never implies a
 * match exists.
 */
export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const category = String(formData.get("category") ?? "").trim()
  const service = String(formData.get("service") ?? "").trim()
  const zip = String(formData.get("zip") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const budget = String(formData.get("budget") ?? "").trim()
  const timeframe = String(formData.get("timeframe") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const consent = formData.get("consent")

  // Re-validated server-side: the browser's required/pattern attributes are a
  // convenience for the visitor, not a control we can trust.
  if (!isCategory(category)) {
    return { status: "error", message: "Choose what you need help with." }
  }
  if (!SERVICES_BY_CATEGORY[category].includes(service)) {
    return { status: "error", message: "Choose a service for that category." }
  }
  if (!/^\d{5}$/.test(zip)) {
    return { status: "error", message: "Enter a valid 5-digit ZIP code." }
  }
  if (!description) return { status: "error", message: "Add a short project description." }
  if (description.length > MAX_TEXT) {
    return { status: "error", message: `Keep the description under ${MAX_TEXT} characters.` }
  }
  if (!timeframe) return { status: "error", message: "Choose a project timeframe." }
  if (!name) return { status: "error", message: "Add your name." }
  if (name.length > MAX_SHORT) return { status: "error", message: "That name is too long." }
  if (!isEmail(email)) return { status: "error", message: "Enter a valid email address." }
  if (!phone) return { status: "error", message: "Add a phone number." }
  if (!consent) {
    return { status: "error", message: "Please agree to be contacted so we can follow up." }
  }

  try {
    await db.insert(leads).values({
      source: "find-a-pro",
      category,
      service,
      zip,
      description,
      budget,
      timeframe,
      name,
      email,
      phone,
    })
  } catch (error) {
    console.log("[v0] lead insert failed:", error)
    return {
      status: "error",
      message: "We could not record your project. Please try again in a moment.",
    }
  }

  revalidatePath("/admin/leads")

  // Best-effort matching. A lookup failure must not lose the lead we just
  // stored, so it falls back to "no matches" rather than erroring.
  let matches: CompanyMatch[] = []
  try {
    matches = await matchCompaniesForLead(category, zip)
  } catch (error) {
    console.log("[v0] lead match lookup failed:", error)
  }

  return { status: "sent", matches }
}

export type QuoteLeadState = { status: "sent" } | { status: "error"; message: string }

const QUOTE_TO_CATEGORY: Record<QuoteCategory, Category> = {
  solar: "solar",
  landscaping: "landscaping",
  "home-improvement": "renovation",
  agriculture: "agriculture",
}

function clip(value: unknown, max = MAX_SHORT): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function isQuoteCategory(value: unknown): value is QuoteCategory {
  return typeof value === "string" && value in QUOTE_CATEGORIES
}

/** Resolves ids against config so only known labels are stored. */
function toStoredProject(project: QuoteProject): LeadExtraProject | null {
  if (!isQuoteCategory(project?.category)) return null
  const config = QUOTE_CATEGORIES[project.category]
  const type = config.projectTypes.find((t) => t.id === project.projectType)
  const timeline = QUOTE_TIMELINES.find((t) => t.id === project.timeline)
  const zip = clip(project.zipCode, 10)
  return {
    category: QUOTE_TO_CATEGORY[project.category],
    service: type?.label ?? "",
    zip: /^\d{5}$/.test(zip) ? zip : "",
    timeframe: timeline?.label ?? "",
    projectSize: clip(project.projectSize),
  }
}

/**
 * Records a "Get a Professional Quote" submission from one of the four
 * category pages. Stored in the same `leads` table as Find a Professional,
 * tagged with a `quote-<category>` source so the admin inbox can filter it.
 */
export async function submitQuoteLead(lead: QuoteLead): Promise<QuoteLeadState> {
  if (!isQuoteCategory(lead?.sourceCategory)) {
    return { status: "error", message: "Unknown project category." }
  }
  const primary = toStoredProject({ ...lead.primary, category: lead.sourceCategory })
  if (!primary || !primary.service) {
    return { status: "error", message: "Choose what kind of project this is." }
  }
  if (!primary.zip) return { status: "error", message: "Enter a valid 5-digit ZIP code." }
  if (!primary.timeframe) return { status: "error", message: "Choose when you want to start." }

  const name = clip(lead.contact?.name)
  const email = clip(lead.contact?.email)
  const phone = clip(lead.contact?.phone, 40)
  const notes = clip(lead.contact?.notes, MAX_TEXT)
  if (!name) return { status: "error", message: "Add your name." }
  if (!isEmail(email)) return { status: "error", message: "Enter a valid email address." }

  const extras = (Array.isArray(lead.additionalProjects) ? lead.additionalProjects : [])
    .slice(0, 10)
    .map(toStoredProject)
    .filter((p): p is LeadExtraProject => p !== null)

  const category = primary.category as Category
  try {
    await db.insert(leads).values({
      source: `quote-${category}`,
      category,
      service: primary.service,
      zip: primary.zip,
      timeframe: primary.timeframe,
      projectSize: primary.projectSize,
      notes,
      additionalProjects: extras,
      name,
      email,
      phone,
    })
  } catch (error) {
    console.log("[v0] quote lead insert failed:", error)
    return {
      status: "error",
      message: "We could not send your request. Please try again in a moment.",
    }
  }

  revalidatePath("/admin/leads")
  return { status: "sent" }
}

/** Newest first, for the admin routing view. Optionally scoped to one source. */
export async function listLeads(source?: LeadSource): Promise<LeadRow[]> {
  await requireAdmin()
  const query = db.select().from(leads)
  return (source ? query.where(eq(leads.source, source)) : query).orderBy(
    desc(leads.createdAt),
  )
}

/** Lead totals per source, for the admin filter tabs. */
export async function countLeadsBySource(): Promise<Record<string, number>> {
  await requireAdmin()
  const rows = await db
    .select({ source: leads.source, count: sql<number>`count(*)::int` })
    .from(leads)
    .groupBy(leads.source)
  return Object.fromEntries(rows.map((r) => [r.source, r.count]))
}

export async function countUnreadLeads(): Promise<number> {
  await requireAdmin()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(isNull(leads.readAt))
  return row?.count ?? 0
}

export async function setLeadRead(id: string, read: boolean): Promise<void> {
  await requireAdmin()
  await db
    .update(leads)
    .set({ readAt: read ? new Date() : null })
    .where(eq(leads.id, id))
  revalidatePath("/admin/leads")
}

export async function deleteLead(id: string): Promise<void> {
  await requireAdmin()
  await db.delete(leads).where(eq(leads.id, id))
  revalidatePath("/admin/leads")
}
