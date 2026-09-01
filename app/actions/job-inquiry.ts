"use server"

import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { jobInquiries, type JobInquiryRow } from "@/lib/db/schema"
import { desc, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const MAX_EMAIL = 254
const MAX_SUBJECT = 200
const MAX_MESSAGE = 5000

export type InquiryState = {
  status: "idle" | "sent" | "error"
  message?: string
}

/** Conservative shape check. Stricter regexes reject valid addresses. */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

/**
 * Records an openings enquiry.
 *
 * Nothing is emailed: this row IS the delivery, read later in the admin inbox
 * at /admin/inquiries. That makes the insert the only thing that can fail, and
 * a failure genuinely means the message was lost — so unlike a notification
 * problem, it must surface to the sender.
 */
export async function sendJobInquiry(
  _prev: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const fromEmail = String(formData.get("fromEmail") ?? "").trim()
  const subject = String(formData.get("subject") ?? "").trim()
  const message = String(formData.get("message") ?? "").trim()

  // Re-validated here because the browser's `required` and `type=email`
  // attributes are a convenience for the visitor, not a control we can trust.
  if (!isEmail(fromEmail) || fromEmail.length > MAX_EMAIL) {
    return { status: "error", message: "Enter a valid email address so we can reply." }
  }
  if (!subject) return { status: "error", message: "Add a subject." }
  if (!message) return { status: "error", message: "Add a short message." }
  if (subject.length > MAX_SUBJECT) {
    return { status: "error", message: `Keep the subject under ${MAX_SUBJECT} characters.` }
  }
  if (message.length > MAX_MESSAGE) {
    return { status: "error", message: `Keep the message under ${MAX_MESSAGE} characters.` }
  }

  try {
    await db.insert(jobInquiries).values({ fromEmail, subject, message })
  } catch (error) {
    console.log("[v0] job inquiry insert failed:", error)
    return {
      status: "error",
      message: "We could not record your message. Please try again in a moment.",
    }
  }

  // Surface the new message in the admin inbox without a hard reload.
  revalidatePath("/admin/inquiries")
  return { status: "sent", message: "Thanks — your message has been received." }
}

/** Newest first: the inbox is read top-down. */
export async function listJobInquiries(): Promise<JobInquiryRow[]> {
  await requireAdmin()
  return db.select().from(jobInquiries).orderBy(desc(jobInquiries.createdAt))
}

/** Drives the unread count on the admin dashboard. */
export async function countUnreadInquiries(): Promise<number> {
  await requireAdmin()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobInquiries)
    .where(isNull(jobInquiries.readAt))
  return row?.count ?? 0
}

/** Toggleable, so a message marked handled by accident can be restored. */
export async function setInquiryRead(id: string, read: boolean): Promise<void> {
  await requireAdmin()
  await db
    .update(jobInquiries)
    .set({ readAt: read ? new Date() : null })
    .where(eq(jobInquiries.id, id))
  revalidatePath("/admin/inquiries")
}

export async function deleteInquiry(id: string): Promise<void> {
  await requireAdmin()
  await db.delete(jobInquiries).where(eq(jobInquiries.id, id))
  revalidatePath("/admin/inquiries")
}
