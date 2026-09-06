"use client"

import { Eye, EyeOff, Trash2 } from "lucide-react"
import { useTransition } from "react"
import { deleteCompanyAction, setCompanyPublishedAction } from "@/app/actions/companies"

const BUTTON =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"

export function CompanyPublishToggle({
  id,
  published,
  name,
}: {
  id: string
  published: boolean
  name: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void setCompanyPublishedAction(id, !published))}
      aria-label={published ? `Unpublish ${name}` : `Publish ${name}`}
      className={BUTTON}
    >
      {published ? (
        <EyeOff className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Eye className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">
        {pending ? "Saving..." : published ? "Unpublish" : "Publish"}
      </span>
    </button>
  )
}

export function CompanyDeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    startTransition(() => void deleteCompanyAction(id))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Delete ${name}`}
      className={`${BUTTON} hover:border-destructive hover:text-destructive`}
    >
      <Trash2 className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{pending ? "Deleting..." : "Delete"}</span>
    </button>
  )
}
