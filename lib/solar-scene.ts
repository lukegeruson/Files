// Pure, dependency-free model powering the 3D Solar Energy Explorer.
//
// It has two jobs:
//   1. Define a NORMALIZED snapshot that either calculator can publish, so the
//      3D scene never needs to know which tool produced its data (or whether
//      the data is real at all).
//   2. Turn one snapshot into a simple, deterministic 24-hour timeline of
//      energy flows the scene can animate.
//
// This is an EDUCATIONAL visualization, not an energy simulator. The curves are
// intentionally smooth and stylized; the only hard promise is internal
// consistency — the "today's savings" shown always ties back to the calculator's
// annual figure, and every kW of flow is conserved (production = home + battery
// + grid at every instant).

// ---------------------------------------------------------------------------
// Snapshot: the single contract between calculators and the scene
// ---------------------------------------------------------------------------

export type SolarSnapshot = {
  /** Which surface produced this, or "mock" for the un-connected placeholder. */
  source: "savings" | "panels" | "mock"
  /** Human label for context, e.g. "Arizona" or "national average". */
  stateName: string
  /** Nameplate system size in kW — drives midday peak and panel count. */
  systemSizeKw: number
  panelCount: number
  annualProductionKwh: number
  annualConsumptionKwh: number
  /** Production as a share of consumption; can exceed 100. */
  offsetPercent: number
  hasBattery: boolean
  /** Year-1 bill savings in dollars, when the source tool computes it. */
  annualSavings: number | null
  /** Yearly electricity bill without / with solar, when known. */
  billWithoutSolar: number | null
  billWithSolar: number | null
}

/**
 * Placeholder shown before any calculator has produced a real result. A
 * realistic, fully self-consistent ~100%-offset home so the scene looks alive
 * and the savings section reads sensibly on first paint.
 */
export const MOCK_SNAPSHOT: SolarSnapshot = {
  source: "mock",
  stateName: "national average",
  systemSizeKw: 7.6,
  panelCount: 19,
  annualProductionKwh: 11_600,
  annualConsumptionKwh: 11_000,
  offsetPercent: 105,
  hasBattery: true,
  annualSavings: 2_060,
  billWithoutSolar: 3_240,
  billWithSolar: 1_180,
}

// ---------------------------------------------------------------------------
// Timeline: one snapshot -> a day of energy flow
// ---------------------------------------------------------------------------

export type FlowKey =
  | "solarToHome"
  | "solarToBattery"
  | "solarToGrid"
  | "gridToHome"
  | "batteryToHome"

export const FLOW_KEYS: FlowKey[] = [
  "solarToHome",
  "solarToBattery",
  "solarToGrid",
  "gridToHome",
  "batteryToHome",
]

export type Frame = {
  /** Hour of day, 0–24 (can be fractional). */
  hour: number
  /** e.g. "12:30 PM". */
  label: string
  /** Coarse phase for the timeline ticks. */
  phase: "night" | "morning" | "midday" | "evening"
  /** Sun intensity 0–1 (0 at night, 1 at solar noon). */
  daylight: number
  solarKw: number
  consumptionKw: number
  /** Battery state of charge 0–1. */
  batterySoc: number
  /** Per-path power in kW. */
  flows: Record<FlowKey, number>
  /** Net grid exchange: positive = exporting, negative = importing. */
  gridKw: number
  /** Dollars saved from midnight up to this hour. */
  savingsSoFar: number
}

export type DayTimeline = {
  frames: Frame[]
  /** Total dollars saved across the simulated day. */
  dailySavings: number
  peakSolarKw: number
  peakConsumptionKw: number
  hasBattery: boolean
  batteryCapacityKwh: number
}

const DEFAULT_RATE = 0.165 // $/kWh, national-ish fallback
const PEAK_FACTOR = 0.92 // real arrays rarely hit nameplate; midday tops out here
const SUNRISE = 6
const SUNSET = 18
const BATTERY_CAPACITY_KWH = 13.5
const BATTERY_MAX_KW = 5 // charge/discharge ceiling
const STEP_MINUTES = 15

function gauss(x: number, mu: number, sigma: number): number {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma))
}

