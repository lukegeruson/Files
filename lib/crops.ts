// Crop selection engine for the "What should I grow?" tool.
//
// IMPORTANT HONESTY NOTE, since this is agronomic advice:
// Every number here is a researched national/regional TYPICAL value, not a
// local recommendation. Yields, prices, and input costs vary enormously by
// county, soil, year, and contract. The engine is built to surface the
// TRADE-OFFS between crops given a farm's real constraints — season length,
// soil, water, equipment, labor, capital, storage, and market access — not to
// promise an outcome. The UI must always route users to their local extension
// service for verification.

import { resolveStateFromZip } from "@/lib/zip"

/* ------------------------------------------------------------------ *
 * Farm inputs
 * ------------------------------------------------------------------ */

export type SoilId = "sand" | "sandy-loam" | "loam" | "silt-loam" | "clay-loam" | "clay"
export type Drainage = "poor" | "moderate" | "well"
export type SoilPh = "acidic" | "neutral" | "alkaline" | "unknown"
export type Irrigation = "none" | "limited" | "full"
export type EquipmentTier = "hand" | "basic" | "rowcrop" | "specialty"
export type LaborLevel = "solo" | "family" | "crew"
export type CapitalLevel = "tight" | "moderate" | "strong"
export type StorageLevel = "none" | "dry" | "cooled"
export type MarketAccess = "commodity" | "contract" | "local"

export type PriorityId =
  | "profit"
  | "risk"
  | "water"
  | "labor"
  | "season"
  | "market"
  | "soil"
  | "diversify"

export const SOIL_LABELS: Record<SoilId, string> = {
  sand: "Sand",
  "sandy-loam": "Sandy loam",
  loam: "Loam",
  "silt-loam": "Silt loam",
  "clay-loam": "Clay loam",
  clay: "Clay",
}

export const DRAINAGE_LABELS: Record<Drainage, string> = {
  poor: "Poorly drained",
  moderate: "Moderately drained",
  well: "Well drained",
}

export const PH_LABELS: Record<SoilPh, string> = {
  acidic: "Acidic (under 6.0)",
  neutral: "Neutral (6.0–7.3)",
  alkaline: "Alkaline (over 7.3)",
  unknown: "Not tested",
}

export const IRRIGATION_LABELS: Record<Irrigation, string> = {
  none: "Rain-fed only",
  limited: "Limited / supplemental",
  full: "Full irrigation",
}

export const EQUIPMENT_LABELS: Record<EquipmentTier, string> = {
  hand: "Hand tools / walk-behind",
  basic: "Tractor and tillage",
  rowcrop: "Row-crop planter and combine",
  specialty: "Specialty harvest equipment",
}

export const LABOR_LABELS: Record<LaborLevel, string> = {
  solo: "Just me",
  family: "Family / part-time help",
  crew: "Hired crew",
}

export const CAPITAL_LABELS: Record<CapitalLevel, string> = {
  tight: "Tight",
  moderate: "Moderate",
  strong: "Well capitalized",
}

export const STORAGE_LABELS: Record<StorageLevel, string> = {
  none: "No storage — sell at harvest",
  dry: "Dry / ambient storage",
  cooled: "Cooled or controlled storage",
}

export const MARKET_LABELS: Record<MarketAccess, string> = {
  commodity: "Elevator / commodity buyer",
  contract: "Contract with a processor",
  local: "Local, direct, or farmers market",
}

export const PRIORITY_LABELS: Record<PriorityId, { label: string; detail: string }> = {
  profit: { label: "Maximum profit", detail: "Rank by projected margin per acre." },
  risk: { label: "Lowest risk", detail: "Favor stable prices, reliable yields, low perishability." },
  water: { label: "Low water use", detail: "Favor crops that finish on less moisture." },
  labor: { label: "Low labor", detail: "Favor crops with few field hours per acre." },
  season: { label: "Short season", detail: "Favor crops that mature quickly." },
  market: { label: "Reliable market", detail: "Favor established buyers and multiple outlets." },
  soil: { label: "Soil improvement", detail: "Favor nitrogen fixers and organic-matter builders." },
  diversify: {
    label: "Diversification",
    detail: "Favor crops outside the commodity price cycle with more than one outlet.",
  },
}

/** Field hours realistically available across a season, by labor level. */
const LABOR_HOURS_AVAILABLE: Record<LaborLevel, number> = {
  solo: 1200,
  family: 2600,
  crew: 9000,
}

/**
 * Total operating capital available for the season, by capital level. This is
 * deliberately a whole-farm budget rather than a per-acre figure: five acres of
 * a $6,000/ac vegetable is an ordinary market-garden budget, while the same
 * per-acre cost across 400 acres is a completely different proposition.
 */
const CAPITAL_TOTAL: Record<CapitalLevel, number> = {
  // These reflect the operating line a farm can realistically carry, not cash
  // on hand. A 400-acre corn farm routinely funds ~$290k of inputs through an
  // annual operating loan, so the middle tier has to accommodate that.
  tight: 60_000,
  moderate: 350_000,
  strong: 1_500_000,
}

const EQUIPMENT_RANK: Record<EquipmentTier, number> = {
  hand: 0,
  basic: 1,
  rowcrop: 2,
  specialty: 3,
}

/** Hourly rate used to value labor, including the operator's own time. */
export const LABOR_RATE = 17

/* ------------------------------------------------------------------ *
 * Climate — statewide typical values
 * ------------------------------------------------------------------ */

type StateClimate = {
  /** Typical frost-free days statewide. */
  frostFreeDays: number
  /** Typical annual precipitation, inches. */
  annualRainIn: number
}

/**
 * Statewide typical climate. These are coarse averages — a mountain county and
 * a river valley in the same state differ by weeks of season and inches of
 * rain — so the UI exposes both values as editable inputs.
 */
const STATE_CLIMATE: Record<string, StateClimate> = {
  AL: { frostFreeDays: 220, annualRainIn: 56 },
  AK: { frostFreeDays: 105, annualRainIn: 22 },
  AZ: { frostFreeDays: 240, annualRainIn: 13 },
  AR: { frostFreeDays: 210, annualRainIn: 50 },
  CA: { frostFreeDays: 260, annualRainIn: 22 },
  CO: { frostFreeDays: 145, annualRainIn: 16 },
  CT: { frostFreeDays: 170, annualRainIn: 48 },
  DE: { frostFreeDays: 195, annualRainIn: 45 },
  DC: { frostFreeDays: 200, annualRainIn: 40 },
  FL: { frostFreeDays: 300, annualRainIn: 54 },
  GA: { frostFreeDays: 220, annualRainIn: 50 },
  HI: { frostFreeDays: 365, annualRainIn: 63 },
  ID: { frostFreeDays: 130, annualRainIn: 19 },
  IL: { frostFreeDays: 175, annualRainIn: 39 },
  IN: { frostFreeDays: 170, annualRainIn: 42 },
  IA: { frostFreeDays: 160, annualRainIn: 34 },
  KS: { frostFreeDays: 180, annualRainIn: 29 },
  KY: { frostFreeDays: 190, annualRainIn: 48 },
  LA: { frostFreeDays: 250, annualRainIn: 60 },
  ME: { frostFreeDays: 130, annualRainIn: 44 },
  MD: { frostFreeDays: 190, annualRainIn: 44 },
  MA: { frostFreeDays: 165, annualRainIn: 48 },
  MI: { frostFreeDays: 145, annualRainIn: 33 },
  MN: { frostFreeDays: 140, annualRainIn: 28 },
  MS: { frostFreeDays: 230, annualRainIn: 56 },
  MO: { frostFreeDays: 190, annualRainIn: 42 },
  MT: { frostFreeDays: 120, annualRainIn: 15 },
  NE: { frostFreeDays: 160, annualRainIn: 24 },
  NV: { frostFreeDays: 150, annualRainIn: 10 },
  NH: { frostFreeDays: 140, annualRainIn: 43 },
  NJ: { frostFreeDays: 180, annualRainIn: 46 },
  NM: { frostFreeDays: 190, annualRainIn: 14 },
  NY: { frostFreeDays: 150, annualRainIn: 42 },
  NC: { frostFreeDays: 210, annualRainIn: 50 },
  ND: { frostFreeDays: 125, annualRainIn: 18 },
  OH: { frostFreeDays: 165, annualRainIn: 39 },
  OK: { frostFreeDays: 210, annualRainIn: 36 },
  OR: { frostFreeDays: 180, annualRainIn: 27 },
  PA: { frostFreeDays: 165, annualRainIn: 43 },
  RI: { frostFreeDays: 175, annualRainIn: 48 },
  SC: { frostFreeDays: 230, annualRainIn: 50 },
  SD: { frostFreeDays: 135, annualRainIn: 20 },
  TN: { frostFreeDays: 200, annualRainIn: 54 },
  TX: { frostFreeDays: 240, annualRainIn: 28 },
  UT: { frostFreeDays: 150, annualRainIn: 12 },
  VT: { frostFreeDays: 135, annualRainIn: 43 },
  VA: { frostFreeDays: 195, annualRainIn: 44 },
  WA: { frostFreeDays: 165, annualRainIn: 38 },
  WV: { frostFreeDays: 165, annualRainIn: 45 },
  WI: { frostFreeDays: 145, annualRainIn: 33 },
  WY: { frostFreeDays: 115, annualRainIn: 13 },
}

const NATIONAL_CLIMATE: StateClimate = { frostFreeDays: 175, annualRainIn: 36 }

/** Share of annual precipitation that typically falls in the growing season. */
const GROWING_SEASON_RAIN_SHARE = 0.65

