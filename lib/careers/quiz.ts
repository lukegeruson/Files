import type { QuizQuestion } from "./types"

/**
 * Six-question intake (spec section 8).
 *
 * Every question is skippable: the matcher renormalizes over the dimensions
 * that were actually answered, so a partial quiz still ranks sensibly.
 *
 * Options carry the data they imply (`skills`, `environments`) so the matcher
 * never has to keep a parallel mapping table in sync with this file.
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "enjoyment",
    question: "What kind of work sounds good to you?",
    helper: "Pick as many as you like. This is about interest, not experience.",
    multiSelect: true,
    options: [
      {
        id: "solar",
        label: "Clean energy and electrical systems",
        description: "Panels, batteries, wiring, and the grid",
        skills: ["electrical-basics"],
      },
      {
        id: "landscaping",
        label: "Plants, land, and outdoor spaces",
        description: "Gardens, turf, trees, patios, and irrigation",
        skills: ["horticulture"],
      },
      {
        id: "renovation",
        label: "Building and fixing homes",
        description: "Framing, finish work, plumbing, HVAC, remodels",
        skills: ["carpentry"],
      },
      {
        id: "agriculture",
        label: "Growing food and raising animals",
        description: "Crops, livestock, greenhouses, and farm technology",
        skills: ["crop-management"],
      },
      {
        id: "machines",
        label: "Running and fixing machines",
        description: "Equipment, engines, and diagnostics",
        skills: ["equipment-maintenance", "heavy-equipment"],
      },
      {
        id: "people",
        label: "Working with customers and crews",
        description: "Selling, teaching, and leading people",
        skills: ["customer-service", "crew-leadership"],
      },
      {
        id: "planning",
        label: "Designing and planning projects",
        description: "Drawings, layouts, bids, and numbers",
        skills: ["blueprint-reading", "estimating"],
      },
      {
        id: "technology",
        label: "Data, software, and new technology",
        description: "Sensors, drones, monitoring, and analysis",
        skills: ["software-tools", "data-analysis"],
      },
    ],
  },
  {
    id: "environment",
    question: "Where do you want to spend your day?",
    helper: "Pick whatever fits. Most field roles mix a few of these.",
    multiSelect: true,
    options: [
      { id: "outdoors", label: "Outdoors in the weather", environments: ["Outdoors"] },
      { id: "indoors", label: "Mostly indoors", environments: ["Indoors", "Shop", "Office"] },
      { id: "heights", label: "Up on roofs or at heights", environments: ["Rooftops", "Heights"] },
      { id: "team", label: "On a crew with other people", environments: ["Team-based", "Crew"] },
      { id: "independent", label: "Mostly on my own", environments: ["Independent work", "Solo"] },
      { id: "travel", label: "Moving between job sites", environments: ["Job sites", "Travel"] },
      { id: "office", label: "Some desk and planning time", environments: ["Office", "Desk"] },
    ],
  },
  {
    id: "physical",
    question: "How physical do you want the work to be?",
    helper: "Be realistic about your body — there are good options at every level.",
    multiSelect: false,
    options: [
      { id: "high", label: "Very physical", description: "Lifting and moving all day" },
      { id: "moderate", label: "Moderately active", description: "On my feet, but not constant heavy lifting" },
      { id: "low", label: "Lighter on the body", description: "Planning, driving, inspecting, or supervising" },
    ],
  },
  {
    id: "training",
    question: "How long can you train before you need to be earning?",
    multiSelect: false,
    options: [
      { id: "weeks", label: "Days or weeks", description: "I need to start working now" },
      { id: "months", label: "A few months", description: "A short course or certificate" },
      { id: "year-plus", label: "A year or more", description: "Apprenticeship or degree program" },
      { id: "any", label: "However long it takes", description: "I'm playing the long game" },
    ],
  },
  {
    id: "priority",
    question: "What matters most in your next job?",
    multiSelect: false,
    options: [
      { id: "fast-hire", label: "Getting hired quickly" },
      { id: "earnings", label: "Earning potential" },
      { id: "own-business", label: "Running my own business one day" },
      { id: "stability", label: "Steady, year-round work" },
      { id: "outdoors", label: "Being outside" },
    ],
  },
  {
    id: "experience",
    question: "How much relevant hands-on experience do you have?",
    helper: "Paid or unpaid — home projects and family businesses count.",
    multiSelect: false,
    options: [
      { id: "0", label: "None yet", description: "Starting from scratch" },
      { id: "1", label: "Under a year" },
      { id: "3", label: "One to three years" },
      { id: "5", label: "Three to five years" },
      { id: "8", label: "Five years or more" },
    ],
  },
]

export function getQuizQuestion(id: string): QuizQuestion | undefined {
  return QUIZ_QUESTIONS.find((q) => q.id === id)
}

/** Industry option ids in the enjoyment question, used to infer interest. */
export const INDUSTRY_OPTION_IDS = ["solar", "landscaping", "renovation", "agriculture"] as const

/**
 * Total quiz steps: the questions above plus the closing "what can you already
 * do" skills checklist, which lives in the component rather than as data.
 * Single source of truth so user-facing copy can't drift from the real count.
 */
export const QUIZ_STEP_COUNT = QUIZ_QUESTIONS.length + 1

/** Spelled-out step count, for prose like "Answer seven questions". */
export const QUIZ_STEP_COUNT_WORD =
  ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][
    QUIZ_STEP_COUNT
  ] ?? String(QUIZ_STEP_COUNT)