/** Raw daily consumption shape: low overnight, morning + evening peaks. */
function consumptionShape(hour: number): number {
  return (
    0.5 +
    0.7 * gauss(hour, 7.5, 1.8) +
    1.0 * gauss(hour, 19.5, 2.2) +
    0.25 * gauss(hour, 13, 3)
  )
}

/**
 * Mean of the raw shape over a day, computed once so instantaneous consumption
 * averages to the home's true average kW rather than drifting high or low.
 */
const CONSUMPTION_MEAN = (() => {
  let sum = 0
  const n = 24 * 4
  for (let i = 0; i < n; i++) sum += consumptionShape((i / n) * 24)
  return sum / n
})()

/** Sun intensity 0–1, a clean half-sine across daylight hours. */
export function daylightAt(hour: number): number {
  if (hour <= SUNRISE || hour >= SUNSET) return 0
  return Math.sin((Math.PI * (hour - SUNRISE)) / (SUNSET - SUNRISE))
}

/**
 * Sun position on a stylized east→west arc for the given hour. Returns null at
 * night so the scene can hide the sun. Coordinates are scene units; x runs
 * east(−)→west(+), y is height, z is a slight tilt toward the viewer.
 */
export function sunPosition(
  hour: number,
  radius = 9,
): [number, number, number] | null {
  if (hour <= SUNRISE || hour >= SUNSET) return null
  const angle = (Math.PI * (hour - SUNRISE)) / (SUNSET - SUNRISE) // 0..π
  const x = -Math.cos(angle) * radius // sunrise east (−x) → sunset west (+x)
  const y = Math.sin(angle) * radius * 0.7 + 1.2
  return [x, y, -2.5]
}

function phaseFor(hour: number): Frame["phase"] {
  if (hour < 5 || hour >= 20) return "night"
  if (hour < 11) return "morning"
  if (hour < 15) return "midday"
  return "evening"
}

