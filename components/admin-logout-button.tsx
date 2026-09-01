import { LogOut } from "lucide-react"
import { logoutAction } from "@/app/admin/auth-actions"

export function AdminLogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        Lock
      </button>
    </form>
  )
}
