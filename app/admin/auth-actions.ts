"use server"

import { redirect } from "next/navigation"
import { createSession, destroySession, verifyPasscode } from "@/lib/admin-auth"

export type LoginState = { error?: string }

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const passcode = String(formData.get("passcode") ?? "")

  if (!passcode) return { error: "Enter the passcode." }

  // Small fixed delay to make automated guessing slow and expensive.
  await new Promise((resolve) => setTimeout(resolve, 500))

  if (!verifyPasscode(passcode)) return { error: "Incorrect passcode." }

  await createSession()
  redirect("/admin")
}

export async function logoutAction() {
  await destroySession()
  redirect("/admin/login")
}
