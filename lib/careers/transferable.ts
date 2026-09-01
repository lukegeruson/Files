import type { TransferableChain } from "./types"

/**
 * Crossover chains (spec section 11): one shared skill that opens doors across
 * industries. This is the tool's most useful insight — someone who already has
 * a skill can move sideways instead of starting over.
 *
 * Every careerId below is verified to actually list the chain's skill in its
 * `skills` or `preferredSkills` (see .v0/test-matching.mts), so the UI never
 * claims a connection the data does not support.
 */
export const TRANSFERABLE_CHAINS: TransferableChain[] = [
  {
    id: "electrical",
    skillId: "electrical-basics",
    label: "Electrical work",
    description:
      "Wiring knowledge is the most portable skill across these industries. The same fundamentals cover a solar array, a house rewire, and a pump controller.",
    careerIds: ["electrician-apprentice", "electrician", "master-electrician", "solar-installer", "battery-storage-tech"],
  },
  {
    id: "water-systems",
    skillId: "irrigation-systems",
    label: "Water and irrigation systems",
    description:
      "Pumps, valves, and pressure behave the same whether you are running water to a lawn, a greenhouse bench, or a field.",
    careerIds: ["irrigation-tech", "irrigation-designer", "groundskeeper", "farm-manager"],
  },
  {
    id: "heavy-equipment",
    skillId: "heavy-equipment",
    label: "Heavy equipment operation",
    description:
      "Seat time transfers. An operator who can grade a site can dig footings, cut a pond, or prep a solar field.",
    careerIds: ["equipment-operator", "farm-equipment-operator", "hardscape-installer"],
  },
  {
    id: "plant-science",
    skillId: "horticulture",
    label: "Plant and soil knowledge",
    description:
      "How plants and soil behave underpins landscaping and agriculture alike — the crop changes, the science does not.",
    careerIds: ["groundskeeper", "horticulturist", "landscape-designer", "greenhouse-tech"],
  },
  {
    id: "mechanical-repair",
    skillId: "equipment-maintenance",
    label: "Mechanical repair",
    description:
      "Engines, hydraulics, and drivetrains are the same problem in a different chassis, whether it is a skid steer or a combine.",
    careerIds: ["ag-mechanic", "equipment-operator", "farm-equipment-operator", "groundskeeper"],
  },
  {
    id: "estimating",
    skillId: "estimating",
    label: "Estimating and bidding",
    description:
      "Once you can price work accurately you can price any work. This is the skill that turns a tradesperson into a business owner.",
    careerIds: ["construction-estimator", "landscape-estimator", "general-contractor", "landscape-business-owner", "solar-company-owner"],
  },
  {
    id: "crew-leadership",
    skillId: "crew-leadership",
    label: "Crew leadership",
    description:
      "Running a crew — scheduling, safety, quality, and people — is industry-agnostic, and it is the usual step from field work into management.",
    careerIds: ["solar-lead-installer", "grounds-supervisor", "hardscape-foreman", "construction-foreman", "field-supervisor"],
  },
  {
    id: "data-monitoring",
    skillId: "data-analysis",
    label: "Data and monitoring",
    description:
      "Sensors and dashboards are spreading through every one of these fields. Reading data well is becoming a field skill, not an office one.",
    careerIds: ["precision-ag-tech", "ag-drone-operator", "agronomist", "solar-designer"],
  },
]

export function getChain(id: string): TransferableChain | undefined {
  return TRANSFERABLE_CHAINS.find((c) => c.id === id)
}

/** Chains that include a given career. */
export function chainsForCareer(careerId: string): TransferableChain[] {
  return TRANSFERABLE_CHAINS.filter((c) => c.careerIds.includes(careerId))
}
