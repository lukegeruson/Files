"use client"

import { Check, RotateCcw, Trash2 } from "lucide-react"
import { useTransition } from "react"

// Shared by the leads and partner-applications inboxes. The specific server
// actions are passed in as props by each admin page, so the read/delete UI and
// its accessibility labels live in one place rather than being copied per table.
const BUTTON =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"

export function RecordReadToggle({
  id,
  read,
  label,
  toggleAction,
}: {
  id: string
  read: boolean
  label: string
  toggleAction: (id: string, read: boolean) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void toggleAction(id, !read))}
      aria-label={read ? `Mark ${label} as unhandled` : `Mark ${label} as handled`}
      className={BUTTON}
    >
      {read ? (
        <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Check className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">
        {pending ? "Saving..." : read ? "Unread" : "Handled"}
      </span>
    </button>
  )
}

export function RecordDeleteButton({
  id,
  label,
  deleteAction,
}: {
  id: string
  label: string
  deleteAction: (id: string) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    // This row is the only copy — nothing is emailed — so confirm before it is
    // gone for good.
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return
    startTransition(() => void deleteAction(id))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Delete ${label}`}
      className={`${BUTTON} hover:border-destructive hover:text-destructive`}
    >
      <Trash2 className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{pending ? "Deleting..." : "Delete"}</span>
    </button>
  )
}
