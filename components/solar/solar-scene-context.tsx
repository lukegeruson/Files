"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import {
  computeDayTimeline,
  MOCK_SNAPSHOT,
  type DayTimeline,
  type SolarSnapshot,
} from "@/lib/solar-scene"

type SceneContextValue = {
  snapshot: SolarSnapshot
  timeline: DayTimeline
  /** True once a real calculator result has replaced the mock placeholder. */
  isLive: boolean
  publish: (snapshot: SolarSnapshot | null) => void
}

const SolarSceneContext = createContext<SceneContextValue | null>(null)

/**
 * Wraps the calculators and the 3D explorer so data can flow from the tools
 * (which own the state) up to the diagram that sits above them. The provider is
 * the single source of truth; calculators push into it and the scene reads.
 */
export function SolarSceneProvider({ children }: { children: React.ReactNode }) {
  const [published, setPublished] = useState<SolarSnapshot | null>(null)

  // A stable identity so effects in the calculators don't loop.
  const publish = useCallback((snapshot: SolarSnapshot | null) => {
    setPublished(snapshot)
  }, [])

  const snapshot = published ?? MOCK_SNAPSHOT
  const timeline = useMemo(() => computeDayTimeline(snapshot), [snapshot])

  const value = useMemo<SceneContextValue>(
    () => ({ snapshot, timeline, isLive: published !== null, publish }),
    [snapshot, timeline, published, publish],
  )

  return (
    <SolarSceneContext.Provider value={value}>
      {children}
    </SolarSceneContext.Provider>
  )
}

/** Read the current scene data. Safe outside a provider (returns the mock). */
export function useSolarScene(): SceneContextValue {
  const ctx = useContext(SolarSceneContext)
  if (ctx) return ctx
  // Fallback keeps the scene renderable in isolation (e.g. tests, storybook).
  const timeline = computeDayTimeline(MOCK_SNAPSHOT)
  return {
    snapshot: MOCK_SNAPSHOT,
    timeline,
    isLive: false,
    publish: () => {},
  }
}

/**
 * Publisher for the calculators. Returns a no-op when no provider is mounted,
 * so a calculator rendered on its own never crashes.
 */
export function usePublishSolarScene(): (s: SolarSnapshot | null) => void {
  const ctx = useContext(SolarSceneContext)
  return ctx?.publish ?? (() => {})
}
