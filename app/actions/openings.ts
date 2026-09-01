"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin-auth"
import {
  createPosting,
  deletePosting,
  parsePosting,
  updatePosting,
} from "@/lib/careers/postings"

export type OpeningFormState = { error?: string }

/**
 * Every surface that reads postings. The openings page renders the map and the
 * list; the jobs landing page counts live roles. Missing one of these leaves a
 * stale pin for a job that has closed, which is the failure mode most likely to
 * waste someone's time.
 */
function revalidateOpenings() {
  revalidatePath("/admin/openings")
  revalidatePath("/jobs/openings")
  revalidatePath("/jobs")
}

/** FormData is untyped, so hand `parsePosting` a plain record to validate. */
function toRecord(formData: FormData): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) record[key] = value
  return record
}

export async function createOpeningAction(
  _prev: OpeningFormState,
  formData: FormData,
): Promise<OpeningFormState> {
  await requireAdmin()

  const parsed = parsePosting(toRecord(formData))
  if (!parsed.ok) return { error: parsed.error }

  await createPosting(parsed.value)
  revalidateOpenings()
  redirect("/admin/openings")
}

export async function updateOpeningAction(
  id: string,
  _prev: OpeningFormState,
  formData: FormData,
): Promise<OpeningFormState> {
  await requireAdmin()

  const parsed = parsePosting(toRecord(formData))
  if (!parsed.ok) return { error: parsed.error }

  await updatePosting(id, parsed.value)
  revalidateOpenings()
  redirect("/admin/openings")
}

export async function deleteOpeningAction(id: string): Promise<void> {
  await requireAdmin()

  await deletePosting(id)
  revalidateOpenings()
}
