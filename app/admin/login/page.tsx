import Link from "next/link"
import { redirect } from "next/navigation"
import { AdminLoginForm } from "@/components/admin-login-form"
import { isAdmin } from "@/lib/admin-auth"

export const metadata = {
  title: "Admin Access — Evergreen Journal",
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage() {
  // Already unlocked, no reason to show the form again.
  if (await isAdmin()) redirect("/admin")

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-12 md:px-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to site
      </Link>

      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">
        Admin access
      </h1>
      <p className="mt-1 mb-8 text-sm leading-relaxed text-muted-foreground">
        Enter the passcode to manage posts.
      </p>

      <div className="rounded-xl border border-border bg-card p-5 md:p-6">
        <AdminLoginForm />
      </div>
    </main>
  )
}