/**
 * Plant-available water a soil can supply from storage over a season, inches.
 * This matters enormously for rain-fed farming — a deep silt loam carries a
 * crop through a dry spell that would kill the same crop on sand.
 */
const SOIL_WATER_RESERVE: Record<SoilId, number> = {
  sand: 1,
  "sandy-loam": 2.5,
  loam: 4.5,
  "silt-loam": 5,
  "clay-loam": 4.5,
  clay: 3.5,
}

export type ResolvedClimate = {
  stateCode: string | null
  stateName: string
  frostFreeDays: number
  annualRainIn: number
  isFallback: boolean
}

export function resolveClimate(zip: string): ResolvedClimate {
  const state = resolveStateFromZip(zip)
  if (!state || !STATE_CLIMATE[state.code]) {
    return {
      stateCode: null,
      stateName: "National average",
      frostFreeDays: NATIONAL_CLIMATE.frostFreeDays,
      annualRainIn: NATIONAL_CLIMATE.annualRainIn,
      isFallback: true,
    }
  }
  const c = STATE_CLIMATE[state.code]
  return {
    stateCode: state.code,
    stateName: state.name,
    frostFreeDays: c.frostFreeDays,
    annualRainIn: c.annualRainIn,
    isFallback: false,
  }
}

/* ------------------------------------------------------------------ *
 * Crop profiles
 * ------------------------------------------------------------------ */

export type CropGroup = "grain" | "oilseed" | "legume" | "forage" | "vegetable" | "perennial" | "cover"

export const GROUP_LABELS: Record<CropGroup, string> = {
  grain: "Grain",
  oilseed: "Oilseed",
  legume: "Legume",
  forage: "Forage / hay",
  vegetable: "Vegetable",
  perennial: "Perennial fruit",
  cover: "Cover crop",
}

export type CropProfile = {
  id: string
  name: string
  group: CropGroup
  /** Frost-free days needed from planting to harvest. */
  seasonDays: number
  /** Fall-planted crops overwinter, so spring frost dates matter less. */
  fallPlanted?: boolean
  /** Years from establishment to first full harvest (perennials). */
  establishYears?: number
  /** One-time establishment cost per acre (perennials). */
  establishCostPerAcre?: number
  /** Productive stand life in years (perennials and alfalfa). */
  standYears?: number
  plantingWindow: string
  /** Seasonal water requirement, inches. */
  waterInches: number
  /** 1 = very thirsty, 5 = very drought tolerant. */
  droughtTolerance: number
  /** Relative fit per soil texture, 0–1. */
  soilFit: Record<SoilId, number>
  /** Minimum drainage the crop tolerates. */
  drainageNeed: Drainage
  /** Preferred pH band, or null when broadly tolerant. */
  phPreference: SoilPh | null
  yieldLow: number
  yieldExpected: number
  yieldHigh: number
  yieldUnit: string
  priceLow: number
  priceExpected: number
  priceHigh: number
  /**
   * Operating (variable) inputs per acre, excluding labor: seed, fertilizer,
   * crop protection, fuel, repairs, and post-harvest handling. Commodity crops
   * are calibrated to USDA ERS cost-of-production operating cost.
   *
   * This deliberately excludes ownership and overhead — land rent, machinery
   * depreciation, insurance, utilities, general farm overhead — so this tool
   * ranks crops on gross margin, where those shared costs would only add noise.
   * The farm profitability calculator layers them on to reach a true net.
   */
  inputCostPerAcre: number
  laborHoursPerAcre: number
  equipment: EquipmentTier
  storage: StorageLevel
  market: MarketAccess
  /** Number of realistic sales outlets, 1–3. */
  marketChannels: number
  /** 1 = stable, 5 = volatile. */
  priceVolatility: number
  yieldVolatility: number
  /** 1 = stores for months, 5 = must move in days. */
  perishability: number
  /** -1 = depleting, 3 = strongly soil-building. */
  soilBuilding: number
  /** Below this acreage the machinery cost per acre is hard to justify. */
  minEfficientAcres: number
  /** Above this acreage the labor or market usually breaks down. */
  maxPracticalAcres: number
  note: string
  storageNote: string
  marketNote: string
}

/**
 * Crop profiles use typical U.S. figures for yield, price, and operating cost.
 * Row-crop margins are genuinely thin and vegetable margins genuinely
 * labor-bound; both are represented honestly rather than flattered.
 */
