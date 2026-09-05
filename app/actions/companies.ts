"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin-auth"
import {
  createCompany,
  deleteCompany,
  parseCompany,
  setCompanyPublished,
} from "@/lib/companies/companies"

export type CompanyFormState = { error?: string }

function toRecord(formData: FormData): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) record[key] = value
  return record
}

function revalidateCompanies() {
  revalidatePath("/admin/companies")
  revalidatePath("/companies")
}

export async function createCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  await requireAdmin()

  const parsed = parseCompany(toRecord(formData))
  if (!parsed.ok) return { error: parsed.error }

  await createCompany(parsed.value)
  revalidateCompanies()
  redirect("/admin/companies")
}

export async function setCompanyPublishedAction(id: string, published: boolean): Promise<void> {
  await requireAdmin()
  await setCompanyPublished(id, published)
  revalidateCompanies()
}

export async function deleteCompanyAction(id: string): Promise<void> {
  await requireAdmin()
  await deleteCompany(id)
  revalidateCompanies()
}
