// Remove the flat backdrop of the original claymation diorama by flood-filling
// from the image edges. Because the fill only spreads across contiguous
// background-colored pixels and stops at the model silhouette, the cream house
// walls and the pale sun (both interior "islands") are preserved.
import sharp from "sharp"
import path from "node:path"

const SRC = path.resolve("public/solar-styles/claymation.png")
const OUT = path.resolve("public/solar-styles/claymation-cutout.png")
const AI_MASK = path.resolve("public/solar-styles/claymation-ai-mask.png")

// How close a pixel must be to the sampled background color to be treated as
// background (0-255 per-channel Euclidean-ish distance). Kept moderate so it
// grabs the whole backdrop without eating the model.
const HARD = 26 // fully background at/under this distance
const SOFT = 46 // fully opaque at/over this distance (soft ramp between)

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width: w, height: h, channels: c } = info

// Sample the background color as the average of the four corners.
function px(x, y) {
  const i = (y * w + x) * c
  return [data[i], data[i + 1], data[i + 2]]
}
const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)]
const bg = [0, 1, 2].map(
  (k) => Math.round(corners.reduce((s, p) => s + p[k], 0) / corners.length),
)

function dist(i) {
  const dr = data[i] - bg[0]
  const dg = data[i + 1] - bg[1]
  const db = data[i + 2] - bg[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

// BFS flood fill from every edge pixel.
const visited = new Uint8Array(w * h)
const alpha = new Uint8Array(w * h).fill(255)
const queue = []
function seed(x, y) {
  const p = y * w + x
  if (!visited[p] && dist(p * c) <= SOFT) {
    visited[p] = 1
    queue.push(p)
  }
}
for (let x = 0; x < w; x++) {
  seed(x, 0)
  seed(x, h - 1)
}
for (let y = 0; y < h; y++) {
  seed(0, y)
  seed(w - 1, y)
}

let head = 0
while (head < queue.length) {
  const p = queue[head++]
  const i = p * c
  const d = dist(i)
  // Soft alpha ramp: background -> transparent, edge -> partial, model -> opaque.
  alpha[p] = d <= HARD ? 0 : d >= SOFT ? 255 : Math.round(((d - HARD) / (SOFT - HARD)) * 255)
  const x = p % w
  const y = (p / w) | 0
  const neighbors = [
    x > 0 ? p - 1 : -1,
    x < w - 1 ? p + 1 : -1,
    y > 0 ? p - w : -1,
    y < h - 1 ? p + w : -1,
  ]
  for (const np of neighbors) {
    if (np < 0 || visited[np]) continue
    if (dist(np * c) <= SOFT) {
      visited[np] = 1
      queue.push(np)
    }
  }
}

// Write the computed alpha back into the raw buffer.
for (let p = 0; p < w * h; p++) {
  if (visited[p]) data[p * c + 3] = alpha[p]
}

// --- Extra pass 1: clear the sky trapped around the electrical grid structure
// (the enclosed pocket between the house, the wires and the pole) using an AI
// SEMANTIC MASK. Plain flood-fill can't reach this pocket, and a plain color
// clear would eat the cream house wall (wall and sky share the same cream).
//
// The AI mask (RMBG-1.4) knows "sky" from "object" regardless of color. We use
// a DUAL GATE so nothing real is ever clipped: a pixel is only cleared when the
// AI mask says background (mask < threshold) AND its color is background-like.
//   - AI gate protects the cream WALL (mask marks it foreground) from color.
//   - Color gate protects thin WIRES/pole (dark) from any AI edge softness.
const { data: mask, info: mInfo } = await sharp(AI_MASK)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const mc = mInfo.channels
const maskAt = (x, y) => mask[(y * w + x) * mc] // grayscale: 0=bg, 255=fg

const AI_FG = 130 // mask values below this are treated as background
let aiCleared = 0
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c
    if (data[i + 3] === 0) continue // already transparent
    const isBgSemantic = maskAt(x, y) < AI_FG
    if (!isBgSemantic) continue // AI says this is real object -> never touch
    const d = dist(i)
    if (d > SOFT) continue // color says it's saturated (wire/pole) -> keep
    const a = d <= HARD ? 0 : Math.round(((d - HARD) / (SOFT - HARD)) * 255)
    if (a < data[i + 3]) {
      data[i + 3] = a
      if (a === 0) aiCleared++
    }
  }
}
console.log(`[v0] AI-mask pass cleared ${aiCleared} enclosed background px`)

// --- Extra pass 2: remove the painted clay sun. The top-left region contains
// nothing but the sun (the house starts well to the right), so we clear a
// feathered circle over it.
const SUN = { cx: 187, cy: 158, r: 150, feather: 12 }
for (let y = SUN.cy - SUN.r; y <= SUN.cy + SUN.r; y++) {
  if (y < 0 || y >= h) continue
  for (let x = SUN.cx - SUN.r; x <= SUN.cx + SUN.r; x++) {
    if (x < 0 || x >= w) continue
    const dx = x - SUN.cx
    const dy = y - SUN.cy
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r > SUN.r) continue
    const i = (y * w + x) * c
    if (r <= SUN.r - SUN.feather) {
      data[i + 3] = 0
    } else {
      // Soft outer edge: keep the more-transparent of existing vs. ramp.
      const a = Math.round(((r - (SUN.r - SUN.feather)) / SUN.feather) * 255)
      data[i + 3] = Math.min(data[i + 3], a)
    }
  }
}

let cleared = 0
for (let p = 0; p < w * h; p++) if (data[p * c + 3] === 0) cleared++

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .png()
  .toFile(OUT)

console.log(
  `[v0] bg=${bg.join(",")} cleared ${((cleared / (w * h)) * 100).toFixed(1)}% -> ${OUT}`,
)
