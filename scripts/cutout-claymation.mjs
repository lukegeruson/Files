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
clearBox(690, 70, 1015, 300) // wire lens + upper gap (above the roofline)

// The gap below the roofline is bounded on the left by the house's DIAGONAL
// wall edge, so a straight box would leave cream slivers. Instead we flood from
// interior seeds through near-background pixels: the fill hugs the wall's dark
// shaded edge (dist > SOFT) and stops there, so no wall is eaten and no sliver
// is left. Bounded to the top-right so it can never escape toward the walls.
function floodRegion(x0, y0, x1, y1) {
  const seen = new Uint8Array(w * h)
  const q = []
  const push = (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return
    const p = y * w + x
    if (seen[p]) return
    if (dist(p * c) > SOFT) return // model edge -> block
    seen[p] = 1
    q.push(p)
  }
  for (let y = y0; y <= y1; y += 10)
    for (let x = x0; x <= x1; x += 10) push(x, y)
  let hd = 0
  while (hd < q.length) {
    const p = q[hd++]
    const i = p * c
    const d = dist(i)
    const a = d <= HARD ? 0 : Math.round(((d - HARD) / (SOFT - HARD)) * 255)
    data[i + 3] = Math.min(data[i + 3], a)
    const x = p % w
    const y = (p / w) | 0
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }
}
floodRegion(724, 300, 1015, 560) // mid + lower gap, following the wall edge

// --- Extra pass 2: shave the light cream halo left along the model edges (most
// visible around the grass base border). We fade only near-cream pixels that
// touch a fully transparent pixel, so saturated grass, soil and roof are kept
// while the anti-aliased backdrop fringe is dissolved.
for (let iter = 0; iter < 2; iter++) {
  const fade = []
  for (let p = 0; p < w * h; p++) {
    if (data[p * c + 3] === 0) continue
    const x = p % w
    const y = (p / w) | 0
    const touchesClear =
      (x > 0 && data[(p - 1) * c + 3] === 0) ||
      (x < w - 1 && data[(p + 1) * c + 3] === 0) ||
      (y > 0 && data[(p - w) * c + 3] === 0) ||
      (y < h - 1 && data[(p + w) * c + 3] === 0)
    if (!touchesClear) continue
    if (dist(p * c) < 95) fade.push(p) // light/cream fringe only
  }
  for (const p of fade) data[p * c + 3] = Math.round(data[p * c + 3] * 0.4)
}

// --- Extra pass 3: remove the painted clay sun. The top-left region contains
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
