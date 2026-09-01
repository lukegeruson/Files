import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const COOKIE_NAME = "helios_admin"
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 hours

function getSecret(): string {
  const secret = process.env.ADMIN_PASSCODE
  if (!secret) {
    throw new Error(
      "ADMIN_PASSCODE is not set. Add it in the Vars section of the v0 settings menu.",
    )
  }
  return secret
}

/** HMAC of an arbitrary string, keyed with the passcode. Always 64 hex chars. */
function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex")
}

/**
 * Constant-time string compare. Both arguments must already be fixed-length
 * (we only ever pass HMAC digests) so length alone cannot leak information.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Check a submitted passcode. Both sides are hashed first so the comparison
 * runs over equal-length buffers and reveals nothing about the real length.
 */
export function verifyPasscode(input: string): boolean {
  return safeEqual(sign(input), sign(getSecret()))
}

/** Issue a signed, httpOnly session cookie. */
export async function createSession(): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000
  const token = `${expiresAt}.${sign(`session:${expiresAt}`)}`
  const store = await cookies()

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    // SameSite=None + Secure is required for the cookie to survive inside the
    // v0 preview iframe, which is a cross-site context.
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** True when the request carries a valid, unexpired admin session. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return false

  const separator = token.lastIndexOf(".")
  if (separator === -1) return false

  const expiresAt = Number(token.slice(0, separator))
  const signature = token.slice(separator + 1)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false

  return safeEqual(signature, sign(`session:${expiresAt}`))
}

/**
 * Guard for admin pages and mutating server actions. Redirects to the login
 * screen when there is no valid session.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login")
}
