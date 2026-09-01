// Remove the flat backdrop of the original claymation diorama by flood-filling
// from the image edges. Because the fill only spreads across contiguous
// background-colored pixels and stops at the model silhouette, the cream house
// walls and the pale sun (both interior "islands") are preserved.
import sharp from "sharp"
import path from "node:path"

const SRC = path.resolve("public/solar-styles/claymation.png")
const OUT = path.resolve("public/solar-styles/claymation-cutout.png")

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

// --- Extra pass 1: clear the sky trapped around the electrical grid structure.
// The power wires + pole + transformer + roof seal these pockets off from the
// image border, so the edge flood can't reach them. They sit in the top-right
// of the scene, where the only model parts are the (dark brown) pole, the (dark)
// wires and the (gray) transformer -- there are NO cream house walls, which stay
// to the left of x~790. So within these zones we can safely clear every
// near-background pixel while the darker structure is left fully opaque.
function clearBox(x0, y0, x1, y1) {
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      const i = (y * w + x) * c
      const d = dist(i)
      if (d > SOFT) continue // model (pole/wire/transformer/roof) -> keep
      const a = d <= HARD ? 0 : Math.round(((d - HARD) / (SOFT - HARD)) * 255)
      data[i + 3] = Math.min(data[i + 3], a)
    }
  }
}
clearBox(690, 70, 1015, 300) // wire triangles + upper gap (pure sky, no walls)

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
