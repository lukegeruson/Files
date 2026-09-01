// Shared ZIP-prefix to state resolution, used by every calculator on the site
// so location handling stays consistent across categories.

export type ZipState = { code: string; name: string }

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "Washington, DC",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
}

// ZIP prefix (first three digits) ranges mapped to a state code.
const ZIP_RANGES: Array<[number, number, string]> = [
  [5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"],
  [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"],
  [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"],
  [220, 246, "VA"], [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"],
  [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"], [370, 385, "TN"],
  [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"],
  [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"],
  [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"],
  [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"],
  [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"],
  [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
  [850, 865, "AZ"], [870, 884, "NM"], [889, 898, "NV"], [900, 961, "CA"],
  [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
]

/** Resolve a US ZIP code to a state, or null when it cannot be matched. */
export function resolveStateFromZip(zip: string): ZipState | null {
  const digits = (zip || "").replace(/\D/g, "")
  if (digits.length < 3) return null
  const prefix = Number.parseInt(digits.slice(0, 3), 10)
  if (Number.isNaN(prefix)) return null
  const match = ZIP_RANGES.find(([lo, hi]) => prefix >= lo && prefix <= hi)
  if (!match) return null
  const name = STATE_NAMES[match[2]]
  if (!name) return null
  return { code: match[2], name }
}
