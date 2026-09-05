"use server"

import { desc, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { leads, type LeadRow } from "@/lib/db/schema"
import { isCategory } from "@/lib/categories"
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

/** Newest first, for the admin routing view. */
export async function listLeads(): Promise<LeadRow[]> {
  await requireAdmin()
  return db.select().from(leads).orderBy(desc(leads.createdAt))
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
