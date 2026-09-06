"use server"

import { desc, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { partnerApplications, type PartnerApplicationRow } from "@/lib/db/schema"
import { isCategory } from "@/lib/categories"
import { isPartnershipId, PARTNERSHIP_OPTIONS } from "@/lib/leads/constants"

const MAX_TEXT = 4000
const MAX_SHORT = 200

export type PartnerState = {
  status: "idle" | "sent" | "error"
  message?: string
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

/** Split a comma/newline list into trimmed, non-empty entries. */
function toList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * Records a B2B partnership application from /partners.
 *
 * A single table backs every partnership type; the interest-specific arrays are
 * only read when the chosen option calls for them, so an unrelated section left
 * blank stays an empty array rather than noise.
 */
export async function submitPartnerApplication(
  _prev: PartnerState,
  formData: FormData,
): Promise<PartnerState> {
  const get = (key: string) => String(formData.get(key) ?? "").trim()

  const interest = get("interest")
  if (!isPartnershipId(interest)) {
    return { status: "error", message: "Choose how you'd like to work with Evergreen." }
  }

  const name = get("name")
  const workEmail = get("workEmail")
  const company = get("company")
  const companyWebsite = get("companyWebsite")
  const industry = get("industry")
  const location = get("location")
  const message = get("message")

  if (!name || name.length > MAX_SHORT) {
    return { status: "error", message: "Add your name." }
  }
  if (!isEmail(workEmail)) {
    return { status: "error", message: "Enter a valid work email." }
  }
  if (!company || company.length > MAX_SHORT) {
    return { status: "error", message: "Add your company name." }
  }
  if (companyWebsite && !/^https?:\/\/\S+$/i.test(companyWebsite)) {
    return { status: "error", message: "The company website must start with http:// or https://." }
  }
  if (!isCategory(industry)) {
    return { status: "error", message: "Choose your industry." }
  }
  if (!location || location.length > MAX_SHORT) {
    return { status: "error", message: "Add your location." }
  }
  if (message.length > MAX_TEXT) {
    return { status: "error", message: `Keep the message under ${MAX_TEXT} characters.` }
  }

  const fields = PARTNERSHIP_OPTIONS.find((option) => option.id === interest)?.fields

  try {
    await db.insert(partnerApplications).values({
      interest,
      name,
      workEmail,
      company,
      companyWebsite,
      industry,
      location,
      message,
      services: fields === "leadPartner" ? toList(get("services")) : [],
      serviceAreas: fields === "leadPartner" ? toList(get("serviceAreas")) : [],
      zips:
        fields === "leadPartner"
          ? toList(get("zips")).map((z) => z.replace(/\D/g, "").slice(0, 5)).filter(Boolean)
          : [],
      jobs: fields === "employer" ? toList(get("jobs")) : [],
      hiringLocations: fields === "employer" ? toList(get("hiringLocations")) : [],
      jobTitle: fields === "expert" ? get("jobTitle") : "",
      expertise: fields === "expert" ? get("expertise") : "",
    })
  } catch (error) {
    console.log("[v0] partner application insert failed:", error)
    return {
      status: "error",
      message: "We could not record your application. Please try again in a moment.",
    }
  }

  revalidatePath("/admin/partners")
  return { status: "sent" }
}

/** Newest first, for the admin routing view. */
export async function listPartnerApplications(): Promise<PartnerApplicationRow[]> {
  await requireAdmin()
  return db.select().from(partnerApplications).orderBy(desc(partnerApplications.createdAt))
}

export async function countUnreadPartnerApplications(): Promise<number> {
  await requireAdmin()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(partnerApplications)
    .where(isNull(partnerApplications.readAt))
  return row?.count ?? 0
}

export async function setPartnerApplicationRead(id: string, read: boolean): Promise<void> {
  await requireAdmin()
  await db
    .update(partnerApplications)
    .set({ readAt: read ? new Date() : null })
    .where(eq(partnerApplications.id, id))
  revalidatePath("/admin/partners")
}

export async function deletePartnerApplication(id: string): Promise<void> {
  await requireAdmin()
  await db.delete(partnerApplications).where(eq(partnerApplications.id, id))
  revalidatePath("/admin/partners")
}
