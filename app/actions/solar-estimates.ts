"use server"

import { desc, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { solarEstimates, type SolarEstimateRow } from "@/lib/db/schema"
import {
  DEFAULT_ASSUMPTIONS,
  ORIENTATION_LABELS,
  PAYMENT_LABELS,
  ROOF_CONDITION_LABELS,
  ROOF_TYPE_LABELS,
  SHADE_LABELS,
  computeSolar,
  type SolarInputs,
} from "@/lib/solar"

const MAX_SHORT = 200

export type SolarUnlockState = {
  status: "idle" | "sent" | "error"
  message?: string
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

function oneOf<T extends string>(labels: Record<T, string>, value: unknown): value is T {
  return typeof value === "string" && Object.hasOwn(labels, value)
}

function finiteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
}

/** Rebuilds SolarInputs from untrusted JSON, rejecting anything out of shape. */
function parseInputs(raw: string): SolarInputs | null {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== "object") return null

  const zip = typeof data.zip === "string" ? data.zip.replace(/\D/g, "").slice(0, 5) : ""
  if (zip.length < 3) return null
  if (!finiteInRange(data.monthlyBill, 0, 100_000)) return null
  const monthlyKwh = data.monthlyKwh === null ? null : data.monthlyKwh
  if (monthlyKwh !== null && !finiteInRange(monthlyKwh, 0, 1_000_000)) return null
  const rate = data.rate === null ? null : data.rate
  if (rate !== null && !finiteInRange(rate, 0, 10)) return null
  if (data.monthlyBill <= 0 && !(monthlyKwh && monthlyKwh > 0)) return null
  if (!oneOf(ROOF_CONDITION_LABELS, data.roofCondition)) return null
  if (!oneOf(ROOF_TYPE_LABELS, data.roofType)) return null
  if (!oneOf(ORIENTATION_LABELS, data.orientation)) return null
  if (!oneOf(SHADE_LABELS, data.shade)) return null
  if (!oneOf(PAYMENT_LABELS, data.payment)) return null
  if (!finiteInRange(data.yearsInHome, 0, 100)) return null

  return {
    zip,
    monthlyBill: data.monthlyBill,
    monthlyKwh,
    rate,
    utility: typeof data.utility === "string" ? data.utility.trim().slice(0, MAX_SHORT) : "",
    roofCondition: data.roofCondition,
    roofType: data.roofType,
    orientation: data.orientation,
    shade: data.shade,
    hasEv: data.hasEv === true,
    wantsBattery: data.wantsBattery === true,
    yearsInHome: data.yearsInHome,
    payment: data.payment,
  }
}

/**
 * Records the visitor's contact details together with every calculator input,
 * which unlocks their results. Results are recomputed here from the inputs so
 * the stored numbers never depend on what the browser claims.
 */
export async function submitSolarEstimate(
  _prev: SolarUnlockState,
  formData: FormData,
): Promise<SolarUnlockState> {
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").trim()
  const consent = formData.get("consent")
  const inputs = parseInputs(String(formData.get("inputs") ?? ""))

  if (!name) return { status: "error", message: "Add your name." }
  if (name.length > MAX_SHORT) return { status: "error", message: "That name is too long." }
  if (!isEmail(email) || email.length > MAX_SHORT) {
    return { status: "error", message: "Enter a valid email address." }
  }
  const phoneDigits = phone.replace(/\D/g, "")
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { status: "error", message: "Enter a valid phone number." }
  }
  if (!consent) {
    return { status: "error", message: "Please agree to be contacted about your estimate." }
  }
  if (!inputs) {
    return { status: "error", message: "Your calculator answers look incomplete. Check them and try again." }
  }

  const result = computeSolar(inputs, DEFAULT_ASSUMPTIONS)

  try {
    await db.insert(solarEstimates).values({
      name,
      email,
      phone,
      zip: inputs.zip,
      inputs,
      systemKw: result.systemSizeKw,
      panelCount: result.panelCount,
      netCost: Math.round(result.netCost),
      monthlySavings: Math.round(result.monthlySavings),
      paybackYears: result.paybackYears,
      roiPercent: result.roiPercent,
      netLifetimeGain: Math.round(result.netLifetimeGain),
    })
  } catch (error) {
    console.log("[v0] solar estimate insert failed:", error)
    return { status: "error", message: "We could not save your details. Please try again in a moment." }
  }

  revalidatePath("/admin/solar-estimates")
  return { status: "sent" }
}

export async function listSolarEstimates(): Promise<SolarEstimateRow[]> {
  await requireAdmin()
  return db.select().from(solarEstimates).orderBy(desc(solarEstimates.createdAt))
}

export async function countUnreadSolarEstimates(): Promise<number> {
  await requireAdmin()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(solarEstimates)
    .where(isNull(solarEstimates.readAt))
  return row?.count ?? 0
}

export async function setSolarEstimateRead(id: string, read: boolean): Promise<void> {
  await requireAdmin()
  await db
    .update(solarEstimates)
    .set({ readAt: read ? new Date() : null })
    .where(eq(solarEstimates.id, id))
  revalidatePath("/admin/solar-estimates")
}

export async function deleteSolarEstimate(id: string): Promise<void> {
  await requireAdmin()
  await db.delete(solarEstimates).where(eq(solarEstimates.id, id))
  revalidatePath("/admin/solar-estimates")
}
