"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { FormState } from "@/app/actions"
import {
  CATEGORIES,
  CATEGORY_LABELS,
  POST_TAGS,
  POST_TAG_LABELS,
  type Post,
} from "@/lib/categories"

export function PostForm({
  action,
  post,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  post?: Post
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  )

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={post?.title}
          placeholder="How solar batteries keep the lights on"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          defaultValue={post?.category ?? CATEGORIES[0]}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Collections</legend>
        {POST_TAGS.map((tag) => (
          <label key={tag} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="tags"
              value={tag}
              defaultChecked={post?.tags.includes(tag)}
              className="size-4 rounded border-input accent-primary"
            />
            {POST_TAG_LABELS[tag]}
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          Optional and additive. The post keeps its category above and also
          appears in any collection you check here.
        </p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="coverImage">Cover image path</Label>
        <Input
          id="coverImage"
          name="coverImage"
          defaultValue={post?.coverImage}
          placeholder="/blog/placeholder-cover.png"
        />
        <p className="text-xs text-muted-foreground">
          Optional. Leave blank to use a default cover.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea
          id="excerpt"
          name="excerpt"
          defaultValue={post?.excerpt}
          rows={2}
          placeholder="A short summary shown on cards and previews."
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={post?.content}
          rows={14}
          placeholder={"Write your article. Separate paragraphs with a blank line.\n\n# Section heading\n## Subheading\n### Minor heading"}
          required
        />
        <p className="text-xs text-muted-foreground">
          Supports Markdown headings pasted from other tools: {"# "}, {"## "},
          and {"### "} on their own line (with a blank line above). For SEO the
          page title stays the only H1, so these render as H2, H3, and H4.
          Separate paragraphs with a blank line.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={post ? post.published : true}
          className="size-4 rounded border-input accent-primary"
        />
        Published (visible on the public site)
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/admin">Cancel</Link>}
        />
      </div>
    </form>
  )
}