export const CROPS: CropProfile[] = [
  {
    id: "corn",
    name: "Corn (grain)",
    group: "grain",
    seasonDays: 125,
    plantingWindow: "Spring, once soil holds 50°F",
    waterInches: 24,
    droughtTolerance: 2,
    soilFit: { sand: 0.4, "sandy-loam": 0.7, loam: 1, "silt-loam": 1, "clay-loam": 0.85, clay: 0.6 },
    drainageNeed: "moderate",
    phPreference: "neutral",
    yieldLow: 145,
    yieldExpected: 180,
    yieldHigh: 220,
    yieldUnit: "bu",
    priceLow: 3.9,
    priceExpected: 4.6,
    priceHigh: 5.6,
    inputCostPerAcre: 520,
    laborHoursPerAcre: 2.5,
    equipment: "rowcrop",
    storage: "dry",
    market: "commodity",
    marketChannels: 3,
    priceVolatility: 3,
    yieldVolatility: 3,
    perishability: 1,
    soilBuilding: -1,
    minEfficientAcres: 40,
    maxPracticalAcres: 100000,
    note: "The default Corn Belt cash crop. High input cost per acre and thin margins, but the market is deep and the agronomy is well understood.",
    storageNote: "Dries and stores for months. On-farm bins let you sell after harvest lows.",
    marketNote: "Elevators, ethanol plants, and feedlots all bid. Easiest crop in the country to sell.",
  },
  {
    id: "soybeans",
    name: "Soybeans",
    group: "legume",
    seasonDays: 115,
    plantingWindow: "Spring, after corn planting",
    waterInches: 20,
    droughtTolerance: 3,
    soilFit: { sand: 0.4, "sandy-loam": 0.7, loam: 1, "silt-loam": 1, "clay-loam": 0.9, clay: 0.7 },
    drainageNeed: "moderate",
    phPreference: "neutral",
    yieldLow: 42,
    yieldExpected: 54,
    yieldHigh: 66,
    yieldUnit: "bu",
    priceLow: 10.2,
    priceExpected: 11.5,
    priceHigh: 13.5,
    inputCostPerAcre: 300,
    laborHoursPerAcre: 2,
    equipment: "rowcrop",
    storage: "dry",
    market: "commodity",
    marketChannels: 3,
    priceVolatility: 3,
    yieldVolatility: 3,
    perishability: 1,
    soilBuilding: 2,
    minEfficientAcres: 40,
    maxPracticalAcres: 100000,
    note: "Fixes its own nitrogen, so input cost runs far below corn. The standard rotation partner that also improves the following year's corn.",
    storageNote: "Stores well dry. Less shrink risk than corn.",
    marketNote: "Crushers and elevators bid year-round. Strong export demand.",
  },
  {
    id: "winter-wheat",
    name: "Winter wheat",
    group: "grain",
    seasonDays: 110,
    fallPlanted: true,
    plantingWindow: "Fall, 6 weeks before hard freeze",
    waterInches: 16,
    droughtTolerance: 4,
    soilFit: { sand: 0.5, "sandy-loam": 0.8, loam: 1, "silt-loam": 1, "clay-loam": 0.9, clay: 0.7 },
    drainageNeed: "moderate",
    phPreference: "neutral",
    yieldLow: 45,
    yieldExpected: 62,
    yieldHigh: 82,
    yieldUnit: "bu",
    priceLow: 5.6,
    priceExpected: 6.5,
    priceHigh: 7.8,
    inputCostPerAcre: 235,
    laborHoursPerAcre: 1.8,
    equipment: "rowcrop",
    storage: "dry",
    market: "commodity",
    marketChannels: 3,
    priceVolatility: 3,
    yieldVolatility: 2,
    perishability: 1,
    soilBuilding: 1,
    minEfficientAcres: 40,
    maxPracticalAcres: 100000,
    note: "Fall-planted and harvested by midsummer, which spreads labor away from the spring rush and frees the field for a double crop.",
    storageNote: "Very stable in dry storage. Protein premiums reward testing before you sell.",
    marketNote: "Elevators and flour mills. Protein and falling-number specs affect price.",
  },
  {
    id: "sorghum",
    name: "Grain sorghum (milo)",
    group: "grain",
    seasonDays: 110,
    plantingWindow: "Late spring, warm soil",
    waterInches: 15,
    droughtTolerance: 5,
    soilFit: { sand: 0.6, "sandy-loam": 0.85, loam: 1, "silt-loam": 0.95, "clay-loam": 0.9, clay: 0.75 },
    drainageNeed: "moderate",
    phPreference: null,
    yieldLow: 58,
    yieldExpected: 85,
    yieldHigh: 112,
    yieldUnit: "bu",
    priceLow: 3.8,
    priceExpected: 4.4,
    priceHigh: 5.3,
    inputCostPerAcre: 250,
    laborHoursPerAcre: 2,
    equipment: "rowcrop",
    storage: "dry",
    market: "commodity",
    marketChannels: 2,
    priceVolatility: 3,
    yieldVolatility: 2,
    perishability: 1,
    soilBuilding: 0,
    minEfficientAcres: 40,
    maxPracticalAcres: 100000,
    note: "The dryland answer where corn burns up. Finishes a crop on roughly a third less water and tolerates heat that stalls corn pollination.",
    storageNote: "Stores like other small grains.",
    marketNote: "Thinner market than corn — confirm a local buyer before planting acres.",
  },
  {
    id: "oats",
    name: "Oats",
    group: "grain",
    seasonDays: 95,
    plantingWindow: "Very early spring",
    waterInches: 14,
    droughtTolerance: 3,
    soilFit: { sand: 0.6, "sandy-loam": 0.85, loam: 1, "silt-loam": 1, "clay-loam": 0.9, clay: 0.75 },
    drainageNeed: "moderate",
    phPreference: null,
    yieldLow: 70,
    yieldExpected: 92,
    yieldHigh: 115,
    yieldUnit: "bu",
    priceLow: 3.6,
    priceExpected: 4.3,
    priceHigh: 5.2,
    inputCostPerAcre: 190,
    laborHoursPerAcre: 1.6,
    equipment: "rowcrop",
    storage: "dry",
    market: "commodity",
    marketChannels: 2,
    priceVolatility: 2,
    yieldVolatility: 2,
    perishability: 1,
    soilBuilding: 1,
    minEfficientAcres: 25,
    maxPracticalAcres: 100000,
    note: "The shortest-season small grain and the cheapest to put in. Often grown as a nurse crop when seeding alfalfa or pasture.",
    storageNote: "Dry storage. Food-grade oats need cleaner grain and pay a premium.",
    marketNote: "Feed markets are local; food-grade contracts pay better but demand quality.",
  },
  {
    id: "barley",
    name: "Barley",
    group: "grain",
    seasonDays: 95,
    plantingWindow: "Early spring",
    waterInches: 15,
    droughtTolerance: 4,
    soilFit: { sand: 0.55, "sandy-loam": 0.85, loam: 1, "silt-loam": 0.95, "clay-loam": 0.9, clay: 0.7 },
    drainageNeed: "moderate",
    phPreference: "neutral",
    yieldLow: 62,
    yieldExpected: 85,
    yieldHigh: 105,
    yieldUnit: "bu",
    priceLow: 4.8,
    priceExpected: 5.7,
    priceHigh: 7,
    inputCostPerAcre: 225,
    laborHoursPerAcre: 1.7,
    equipment: "rowcrop",
    storage: "dry",
    market: "contract",
    marketChannels: 2,
    priceVolatility: 2,
    yieldVolatility: 2,
    perishability: 1,
    soilBuilding: 1,
    minEfficientAcres: 25,
    maxPracticalAcres: 100000,
    note: "Short season and drought tolerant. Malting contracts pay a solid premium over feed but reject loads that miss protein or germination specs.",
    storageNote: "Dry storage; malting barley must stay cool and undamaged.",
    marketNote: "Malting contracts are the upside. Without one, you are selling feed barley.",
  },
  {
    id: "sunflower",
    name: "Sunflower",
    group: "oilseed",
    seasonDays: 110,
    plantingWindow: "Late spring",
    waterInches: 16,
    droughtTolerance: 5,
    soilFit: { sand: 0.6, "sandy-loam": 0.85, loam: 1, "silt-loam": 0.95, "clay-loam": 0.9, clay: 0.7 },
    drainageNeed: "well",
    phPreference: null,
    yieldLow: 1350,
    yieldExpected: 1750,
    yieldHigh: 2200,
    yieldUnit: "lb",
    priceLow: 0.19,
    priceExpected: 0.23,
    priceHigh: 0.28,
    inputCostPerAcre: 255,
    laborHoursPerAcre: 2,
    equipment: "rowcrop",
    storage: "dry",
    market: "contract",
    marketChannels: 2,
    priceVolatility: 3,
    yieldVolatility: 3,
    perishability: 1,
    soilBuilding: 0,
    minEfficientAcres: 40,
    maxPracticalAcres: 100000,
    note: "Deep taproot pulls moisture other crops cannot reach, which makes it a strong dryland rotation crop. Birds and blackbird pressure are the real risk.",
    storageNote: "Dry storage, but oil content degrades if stored damp.",
    marketNote: "Usually contracted with a crusher before planting. Confirm delivery point and basis.",
  },
  {
    id: "canola",
    name: "Canola",
    group: "oilseed",
    seasonDays: 100,
    plantingWindow: "Early spring or fall by region",
    waterInches: 17,
    droughtTolerance: 3,
    soilFit: { sand: 0.45, "sandy-loam": 0.8, loam: 1, "silt-loam": 1, "clay-loam": 0.9, clay: 0.7 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 1600,
    yieldExpected: 2000,
    yieldHigh: 2450,
    yieldUnit: "lb",
    priceLow: 0.2,
    priceExpected: 0.24,
    priceHigh: 0.29,
    inputCostPerAcre: 275,
    laborHoursPerAcre: 2,
    equipment: "rowcrop",
    storage: "dry",
    market: "contract",
    marketChannels: 2,
    priceVolatility: 3,
    yieldVolatility: 3,
    perishability: 1,
    soilBuilding: 0,
    minEfficientAcres: 40,
    maxPracticalAcres: 100000,
    note: "Breaks cereal disease cycles and spreads harvest timing. Small seed needs a fine, firm seedbed and shallow placement.",
    storageNote: "Small seed flows and packs; monitor for heating in the bin.",
    marketNote: "Crush plants contract acres. Freight to the plant can decide profitability.",
  },
  {
    id: "cotton",
    name: "Cotton",
    group: "oilseed",
    seasonDays: 190,
    plantingWindow: "Late spring, warm soil",
    waterInches: 24,
    droughtTolerance: 3,
    soilFit: { sand: 0.6, "sandy-loam": 0.9, loam: 1, "silt-loam": 0.95, "clay-loam": 0.85, clay: 0.65 },
    drainageNeed: "well",
    phPreference: null,
    yieldLow: 780,
    yieldExpected: 1020,
    yieldHigh: 1320,
    yieldUnit: "lb lint",
    priceLow: 0.62,
    priceExpected: 0.73,
    priceHigh: 0.88,
    inputCostPerAcre: 640,
    laborHoursPerAcre: 3.5,
    equipment: "specialty",
    storage: "dry",
    market: "commodity",
    marketChannels: 2,
    priceVolatility: 4,
    yieldVolatility: 3,
    perishability: 1,
    soilBuilding: -1,
    minEfficientAcres: 80,
    maxPracticalAcres: 100000,
    note: "Needs a long, hot season and a cotton picker — the single most expensive harvest machine most farms will consider. Custom harvest is the usual entry path.",
    storageNote: "Modules store in the field briefly, then go to the gin.",
    marketNote: "Gin access is mandatory. Loan programs and quality discounts shape the real price.",
  },
  {
    id: "dry-beans",
    name: "Dry edible beans",
    group: "legume",
    seasonDays: 95,
    plantingWindow: "Late spring",
    waterInches: 17,
    droughtTolerance: 3,
    soilFit: { sand: 0.5, "sandy-loam": 0.85, loam: 1, "silt-loam": 0.95, "clay-loam": 0.8, clay: 0.55 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 1750,
    yieldExpected: 2200,
    yieldHigh: 2700,
    yieldUnit: "lb",
    priceLow: 0.28,
    priceExpected: 0.36,
    priceHigh: 0.48,
    inputCostPerAcre: 420,
    laborHoursPerAcre: 3,
    equipment: "rowcrop",
    storage: "dry",
    market: "contract",
    marketChannels: 2,
    priceVolatility: 4,
    yieldVolatility: 3,
    perishability: 1,
    soilBuilding: 2,
    minEfficientAcres: 30,
    maxPracticalAcres: 100000,
    note: "Short season, fixes nitrogen, and sells into food rather than feed markets. Sensitive to wet feet and to harvest-time rain staining the seed coat.",
    storageNote: "Dry storage. Buyers dock hard for splits, stain, and foreign material.",
    marketNote: "Class matters — pinto, black, and navy trade differently. Contract before planting.",
  },
  {
    id: "peanuts",
    name: "Peanuts",
    group: "legume",
    seasonDays: 145,
    plantingWindow: "Late spring, warm soil",
    waterInches: 22,
    droughtTolerance: 3,
    soilFit: { sand: 0.9, "sandy-loam": 1, loam: 0.8, "silt-loam": 0.6, "clay-loam": 0.35, clay: 0.15 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 3800,
    yieldExpected: 4600,
    yieldHigh: 5400,
    yieldUnit: "lb",
    priceLow: 0.22,
    priceExpected: 0.26,
    priceHigh: 0.3,
    inputCostPerAcre: 680,
    laborHoursPerAcre: 5,
    equipment: "specialty",
    storage: "dry",
    market: "contract",
    marketChannels: 1,
    priceVolatility: 2,
    yieldVolatility: 3,
    perishability: 2,
    soilBuilding: 2,
    minEfficientAcres: 50,
    maxPracticalAcres: 100000,
    note: "One of the few crops that genuinely prefers sand. Needs a digger and a combine built for peanuts, plus a buying point within reasonable trucking distance.",
    storageNote: "Must be dried carefully to avoid aflatoxin. Most growers deliver straight to the buying point.",
    marketNote: "Effectively a contract crop tied to a single shelling company.",
  },
  {
    id: "alfalfa",
    name: "Alfalfa hay",
    group: "forage",
    seasonDays: 150,
    establishYears: 1,
    establishCostPerAcre: 380,
    standYears: 4,
    plantingWindow: "Spring or late summer seeding",
    waterInches: 34,
    droughtTolerance: 3,
    soilFit: { sand: 0.4, "sandy-loam": 0.75, loam: 1, "silt-loam": 0.95, "clay-loam": 0.8, clay: 0.5 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 4,
    yieldExpected: 5.5,
    yieldHigh: 7,
    yieldUnit: "ton",
    priceLow: 170,
    priceExpected: 220,
    priceHigh: 285,
    inputCostPerAcre: 380,
    laborHoursPerAcre: 6.5,
    equipment: "basic",
    storage: "dry",
    market: "local",
    marketChannels: 3,
    priceVolatility: 3,
    yieldVolatility: 2,
    perishability: 2,
    soilBuilding: 3,
    minEfficientAcres: 15,
    maxPracticalAcres: 3000,
    note: "A perennial that fixes nitrogen and rebuilds soil structure over a four-year stand. Multiple cuttings mean weather risk repeats several times a season.",
    storageNote: "Needs dry covered storage. Rained-on hay loses grade and price fast.",
    marketNote: "Dairies pay for tested high-quality hay; horse owners pay well for clean small bales.",
  },
  {
    id: "grass-hay",
    name: "Grass hay",
    group: "forage",
    seasonDays: 130,
    establishYears: 1,
    establishCostPerAcre: 190,
    standYears: 8,
    plantingWindow: "Spring or late summer seeding",
    waterInches: 22,
    droughtTolerance: 4,
    soilFit: { sand: 0.6, "sandy-loam": 0.85, loam: 1, "silt-loam": 1, "clay-loam": 0.95, clay: 0.8 },
    drainageNeed: "poor",
    phPreference: null,
    yieldLow: 2,
    yieldExpected: 3,
    yieldHigh: 4.2,
    yieldUnit: "ton",
    priceLow: 115,
    priceExpected: 150,
    priceHigh: 195,
    inputCostPerAcre: 185,
    laborHoursPerAcre: 4.5,
    equipment: "basic",
    storage: "dry",
    market: "local",
    marketChannels: 3,
    priceVolatility: 2,
    yieldVolatility: 2,
    perishability: 2,
    soilBuilding: 2,
    minEfficientAcres: 10,
    maxPracticalAcres: 3000,
    note: "The most forgiving crop on this list. Tolerates wet ground and marginal soil, needs only haying equipment, and holds the field for years with modest inputs.",
    storageNote: "Covered dry storage. Round bales tolerate outdoor storage with losses.",
    marketNote: "Local livestock owners buy year-round. Small square bales sell at a premium.",
  },
  {
    id: "potatoes",
    name: "Potatoes",
    group: "vegetable",
    seasonDays: 110,
    plantingWindow: "Early to mid spring",
    waterInches: 24,
    droughtTolerance: 2,
    soilFit: { sand: 0.7, "sandy-loam": 1, loam: 0.9, "silt-loam": 0.85, "clay-loam": 0.5, clay: 0.25 },
    drainageNeed: "well",
    phPreference: "acidic",
    yieldLow: 340,
    yieldExpected: 425,
    yieldHigh: 510,
    yieldUnit: "cwt",
    priceLow: 8.5,
    priceExpected: 11,
    priceHigh: 14.5,
    inputCostPerAcre: 3100,
    laborHoursPerAcre: 45,
    equipment: "specialty",
    storage: "cooled",
    market: "contract",
    marketChannels: 2,
    priceVolatility: 4,
    yieldVolatility: 3,
    perishability: 3,
    soilBuilding: -1,
    minEfficientAcres: 20,
    maxPracticalAcres: 5000,
    note: "High revenue per acre and high cost per acre. Needs a planter, a windrower or harvester, and climate-controlled storage — the capital hurdle is the real barrier.",
    storageNote: "Requires cooled, humidity-controlled storage. Without it you sell into the harvest glut.",
    marketNote: "Processing contracts stabilize price. Fresh-pack markets swing hard year to year.",
  },
  {
    id: "sweet-corn",
    name: "Sweet corn (fresh market)",
    group: "vegetable",
    seasonDays: 80,
    plantingWindow: "Succession plantings all spring",
    waterInches: 20,
    droughtTolerance: 2,
    soilFit: { sand: 0.5, "sandy-loam": 0.85, loam: 1, "silt-loam": 1, "clay-loam": 0.8, clay: 0.55 },
    drainageNeed: "moderate",
    phPreference: "neutral",
    yieldLow: 850,
    yieldExpected: 1100,
    yieldHigh: 1350,
    yieldUnit: "dozen",
    priceLow: 3.25,
    priceExpected: 4.5,
    priceHigh: 6,
    inputCostPerAcre: 2100,
    laborHoursPerAcre: 95,
    equipment: "basic",
    storage: "cooled",
    market: "local",
    marketChannels: 3,
    priceVolatility: 3,
    yieldVolatility: 2,
    perishability: 5,
    soilBuilding: -1,
    minEfficientAcres: 2,
    maxPracticalAcres: 150,
    note: "Strong direct-market draw and workable with basic equipment, which makes it a common first cash crop on small acreage. Quality collapses within days of picking.",
    storageNote: "Needs immediate cooling. Sugar converts to starch within hours at field heat.",
    marketNote: "Farm stands, farmers markets, and small grocers. Sells itself in season.",
  },
  {
    id: "pumpkins",
    name: "Pumpkins",
    group: "vegetable",
    seasonDays: 105,
    plantingWindow: "Late spring for fall harvest",
    waterInches: 18,
    droughtTolerance: 3,
    soilFit: { sand: 0.55, "sandy-loam": 0.9, loam: 1, "silt-loam": 0.95, "clay-loam": 0.75, clay: 0.5 },
    drainageNeed: "well",
    phPreference: null,
    yieldLow: 14000,
    yieldExpected: 19000,
    yieldHigh: 25000,
    yieldUnit: "lb",
    priceLow: 0.16,
    priceExpected: 0.23,
    priceHigh: 0.32,
    inputCostPerAcre: 1800,
    laborHoursPerAcre: 70,
    equipment: "basic",
    storage: "dry",
    market: "local",
    marketChannels: 3,
    priceVolatility: 3,
    yieldVolatility: 3,
    perishability: 2,
    soilBuilding: -1,
    minEfficientAcres: 2,
    maxPracticalAcres: 200,
    note: "An agritourism anchor as much as a crop — pick-your-own pricing far exceeds wholesale. Compressed selling window means the whole year rides on six autumn weekends.",
    storageNote: "Cures and holds several weeks in dry ambient storage.",
    marketNote: "Pick-your-own and roadside stands pay best. Wholesale bins pay a fraction.",
  },
  {
    id: "winter-squash",
    name: "Winter squash",
    group: "vegetable",
    seasonDays: 100,
    plantingWindow: "Late spring",
    waterInches: 18,
    droughtTolerance: 3,
    soilFit: { sand: 0.55, "sandy-loam": 0.9, loam: 1, "silt-loam": 0.95, "clay-loam": 0.75, clay: 0.5 },
    drainageNeed: "well",
    phPreference: null,
    yieldLow: 17000,
    yieldExpected: 22000,
    yieldHigh: 28000,
    yieldUnit: "lb",
    priceLow: 0.22,
    priceExpected: 0.31,
    priceHigh: 0.42,
    inputCostPerAcre: 2200,
    laborHoursPerAcre: 85,
    equipment: "basic",
    storage: "dry",
    market: "local",
    marketChannels: 3,
    priceVolatility: 2,
    yieldVolatility: 2,
    perishability: 2,
    soilBuilding: -1,
    minEfficientAcres: 2,
    maxPracticalAcres: 200,
    note: "One of the few vegetables that stores for months without refrigeration, which lets you sell into winter when competition thins out.",
    storageNote: "Cured squash holds 2–4 months in a cool dry room. No refrigeration needed.",
    marketNote: "Winter CSA boxes, co-ops, and restaurants. Storage lets you price patiently.",
  },
  {
    id: "sweet-potatoes",
    name: "Sweet potatoes",
    group: "vegetable",
    seasonDays: 120,
    plantingWindow: "Late spring, warm soil",
    waterInches: 20,
    droughtTolerance: 4,
    soilFit: { sand: 0.8, "sandy-loam": 1, loam: 0.85, "silt-loam": 0.7, "clay-loam": 0.4, clay: 0.2 },
    drainageNeed: "well",
    phPreference: "acidic",
    yieldLow: 17000,
    yieldExpected: 23000,
    yieldHigh: 29000,
    yieldUnit: "lb",
    priceLow: 0.32,
    priceExpected: 0.45,
    priceHigh: 0.62,
    inputCostPerAcre: 3600,
    laborHoursPerAcre: 130,
    equipment: "specialty",
    storage: "cooled",
    market: "contract",
    marketChannels: 2,
    priceVolatility: 3,
    yieldVolatility: 2,
    perishability: 3,
    soilBuilding: -1,
    minEfficientAcres: 5,
    maxPracticalAcres: 1000,
    note: "Thrives on sandy ground and tolerates heat and dry spells better than most vegetables. Transplanting slips and hand-grading the harvest drive the labor number.",
    storageNote: "Must be cured warm and humid for a week, then held cool. Curing sets the shelf life.",
    marketNote: "Packers contract volume; local and ethnic markets pay well for smaller lots.",
  },
  {
    id: "green-beans",
    name: "Green beans (fresh)",
    group: "legume",
    seasonDays: 60,
    plantingWindow: "Succession plantings, late spring on",
    waterInches: 14,
    droughtTolerance: 2,
    soilFit: { sand: 0.5, "sandy-loam": 0.85, loam: 1, "silt-loam": 0.95, "clay-loam": 0.75, clay: 0.5 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 6000,
    yieldExpected: 8200,
    yieldHigh: 10500,
    yieldUnit: "lb",
    priceLow: 0.85,
    priceExpected: 1.15,
    priceHigh: 1.6,
    inputCostPerAcre: 3100,
    laborHoursPerAcre: 210,
    equipment: "hand",
    storage: "cooled",
    market: "local",
    marketChannels: 2,
    priceVolatility: 3,
    yieldVolatility: 2,
    perishability: 4,
    soilBuilding: 2,
    minEfficientAcres: 1,
    maxPracticalAcres: 40,
    note: "The fastest crop here at 60 days, fixes some nitrogen, and needs no specialized machinery. Hand harvest is the entire economics — every pound is picked by someone.",
    storageNote: "Cool immediately; quality drops within two or three days.",
    marketNote: "Farmers markets and restaurants. Machine-harvested processing beans are a different business.",
  },
  {
    id: "lettuce",
    name: "Lettuce and salad greens",
    group: "vegetable",
    seasonDays: 65,
    plantingWindow: "Spring and fall successions",
    waterInches: 14,
    droughtTolerance: 1,
    soilFit: { sand: 0.5, "sandy-loam": 0.9, loam: 1, "silt-loam": 1, "clay-loam": 0.7, clay: 0.45 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 26000,
    yieldExpected: 33000,
    yieldHigh: 41000,
    yieldUnit: "lb",
    priceLow: 0.42,
    priceExpected: 0.58,
    priceHigh: 0.85,
    inputCostPerAcre: 6200,
    laborHoursPerAcre: 240,
    equipment: "basic",
    storage: "cooled",
    market: "local",
    marketChannels: 2,
    priceVolatility: 4,
    yieldVolatility: 3,
    perishability: 5,
    soilBuilding: -1,
    minEfficientAcres: 1,
    maxPracticalAcres: 60,
    note: "Two or three crops per season from the same ground and fast cash turnover. Also the least forgiving crop here — it bolts in heat and wilts without steady moisture.",
    storageNote: "Requires cold chain from the field. No cooler means no lettuce business.",
    marketNote: "Restaurants and markets pay for freshness. Competing with bagged salad wholesale is futile.",
  },
  {
    id: "tomatoes",
    name: "Tomatoes (fresh market)",
    group: "vegetable",
    seasonDays: 115,
    plantingWindow: "Transplant after last frost",
    waterInches: 22,
    droughtTolerance: 2,
    soilFit: { sand: 0.5, "sandy-loam": 0.9, loam: 1, "silt-loam": 0.95, "clay-loam": 0.75, clay: 0.5 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 28000,
    yieldExpected: 30000,
    yieldHigh: 55000,
    yieldUnit: "lb",
    priceLow: 0.75,
    priceExpected: 1.05,
    priceHigh: 1.5,
    inputCostPerAcre: 9800,
    laborHoursPerAcre: 450,
    equipment: "hand",
    storage: "cooled",
    market: "local",
    marketChannels: 2,
    priceVolatility: 4,
    yieldVolatility: 3,
    perishability: 5,
    soilBuilding: -1,
    minEfficientAcres: 1,
    maxPracticalAcres: 30,
    note: "The highest gross revenue per acre on this list by a wide margin — and roughly 195 hours of hand work per acre to collect it. Staking, pruning, and repeat picking are unavoidable.",
    storageNote: "Cool but never cold; below 50°F ruins flavor and texture.",
    marketNote: "Direct market and restaurants. Disease pressure and late blight can end a season early.",
  },
  {
    id: "garlic",
    name: "Garlic",
    group: "vegetable",
    seasonDays: 120,
    fallPlanted: true,
    plantingWindow: "Fall, 4–6 weeks before ground freezes",
    waterInches: 16,
    droughtTolerance: 3,
    soilFit: { sand: 0.5, "sandy-loam": 0.9, loam: 1, "silt-loam": 0.95, "clay-loam": 0.7, clay: 0.4 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 6500,
    yieldExpected: 9000,
    yieldHigh: 12500,
    yieldUnit: "lb",
    // $3+/lb is achievable but assumes you retail every bulb yourself. The
    // expected case blends wholesale and direct sales, which is what most
    // growers actually clear once volume exceeds a farmers-market table.
    priceLow: 1.9,
    priceExpected: 2.8,
    priceHigh: 5,
    inputCostPerAcre: 9200,
    laborHoursPerAcre: 320,
    equipment: "hand",
    storage: "dry",
    market: "local",
    marketChannels: 3,
    priceVolatility: 2,
    yieldVolatility: 2,
    perishability: 1,
    soilBuilding: -1,
    minEfficientAcres: 1,
    maxPracticalAcres: 40,
    note: "Excellent small-acreage economics: high price, stores for months, and no refrigeration needed. Seed garlic is the big cost since you plant back roughly a pound to grow ten.",
    storageNote: "Cures and holds 6–9 months in a dry, airy room. Best storage life of any vegetable here.",
    marketNote: "Seed garlic sells for several times culinary price. Markets, co-ops, and mail order.",
  },
  {
    id: "blueberries",
    name: "Blueberries",
    group: "perennial",
    seasonDays: 150,
    establishYears: 4,
    establishCostPerAcre: 15000,
    standYears: 20,
    plantingWindow: "Spring planting, first real crop in year 4",
    waterInches: 26,
    droughtTolerance: 2,
    soilFit: { sand: 0.8, "sandy-loam": 1, loam: 0.85, "silt-loam": 0.7, "clay-loam": 0.4, clay: 0.2 },
    drainageNeed: "well",
    phPreference: "acidic",
    yieldLow: 5500,
    yieldExpected: 8000,
    yieldHigh: 11000,
    yieldUnit: "lb",
    priceLow: 1.9,
    priceExpected: 2.9,
    priceHigh: 4.5,
    inputCostPerAcre: 7200,
    laborHoursPerAcre: 420,
    equipment: "hand",
    storage: "cooled",
    market: "local",
    marketChannels: 3,
    priceVolatility: 3,
    yieldVolatility: 2,
    perishability: 4,
    soilBuilding: 1,
    minEfficientAcres: 1,
    maxPracticalAcres: 200,
    note: "Requires genuinely acidic soil near pH 4.5–5.5 — the one crop here you truly cannot grow without the right soil chemistry. Four years of cost before the first real check.",
    storageNote: "Cool immediately. Fresh berries hold about two weeks; freezing extends the season.",
    marketNote: "Pick-your-own eliminates harvest labor and pays retail. Strong and growing demand.",
  },
  {
    id: "apples",
    name: "Apples (high-density)",
    group: "perennial",
    seasonDays: 165,
    establishYears: 5,
    establishCostPerAcre: 21000,
    standYears: 25,
    plantingWindow: "Spring planting, first real crop in year 5",
    waterInches: 24,
    droughtTolerance: 3,
    soilFit: { sand: 0.5, "sandy-loam": 0.9, loam: 1, "silt-loam": 0.95, "clay-loam": 0.75, clay: 0.45 },
    drainageNeed: "well",
    phPreference: "neutral",
    yieldLow: 700,
    yieldExpected: 1050,
    yieldHigh: 1400,
    yieldUnit: "bu",
    priceLow: 11,
    priceExpected: 17,
    priceHigh: 26,
    inputCostPerAcre: 6800,
    laborHoursPerAcre: 330,
    equipment: "specialty",
    storage: "cooled",
    market: "local",
    marketChannels: 3,
    priceVolatility: 2,
    yieldVolatility: 3,
    perishability: 3,
    soilBuilding: 1,
    minEfficientAcres: 2,
    maxPracticalAcres: 500,
    note: "A 25-year asset with high establishment cost and five years to real production. Trellis, irrigation, and a spray program are all mandatory, not optional.",
    storageNote: "Controlled-atmosphere storage sells apples in spring at a large premium.",
    marketNote: "Farm retail, cider, and wholesale. Variety choice locks in your market for decades.",
  },
  {
    id: "lavender",
    name: "Lavender",
    group: "perennial",
    seasonDays: 140,
    establishYears: 3,
    establishCostPerAcre: 8500,
    standYears: 12,
    plantingWindow: "Spring planting, full harvest by year 3",
    waterInches: 10,
    droughtTolerance: 5,
    soilFit: { sand: 0.85, "sandy-loam": 1, loam: 0.8, "silt-loam": 0.6, "clay-loam": 0.35, clay: 0.15 },
    drainageNeed: "well",
    phPreference: "alkaline",
    yieldLow: 1200,
    yieldExpected: 1900,
    yieldHigh: 2800,
    yieldUnit: "bundle",
    priceLow: 4,
    priceExpected: 6.5,
    priceHigh: 10,
    inputCostPerAcre: 3200,
    laborHoursPerAcre: 200,
    equipment: "hand",
    storage: "dry",
    market: "local",
    marketChannels: 3,
    priceVolatility: 2,
    yieldVolatility: 2,
    perishability: 1,
    soilBuilding: 1,
    minEfficientAcres: 1,
    maxPracticalAcres: 25,
    note: "The lowest water requirement here and it actively dislikes rich wet soil, which makes it viable on dry alkaline ground where little else pays. Wet clay kills it outright.",
    storageNote: "Dried bundles and oil store almost indefinitely — no cold chain, no spoilage clock.",
    marketNote: "Value-added products and agritourism carry the margin, not raw bundles.",
  },
  {
    id: "cover-crop",
    name: "Cover crop rotation (no cash sale)",
    group: "cover",
    seasonDays: 70,
    plantingWindow: "After cash crop harvest, or a full rest year",
    waterInches: 10,
    droughtTolerance: 4,
    soilFit: { sand: 0.9, "sandy-loam": 1, loam: 1, "silt-loam": 1, "clay-loam": 0.95, clay: 0.85 },
    drainageNeed: "poor",
    phPreference: null,
    yieldLow: 0,
    yieldExpected: 0,
    yieldHigh: 0,
    yieldUnit: "n/a",
    priceLow: 0,
    priceExpected: 0,
    priceHigh: 0,
    inputCostPerAcre: 70,
    laborHoursPerAcre: 1,
    equipment: "basic",
    storage: "none",
    market: "commodity",
    marketChannels: 1,
    priceVolatility: 1,
    yieldVolatility: 1,
    perishability: 1,
    soilBuilding: 3,
    minEfficientAcres: 1,
    maxPracticalAcres: 100000,
    note: "Produces no income by design — it is an investment in the next crop. A rye and clover mix adds nitrogen and organic matter, suppresses weeds, and stops erosion on problem ground.",
    storageNote: "Nothing to store.",
    marketNote: "No sale. Grazing or federal and state conservation payments can offset the seed cost.",
  },
]

export const CROP_BY_ID: Record<string, CropProfile> = CROPS.reduce(
  (acc, c) => {
    acc[c.id] = c
    return acc
  },
  {} as Record<string, CropProfile>,
)

/* ------------------------------------------------------------------ *
 * Inputs and results
 * ------------------------------------------------------------------ */

export type FarmInputs = {
  zip: string
  acres: number
  soil: SoilId
  drainage: Drainage
  ph: SoilPh
  irrigation: Irrigation
  /** Frost-free days, defaulted from ZIP and overridable. */
  seasonDays: number
  /** Annual precipitation in inches, defaulted from ZIP and overridable. */
  annualRainIn: number
  equipment: EquipmentTier
  labor: LaborLevel
  capital: CapitalLevel
  storage: StorageLevel
  market: MarketAccess
  priorities: PriorityId[]
}

export type FactorId =
  | "season"
  | "soil"
  | "water"
  | "equipment"
  | "labor"
  | "capital"
  | "storage"
  | "market"
  | "scale"

export const FACTOR_LABELS: Record<FactorId, string> = {
  season: "Growing season",
  soil: "Soil and drainage",
  water: "Water supply",
  equipment: "Equipment",
  labor: "Labor",
  capital: "Capital",
  storage: "Storage",
  market: "Market access",
  scale: "Scale fit",
}

export type FactorScore = {
  id: FactorId
  score: number
  note: string
}

export type CropEconomics = {
  yieldPerAcre: number
  pricePerUnit: number
  revenuePerAcre: number
  inputCostPerAcre: number
  laborCostPerAcre: number
  establishAmortizedPerAcre: number
  customHirePerAcre: number
  totalCostPerAcre: number
  profitPerAcre: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  breakEvenYield: number
  breakEvenPrice: number
  /** Profit per acre at the pessimistic and optimistic ends. */
  profitLow: number
  profitHigh: number
}

export type CropEvaluation = {
  crop: CropProfile
  viable: boolean
  blockers: string[]
  cautions: string[]
  factors: FactorScore[]
  suitability: number
  riskScore: number
  fitScore: number
  economics: CropEconomics
  reasons: string[]
}

export type RankingId = "overall" | "profit" | "risk" | "water" | "lowcost"

export const RANKING_META: Record<RankingId, { label: string; detail: string }> = {
  overall: {
    label: "Best overall fit",
    detail: "Highest combined score across your constraints and stated priorities.",
  },
  profit: {
    label: "Highest potential profit",
    detail: "Largest projected margin per acre among viable crops.",
  },
  risk: {
    label: "Lowest risk",
    detail: "Most stable prices and yields, least perishable, least capital exposed.",
  },
  water: {
    label: "Lowest water use",
    detail: "Finishes a crop on the least seasonal moisture.",
  },
  lowcost: {
    label: "Best low-cost option",
    detail: "Lowest cash outlay per acre while still returning a profit.",
  },
}

export type Ranking = {
  id: RankingId
  crop: CropProfile
  evaluation: CropEvaluation
  headline: string
}

export type SelectionResult = {
  climate: ResolvedClimate
  evaluations: CropEvaluation[]
  viable: CropEvaluation[]
  rejected: CropEvaluation[]
  rankings: Ranking[]
  assumptions: string[]
}

/* ------------------------------------------------------------------ *
 * Scoring helpers
 * ------------------------------------------------------------------ */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/** Linear score that falls off once `value` drops below `need`. */
function ratioScore(value: number, need: number): number {
  if (need <= 0) return 100
  const r = value / need
  if (r >= 1.15) return 100
  if (r >= 1) return 95
  return clamp(r * 90)
}

function drainageRank(d: Drainage): number {
  return d === "poor" ? 0 : d === "moderate" ? 1 : 2
}

/* ------------------------------------------------------------------ *
 * Per-crop evaluation
 * ------------------------------------------------------------------ */

function evaluateCrop(crop: CropProfile, inputs: FarmInputs): CropEvaluation {
  const blockers: string[] = []
  const cautions: string[] = []
  const factors: FactorScore[] = []

  /* --- Season ------------------------------------------------------ */
  // Fall-planted crops overwinter, so the spring-to-frost window is less
  // binding; they need enough season to establish before freeze-up.
  const seasonNeed = crop.fallPlanted ? Math.round(crop.seasonDays * 0.6) : crop.seasonDays
  const seasonScore = ratioScore(inputs.seasonDays, seasonNeed)
  if (inputs.seasonDays < seasonNeed * 0.85) {
    blockers.push(
      `Needs about ${crop.seasonDays} frost-free days; your season is roughly ${inputs.seasonDays}.`,
    )
  } else if (inputs.seasonDays < seasonNeed) {
    cautions.push("Your season is marginal for this crop — an early frost could cost the harvest.")
  }
  factors.push({
    id: "season",
    score: seasonScore,
    note: crop.fallPlanted
      ? `Fall planted; overwinters and finishes early. ${crop.plantingWindow}.`
      : `Needs ~${crop.seasonDays} days; you have ~${inputs.seasonDays}.`,
  })

  /* --- Soil and drainage ------------------------------------------- */
  const textureFit = crop.soilFit[inputs.soil]
  let soilScore = textureFit * 100
  if (textureFit < 0.35) {
    blockers.push(`${SOIL_LABELS[inputs.soil]} is a poor match for this crop.`)
  } else if (textureFit < 0.6) {
    cautions.push(`${SOIL_LABELS[inputs.soil]} is workable but not ideal — expect yields at the low end.`)
  }

  if (drainageRank(inputs.drainage) < drainageRank(crop.drainageNeed)) {
    soilScore *= 0.55
    if (crop.drainageNeed === "well" && inputs.drainage === "poor") {
      blockers.push("Needs well-drained ground; poorly drained soil will cause root loss or disease.")
    } else {
      cautions.push("Drainage is below what this crop prefers. Tile or raised beds would help.")
    }
  }

  if (crop.phPreference && inputs.ph !== "unknown" && crop.phPreference !== inputs.ph) {
    soilScore *= 0.7
    if (crop.id === "blueberries") {
      blockers.push("Blueberries require acidic soil near pH 4.5–5.5. Amending a whole field is rarely practical.")
    } else {
      cautions.push(
        `Prefers ${PH_LABELS[crop.phPreference].toLowerCase()} soil; yours tested ${PH_LABELS[inputs.ph].toLowerCase()}.`,
      )
    }
  }
  factors.push({
    id: "soil",
    score: clamp(soilScore),
    note: `${SOIL_LABELS[inputs.soil]}, ${DRAINAGE_LABELS[inputs.drainage].toLowerCase()}.`,
  })

  /* --- Water ------------------------------------------------------- */
  const seasonRain = inputs.annualRainIn * GROWING_SEASON_RAIN_SHARE
  const soilReserve = SOIL_WATER_RESERVE[inputs.soil]
  const irrigationBoost = inputs.irrigation === "full" ? 99 : inputs.irrigation === "limited" ? 6 : 0
  const availableWater = seasonRain + soilReserve + irrigationBoost
  let waterScore = ratioScore(availableWater, crop.waterInches)
  // Drought tolerance partially offsets a shortfall.
  if (availableWater < crop.waterInches) {
    waterScore = clamp(waterScore + (crop.droughtTolerance - 3) * 8)
  }
  if (availableWater < crop.waterInches * 0.7 && inputs.irrigation === "none") {
    blockers.push(
      `Needs about ${crop.waterInches}" of water; rain-fed supply here is roughly ${seasonRain.toFixed(0)}".`,
    )
  } else if (availableWater < crop.waterInches * 0.95 && inputs.irrigation !== "full") {
    cautions.push("Moisture is tight in an average year. A dry summer would cut yields sharply.")
  }
  factors.push({
    id: "water",
    score: waterScore,
    note:
      inputs.irrigation === "full"
        ? `Irrigated. Crop needs ~${crop.waterInches}" per season.`
        : `~${seasonRain.toFixed(0)}" in-season rain vs ~${crop.waterInches}" needed.`,
  })

  /* --- Equipment --------------------------------------------------- */
  const have = EQUIPMENT_RANK[inputs.equipment]
  const need = EQUIPMENT_RANK[crop.equipment]
  let equipmentScore = 100
  let customHirePerAcre = 0
  if (have < need) {
    const gap = need - have
    equipmentScore = clamp(100 - gap * 34)
    if (crop.equipment === "specialty") {
      // Specialty harvest gear is rarely rentable; custom operators exist but
      // are regional and this is a genuine barrier rather than a line item.
      customHirePerAcre = 165
      cautions.push(
        `Requires ${EQUIPMENT_LABELS[crop.equipment].toLowerCase()}. Custom harvest is budgeted at $165/ac, but confirm an operator serves your area before committing acres.`,
      )
    } else {
      customHirePerAcre = 95
      cautions.push(
        `You would need ${EQUIPMENT_LABELS[crop.equipment].toLowerCase()}. Custom hire is budgeted at $95/ac.`,
      )
    }
    if (gap >= 2) {
      blockers.push(
        `Equipment gap is large: this crop needs ${EQUIPMENT_LABELS[crop.equipment].toLowerCase()}.`,
      )
    }
  }
  factors.push({
    id: "equipment",
    score: equipmentScore,
    note: `Needs ${EQUIPMENT_LABELS[crop.equipment].toLowerCase()}; you have ${EQUIPMENT_LABELS[inputs.equipment].toLowerCase()}.`,
  })

  /* --- Labor ------------------------------------------------------- */
  const hoursNeeded = crop.laborHoursPerAcre * inputs.acres
  const hoursAvailable = LABOR_HOURS_AVAILABLE[inputs.labor]
  const laborScore = hoursNeeded <= hoursAvailable ? 100 : clamp((hoursAvailable / hoursNeeded) * 100)
  if (hoursNeeded > hoursAvailable * 1.35) {
    blockers.push(
      `Needs about ${Math.round(hoursNeeded).toLocaleString()} field hours; ${LABOR_LABELS[inputs.labor].toLowerCase()} realistically covers ~${hoursAvailable.toLocaleString()}.`,
    )
  } else if (hoursNeeded > hoursAvailable) {
    cautions.push("Labor is the binding constraint. Either hire help or plant fewer acres of it.")
  }
  factors.push({
    id: "labor",
    score: laborScore,
    note: `${crop.laborHoursPerAcre} h/ac × ${inputs.acres} ac = ${Math.round(hoursNeeded).toLocaleString()} h.`,
  })

  /* --- Capital ----------------------------------------------------- */
  const establishAmortized =
    crop.establishCostPerAcre && crop.standYears
      ? Math.round(crop.establishCostPerAcre / crop.standYears)
      : 0
  const cashPerAcre = crop.inputCostPerAcre + customHirePerAcre
  // Establishment is a real first-year outlay for perennials, not just an
  // amortized bookkeeping entry, so it counts against this season's capital.
  const cashNeeded = (cashPerAcre + (crop.establishCostPerAcre ?? 0)) * inputs.acres
  const capitalAvailable = CAPITAL_TOTAL[inputs.capital]
  const capitalScore = ratioScore(capitalAvailable, cashNeeded)
  if (cashNeeded > capitalAvailable * 1.25) {
    blockers.push(
      `Needs about $${Math.round(cashNeeded).toLocaleString()} of operating cash across ${inputs.acres} ac; a ${CAPITAL_LABELS[inputs.capital].toLowerCase()} position covers roughly $${capitalAvailable.toLocaleString()}.`,
    )
  } else if (cashNeeded > capitalAvailable) {
    cautions.push("Input cost is at the top of your capital range. Operating credit would be needed.")
  }
  if (crop.establishYears && crop.establishYears > 1) {
    cautions.push(
      `Perennial: about $${crop.establishCostPerAcre?.toLocaleString()}/ac to establish and roughly ${crop.establishYears} years before a full harvest.`,
    )
  }
  factors.push({
    id: "capital",
    score: capitalScore,
    note: `$${cashPerAcre.toLocaleString()}/ac × ${inputs.acres} ac = $${Math.round(cashNeeded).toLocaleString()} vs ~$${capitalAvailable.toLocaleString()} available.`,
  })

  /* --- Storage ----------------------------------------------------- */
  const storageRank: Record<StorageLevel, number> = { none: 0, dry: 1, cooled: 2 }
  let storageScore = 100
  let priceRealized = crop.priceExpected
  if (storageRank[inputs.storage] < storageRank[crop.storage]) {
    storageScore = crop.storage === "cooled" ? 40 : 65
    // Without storage you sell into the harvest window at the low price.
    priceRealized = crop.priceLow
    if (crop.storage === "cooled" && crop.perishability >= 4) {
      blockers.push("This crop needs cooling at harvest and cannot be held without it.")
    } else {
      cautions.push(
        `No ${crop.storage} storage means selling at harvest — priced here at the low end of the range.`,
      )
    }
  }
  factors.push({
    id: "storage",
    score: storageScore,
    note: crop.storageNote,
  })

  /* --- Market ------------------------------------------------------ */
  let marketScore = 100
  if (crop.market !== inputs.market) {
    if (crop.market === "local" && inputs.market === "commodity") {
      marketScore = 30
      blockers.push(
        "This is a direct-market crop and you listed elevator access only. There is no commodity bid for it.",
      )
    } else if (crop.market === "commodity" && inputs.market === "local") {
      marketScore = 55
      cautions.push("Commodity crops need an elevator or processor bid, not a farmers market.")
    } else {
      marketScore = 70
      cautions.push(`Typically sold via ${MARKET_LABELS[crop.market].toLowerCase()}.`)
    }
  }
  marketScore = clamp(marketScore + (crop.marketChannels - 2) * 8)
  factors.push({ id: "market", score: marketScore, note: crop.marketNote })

  /* --- Scale ------------------------------------------------------- */
  let scaleScore = 100
  if (inputs.acres < crop.minEfficientAcres) {
    scaleScore = clamp((inputs.acres / crop.minEfficientAcres) * 100)
    // Well under half the workable minimum is a genuine mismatch, not a
    // caution: the equipment and market simply do not scale down that far.
    if (inputs.acres < crop.minEfficientAcres * 0.45) {
      blockers.push(
        `Needs roughly ${crop.minEfficientAcres} acres to be workable; ${inputs.acres} ac is too small for the equipment and market this crop depends on.`,
      )
    } else {
      cautions.push(
        `Machinery and overhead are hard to justify below about ${crop.minEfficientAcres} acres of this crop.`,
      )
    }
  } else if (inputs.acres > crop.maxPracticalAcres) {
    scaleScore = clamp((crop.maxPracticalAcres / inputs.acres) * 100)
    cautions.push(
      `Above roughly ${crop.maxPracticalAcres.toLocaleString()} acres the labor or the market for this crop usually breaks down.`,
    )
  }
  factors.push({
    id: "scale",
    score: scaleScore,
    note: `Works best from ${crop.minEfficientAcres} to ${crop.maxPracticalAcres.toLocaleString()} acres.`,
  })

  /* --- Suitability ------------------------------------------------- */
  const weights: Record<FactorId, number> = {
    season: 1.4,
    soil: 1.4,
    water: 1.3,
    equipment: 1,
    labor: 1.1,
    capital: 1,
    storage: 0.8,
    market: 1.2,
    scale: 0.7,
  }
  const weightSum = factors.reduce((s, f) => s + weights[f.id], 0)
  const suitability = Math.round(
    factors.reduce((s, f) => s + f.score * weights[f.id], 0) / weightSum,
  )

  /* --- Economics --------------------------------------------------- */
  // Yield is scaled by how well the farm actually suits the crop, so a
  // marginal match does not quietly assume a best-case harvest.
  const suitabilityYieldFactor = 0.75 + (suitability / 100) * 0.25
  const yieldPerAcre = crop.yieldExpected * suitabilityYieldFactor
  const laborCostPerAcre = Math.round(crop.laborHoursPerAcre * LABOR_RATE)
  const revenuePerAcre = yieldPerAcre * priceRealized
  const totalCostPerAcre =
    crop.inputCostPerAcre + laborCostPerAcre + establishAmortized + customHirePerAcre
  const profitPerAcre = revenuePerAcre - totalCostPerAcre

  const profitLow = crop.yieldLow * suitabilityYieldFactor * crop.priceLow - totalCostPerAcre
  const profitHigh = crop.yieldHigh * suitabilityYieldFactor * crop.priceHigh - totalCostPerAcre

  const economics: CropEconomics = {
    yieldPerAcre,
    pricePerUnit: priceRealized,
    revenuePerAcre,
    inputCostPerAcre: crop.inputCostPerAcre,
    laborCostPerAcre,
    establishAmortizedPerAcre: establishAmortized,
    customHirePerAcre,
    totalCostPerAcre,
    profitPerAcre,
    totalRevenue: revenuePerAcre * inputs.acres,
    totalCost: totalCostPerAcre * inputs.acres,
    totalProfit: profitPerAcre * inputs.acres,
    breakEvenYield: priceRealized > 0 ? totalCostPerAcre / priceRealized : 0,
    breakEvenPrice: yieldPerAcre > 0 ? totalCostPerAcre / yieldPerAcre : 0,
    profitLow,
    profitHigh,
  }

  /* --- Risk -------------------------------------------------------- */
  // Higher score = riskier. Combines market and yield volatility,
  // perishability, thin margin, capital at risk, and single-buyer exposure.
  const marginRatio = revenuePerAcre > 0 ? profitPerAcre / revenuePerAcre : -1
  let risk =
    crop.priceVolatility * 7 +
    crop.yieldVolatility * 7 +
    crop.perishability * 5 +
    (crop.marketChannels === 1 ? 10 : crop.marketChannels === 2 ? 4 : 0)
  if (marginRatio < 0.1) risk += 14
  else if (marginRatio < 0.2) risk += 7
  if (crop.establishCostPerAcre) risk += Math.min(18, crop.establishCostPerAcre / 1400)
  if (inputs.irrigation === "none" && crop.droughtTolerance <= 2) risk += 10
  const riskScore = Math.round(clamp(risk))

  // Priority weighting happens in selectCrops, where the whole field is known
  // and profit can be normalized against the other viable crops.
  return {
    crop,
    viable: blockers.length === 0,
    blockers,
    cautions,
    factors,
    suitability,
    riskScore,
    // Placeholder; filled in by selectCrops once the field is known.
    fitScore: suitability,
    economics,
    reasons: [],
  }
}

/* ------------------------------------------------------------------ *
 * Selection
 * ------------------------------------------------------------------ */

/** Priority scores that do not depend on the rest of the field. */
function staticPriorityScore(
  id: PriorityId,
  e: CropEvaluation,
  marketScore: number,
): number | null {
  const c = e.crop
  switch (id) {
    case "risk":
      return 100 - e.riskScore
    case "water":
      return clamp(100 - (c.waterInches / 40) * 100)
    case "labor":
      return clamp(100 - (c.laborHoursPerAcre / 210) * 100)
    case "season":
      return clamp(100 - ((c.seasonDays - 60) / 140) * 100)
    case "market":
      return clamp(marketScore * 0.6 + c.marketChannels * 13)
    case "soil":
      return clamp(((c.soilBuilding + 1) / 4) * 100)
    case "diversify":
      return clamp((c.market !== "commodity" ? 55 : 15) + c.marketChannels * 15)
    case "profit":
      return null
    default:
      return null
  }
}

export function selectCrops(inputs: FarmInputs): SelectionResult {
  const climate = resolveClimate(inputs.zip)
  const evaluations = CROPS.map((c) => evaluateCrop(c, inputs))
  const viable = evaluations.filter((e) => e.viable)
  const rejected = evaluations.filter((e) => !e.viable)

  // Profit needs normalizing across the viable field.
  const profits = viable.map((e) => e.economics.profitPerAcre)
  const maxProfit = profits.length ? Math.max(...profits) : 0
  const minProfit = profits.length ? Math.min(...profits) : 0
  const profitSpan = Math.max(1, maxProfit - minProfit)
  const profitScoreOf = (e: CropEvaluation) =>
    clamp(((e.economics.profitPerAcre - minProfit) / profitSpan) * 100)

  for (const e of viable) {
    const marketFactor = e.factors.find((f) => f.id === "market")?.score ?? 100
    const scores = inputs.priorities.map((id) =>
      id === "profit" ? profitScoreOf(e) : (staticPriorityScore(id, e, marketFactor) ?? 50),
    )
    const priorityAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null

    // With no priorities selected, fit is suitability with a mild profit tilt.
    e.fitScore =
      priorityAvg === null
        ? Math.round(e.suitability * 0.85 + profitScoreOf(e) * 0.15)
        : Math.round(e.suitability * 0.45 + priorityAvg * 0.55)

    // Explanations: the strongest factors, plus priority-specific notes.
    const top = [...e.factors].sort((a, b) => b.score - a.score).slice(0, 2)
    const reasons: string[] = []
    reasons.push(
      `Suitability ${e.suitability}/100 on your farm — strongest on ${top
        .map((f) => FACTOR_LABELS[f.id].toLowerCase())
        .join(" and ")}.`,
    )
    if (inputs.priorities.includes("profit")) {
      reasons.push(
        `Projected ${formatMoney(e.economics.profitPerAcre)}/ac margin over inputs and labor at $${LABOR_RATE}/h.`,
      )
    }
    if (inputs.priorities.includes("risk")) {
      reasons.push(
        `Risk ${e.riskScore}/100 — price volatility ${e.crop.priceVolatility}/5, perishability ${e.crop.perishability}/5.`,
      )
    }
    if (inputs.priorities.includes("water")) {
      reasons.push(`Needs about ${e.crop.waterInches}" of seasonal water.`)
    }
    if (inputs.priorities.includes("labor")) {
      reasons.push(`About ${e.crop.laborHoursPerAcre} field hours per acre.`)
    }
    if (inputs.priorities.includes("soil") && e.crop.soilBuilding > 0) {
      reasons.push(
        e.crop.soilBuilding >= 3
          ? "Strongly soil-building — adds organic matter and breaks pest cycles."
          : "Fixes nitrogen, reducing fertilizer on the following crop.",
      )
    }
    e.reasons = reasons
  }

  /* --- Rankings ---------------------------------------------------- */
  const rankings: Ranking[] = []
  const pick = (
    id: RankingId,
    sorter: (a: CropEvaluation, b: CropEvaluation) => number,
    headline: (e: CropEvaluation) => string,
    pool: CropEvaluation[] = viable,
  ) => {
    if (!pool.length) return
    const best = [...pool].sort(sorter)[0]
    rankings.push({ id, crop: best.crop, evaluation: best, headline: headline(best) })
  }

  // Every headline below recommends something to *grow for money*, so a
  // no-sale cover crop must not win any of them — it would read as "your best
  // option is to earn nothing". It still appears in the full comparison table
  // and is surfaced through the soil-building priority.
  const cash = viable.filter((e) => e.crop.group !== "cover")
  const earning = cash.filter((e) => e.economics.profitPerAcre > 0)

  pick(
    "overall",
    (a, b) => b.fitScore - a.fitScore,
    (e) => `Fit score ${e.fitScore}/100 against your constraints and priorities.`,
    cash,
  )
  pick(
    "profit",
    (a, b) => b.economics.profitPerAcre - a.economics.profitPerAcre,
    (e) =>
      `${formatMoney(e.economics.profitPerAcre)}/ac projected margin, ${formatMoney(e.economics.totalProfit)} across ${inputs.acres} ac.`,
    cash,
  )
  pick(
    "risk",
    (a, b) => a.riskScore - b.riskScore,
    (e) => `Risk ${e.riskScore}/100 with ${e.crop.marketChannels} sales outlet(s).`,
    // A "safe" pick that loses money every year is not safe.
    earning,
  )
  pick(
    "water",
    (a, b) => a.crop.waterInches - b.crop.waterInches,
    (e) => `Finishes on about ${e.crop.waterInches}" of seasonal moisture.`,
    earning,
  )
  pick(
    "lowcost",
    (a, b) => a.economics.totalCostPerAcre - b.economics.totalCostPerAcre,
    (e) => `${formatMoney(e.economics.totalCostPerAcre)}/ac total cost including labor.`,
    // A "low-cost option" is only useful if it actually returns money.
    earning,
  )

  const assumptions = [
    `Climate defaults come from ${climate.isFallback ? "a national average" : `typical values for ${climate.stateName}`} — about ${inputs.seasonDays} frost-free days and ${inputs.annualRainIn}" of annual precipitation. Both are editable above.`,
    `Growing-season moisture is estimated at ${Math.round(GROWING_SEASON_RAIN_SHARE * 100)}% of annual precipitation.`,
    `Labor is valued at $${LABOR_RATE}/hour including your own time, so profit here is lower than "gross margin" figures that ignore it.`,
    "Yields are adjusted down when your farm is a marginal match for a crop rather than assuming a best-case harvest.",
    "Prices are recent national typical values. Local basis, contracts, and organic premiums can move them substantially.",
    "Perennial establishment cost is amortized across the productive life of the stand.",
    "Land cost, rent, property tax, insurance, and machinery ownership are not included.",
  ]

  return { climate, evaluations, viable, rejected, rankings, assumptions }
}

/* ------------------------------------------------------------------ *
 * Handoff to the farm profitability calculator
 * ------------------------------------------------------------------ */

/**
 * Payload handed to the second agriculture tool so a farmer can move from
 * "what should I grow" straight into a full profitability projection without
 * retyping the assumptions behind the recommendation.
 */
export type ProfitabilityHandoff = {
  cropId: string
  cropName: string
  yieldUnit: string
  acres: number
  zip: string
  expectedYieldPerAcre: number
  expectedPrice: number
  inputCostPerAcre: number
  laborHoursPerAcre: number
  irrigation: Irrigation
  soil: SoilId
  establishCostPerAcre: number
  establishYears: number
}

export function buildHandoff(e: CropEvaluation, inputs: FarmInputs): ProfitabilityHandoff {
  return {
    cropId: e.crop.id,
    cropName: e.crop.name,
    yieldUnit: e.crop.yieldUnit,
    acres: inputs.acres,
    zip: inputs.zip,
    expectedYieldPerAcre: Math.round(e.economics.yieldPerAcre * 100) / 100,
    expectedPrice: e.economics.pricePerUnit,
    inputCostPerAcre: e.crop.inputCostPerAcre,
    laborHoursPerAcre: e.crop.laborHoursPerAcre,
    irrigation: inputs.irrigation,
    soil: inputs.soil,
    establishCostPerAcre: e.crop.establishCostPerAcre ?? 0,
    establishYears: e.crop.establishYears ?? 0,
  }
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function formatMoney(n: number): string {
  const abs = Math.abs(n)
  const rounded = abs >= 1000 ? Math.round(abs / 10) * 10 : Math.round(abs)
  return `${n < 0 ? "-" : ""}$${rounded.toLocaleString()}`
}

export function formatQty(n: number, unit: string): string {
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  return `${rounded.toLocaleString()} ${unit}`
}

export function defaultInputs(): FarmInputs {
  const climate = resolveClimate("")
  return {
    zip: "",
    acres: 40,
    soil: "loam",
    drainage: "well",
    ph: "unknown",
    irrigation: "none",
    seasonDays: climate.frostFreeDays,
    annualRainIn: climate.annualRainIn,
    // These defaults describe a realistic mid-scale diversified farm. Pairing
    // 40 acres with basic equipment, dry-only storage, and elevator-only sales
    // is internally contradictory: it blocks row crops on scale, produce on
    // cooling, and specialty crops on market access, leaving a cover crop as
    // the only survivor. A row-crop base with cooling and direct sales gives a
    // first-time visitor a genuine spread of options to react to.
    equipment: "rowcrop",
    labor: "family",
    capital: "moderate",
    storage: "cooled",
    market: "local",
    priorities: ["profit", "risk"],
  }
}
