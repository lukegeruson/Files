"use client"

import { useCallback, useEffect, useState } from "react"
import { EMPTY_QUIZ_ANSWERS, type QuizAnswers } from "./types"

const STORAGE_KEY = "evergreen.career-profile.v1"

/** Same-tab change signal (the storage event only fires in *other* tabs). */
const CHANGE_EVENT = "evergreen:career-profile-change"

export type CareerProfile = {
  answers: QuizAnswers
  savedCareers: string[]
  completedQuiz: boolean
  updatedAt?: number
}

export function emptyProfile(): CareerProfile {
  return { answers: { ...EMPTY_QUIZ_ANSWERS }, savedCareers: [], completedQuiz: false }
}

function read(): CareerProfile {
  if (typeof window === "undefined") return emptyProfile()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyProfile()
    const parsed = JSON.parse(raw) as Partial<CareerProfile>
    return {
      // Merge onto the empty shape so a stored profile written by an older
      // version can never leave a required array undefined.
      answers: { ...EMPTY_QUIZ_ANSWERS, ...(parsed.answers ?? {}) },
      savedCareers: parsed.savedCareers ?? [],
      completedQuiz: parsed.completedQuiz ?? false,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    // Corrupt JSON or storage blocked (private mode, quota) — fail soft.
    return emptyProfile()
  }
}

function write(profile: CareerProfile) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, updatedAt: Date.now() }))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Ignore write failures; in-memory state still drives the UI this session.
  }
}

/**
 * Career profile persisted to localStorage.
 *
 * `hydrated` stays false until the first client effect runs so callers can hold
 * back profile-dependent UI during SSR and avoid hydration mismatches.
 */
export function useProfile() {
  const [profile, setProfile] = useState<CareerProfile>(emptyProfile)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setProfile(read())
    setHydrated(true)

    const sync = () => setProfile(read())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  // Persist outside the state updater. Writing inside it means the write only
  // happens if React actually runs that updater — when the caller swaps views
  // in the same event (finishing the quiz), the component unmounts and the
  // updater is discarded, silently losing the answers.
  const saveAnswers = useCallback((answers: QuizAnswers, completed = true) => {
    // Read-modify-write against storage rather than inside the state updater.
    // React discards an updater whose component unmounts in the same event —
    // which is exactly what finishing the quiz does when the caller swaps to
    // the results view — so a write in there would silently lose the answers.
    const stored = read()
    const next: CareerProfile = {
      ...stored,
      answers,
      completedQuiz: completed || stored.completedQuiz,
    }
    write(next)
    setProfile(next)
  }, [])

  const toggleSaved = useCallback((careerId: string) => {
    const stored = read()
    const savedCareers = stored.savedCareers.includes(careerId)
      ? stored.savedCareers.filter((id) => id !== careerId)
      : [...stored.savedCareers, careerId]
    const next = { ...stored, savedCareers }
    write(next)
    setProfile(next)
  }, [])

  const toggleSkill = useCallback((skillId: string) => {
    const stored = read()
    const current = stored.answers.skills
    const skills = current.includes(skillId)
      ? current.filter((s) => s !== skillId)
      : [...current, skillId]
    const next = { ...stored, answers: { ...stored.answers, skills } }
    write(next)
    setProfile(next)
  }, [])

  const reset = useCallback(() => {
    const next = emptyProfile()
    setProfile(next)
    write(next)
  }, [])

  return { profile, hydrated, saveAnswers, toggleSaved, toggleSkill, reset }
}
