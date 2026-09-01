import { redirect } from "next/navigation"

/**
 * Matches used to be its own tab. The quiz now hands off to the results in
 * place, so this route only exists to keep old links and bookmarks working —
 * the quiz page shows saved results immediately when a profile exists.
 */
export default function MatchesPage() {
  redirect("/jobs/quiz")
}