function clockLabel(hour: number): string {
  const h24 = Math.floor(hour) % 24
  const m = Math.round((hour - Math.floor(hour)) * 60)
  const ampm = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

function emptyFlows(): Record<FlowKey, number> {
  return {
    solarToHome: 0,
    solarToBattery: 0,
    solarToGrid: 0,
    gridToHome: 0,
    batteryToHome: 0,
  }
}

/**
 * Build a full day of frames from a snapshot. Deterministic and pure, so the
 * scene can memoize on the snapshot and both the slider and "Run Day" button
 * simply index into `frames`.
 */
export function computeDayTimeline(snapshot: SolarSnapshot): DayTimeline {
  const avgConsumptionKw = snapshot.annualConsumptionKwh / 8760
  const rate =
    snapshot.billWithoutSolar && snapshot.annualConsumptionKwh
      ? snapshot.billWithoutSolar / snapshot.annualConsumptionKwh
      : DEFAULT_RATE
  const exportRate = rate * 0.8 // exports typically credit below retail
  const dt = STEP_MINUTES / 60
  const capacity = snapshot.hasBattery ? BATTERY_CAPACITY_KWH : 0

  const frames: Frame[] = []
  let soc = snapshot.hasBattery ? 0.25 : 0
  let rawSavings = 0
  let peakSolarKw = 0
  let peakConsumptionKw = 0

  // Pass 1: physical flows and a raw (unscaled) dollar tally.
  for (let hour = 0; hour <= 24 + 1e-9; hour += dt) {
    const daylight = daylightAt(hour)
    const solarKw = snapshot.systemSizeKw * daylight * PEAK_FACTOR
    const consumptionKw =
      avgConsumptionKw * (consumptionShape(hour) / CONSUMPTION_MEAN)

    peakSolarKw = Math.max(peakSolarKw, solarKw)
    peakConsumptionKw = Math.max(peakConsumptionKw, consumptionKw)

    const flows = emptyFlows()

    // Solar first serves the home.
    flows.solarToHome = Math.min(solarKw, consumptionKw)
    let surplus = solarKw - flows.solarToHome
    let deficit = consumptionKw - flows.solarToHome

    // Surplus charges the battery, then exports.
    if (surplus > 0 && capacity > 0 && soc < 1) {
      const room = (1 - soc) * capacity // kWh
      const charge = Math.min(surplus, BATTERY_MAX_KW, room / dt)
      flows.solarToBattery = charge
      soc += (charge * dt) / capacity
      surplus -= charge
    }
    flows.solarToGrid = Math.max(0, surplus)

    // Deficit draws the battery first, then imports.
    if (deficit > 0 && capacity > 0 && soc > 0) {
      const avail = soc * capacity // kWh
      const discharge = Math.min(deficit, BATTERY_MAX_KW, avail / dt)
      flows.batteryToHome = discharge
      soc -= (discharge * dt) / capacity
      deficit -= discharge
    }
    flows.gridToHome = Math.max(0, deficit)

    const gridKw = flows.solarToGrid - flows.gridToHome

    // Raw savings: on-site solar + battery displace retail, exports earn credit.
    const dollars =
      (flows.solarToHome + flows.batteryToHome) * rate * dt +
      flows.solarToGrid * exportRate * dt
    rawSavings += dollars

    frames.push({
      hour: Math.min(24, hour),
      label: clockLabel(hour),
      phase: phaseFor(hour),
      daylight,
      solarKw,
      consumptionKw,
      batterySoc: soc,
      flows,
      gridKw,
      savingsSoFar: rawSavings, // rescaled in pass 2
    })
  }

  // Pass 2: rescale dollars so the day ties back to the calculator's annual
  // savings (annual / 365). Falls back to the raw physical tally otherwise.
  const targetDaily =
    snapshot.annualSavings && snapshot.annualSavings > 0
      ? snapshot.annualSavings / 365
      : rawSavings
  const scale = rawSavings > 0 ? targetDaily / rawSavings : 0
  for (const f of frames) f.savingsSoFar *= scale

  return {
    frames,
    dailySavings: targetDaily,
    peakSolarKw,
    peakConsumptionKw,
    hasBattery: snapshot.hasBattery,
    batteryCapacityKwh: capacity,
  }
}

/** Nearest frame index for an hour — used by the slider and Run Day. */
export function frameIndexForHour(timeline: DayTimeline, hour: number): number {
  const n = timeline.frames.length
  if (n === 0) return 0
  const idx = Math.round((hour / 24) * (n - 1))
  return Math.min(n - 1, Math.max(0, idx))
}

// ---------------------------------------------------------------------------
// Component explanations (beginner-friendly, shown in click popups)
// ---------------------------------------------------------------------------

export type ComponentId =
  | "panels"
  | "inverter"
  | "battery"
  | "grid"
  | "meter"
  | "home"
  | "sun"

export type ComponentInfo = {
  id: ComponentId
  title: string
  blurb: string
}

export const COMPONENT_INFO: Record<ComponentId, ComponentInfo> = {
  panels: {
    id: "panels",
    title: "Solar panels",
    blurb:
      "Convert sunlight into DC electricity. More sun means more power — output peaks around midday.",
  },
  inverter: {
    id: "inverter",
    title: "Inverter",
    blurb:
      "Converts the panels' DC electricity into the AC electricity your home and appliances actually use.",
  },
  battery: {
    id: "battery",
    title: "Home battery",
    blurb:
      "Stores extra solar energy during the day so you can use it at night or during an outage instead of buying from the grid.",
  },
  grid: {
    id: "grid",
    title: "Utility grid",
    blurb:
      "Supplies power when your panels can't keep up, and accepts your extra solar — often crediting your bill for what you export.",
  },
  meter: {
    id: "meter",
    title: "Electricity meter",
    blurb:
      "Measures power flowing both ways: what you draw from the grid and what your system sends back to it.",
  },
  home: {
    id: "home",
    title: "Your home",
    blurb:
      "Your appliances, lights, and devices. Solar covers this load first; anything left over charges the battery or flows to the grid.",
  },
  sun: {
    id: "sun",
    title: "The sun",
    blurb:
      "The energy source. As it climbs toward noon, your panels produce more; in the evening production tapers to zero.",
  },
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function kw(value: number, digits = 1): string {
  return `${value.toFixed(digits)} kW`
}

export function money(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}
