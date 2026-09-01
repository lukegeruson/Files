"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction, type LoginState } from "@/app/admin/auth-actions"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Checking…" : "Unlock"}
    </Button>
  )
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {})

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="passcode">Passcode</Label>
        <Input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          // 16px minimum keeps iOS Safari from auto-zooming the field.
          className="text-base"
          aria-describedby={state.error ? "passcode-error" : undefined}
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      {state.error && (
        <p
          id="passcode-error"
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <KeyRound className="size-3.5 shrink-0" aria-hidden="true" />
        This session stays unlocked for 12 hours.
      </p>
    </form>
  )
}
