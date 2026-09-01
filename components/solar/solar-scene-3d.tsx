"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  CameraControls,
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  Line,
  RoundedBox,
  Sky,
} from "@react-three/drei"
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing"
import {
  CanvasTexture,
  CatmullRomCurve3,
  type Group,
  type Mesh,
  Vector3,
} from "three"
import { X } from "lucide-react"
import {
  COMPONENT_INFO,
  FLOW_KEYS,
  sunPosition,
  type ComponentId,
  type Frame,
} from "@/lib/solar-scene"

export type CameraPreset = "overview" | "flow"

type SceneProps = {
  frame: Frame
  panelCount: number
  hasBattery: boolean
  selected: ComponentId | null
  onSelect: (id: ComponentId | null) => void
  preset: CameraPreset
  /** Bumped by the parent to force a camera reset to the preset. */
  resetKey: number
  reducedMotion: boolean
}

// --- Fixed anchor points for flow routing & popups -------------------------

const ANCHORS: Record<Exclude<ComponentId, "sun">, [number, number, number]> = {
  panels: [0, 2.35, 0.85],
  inverter: [-2.15, 1.0, 0.6],
  meter: [-2.15, 1.0, -0.2],
  battery: [-2.15, 0.55, -0.95],
  home: [-0.55, 0.95, 0.1],
  grid: [-5, 1.7, -0.4],
}

const FLOW_COLORS: Record<(typeof FLOW_KEYS)[number], string> = {
  solarToHome: "#f5b445",
  solarToBattery: "#8bc46a",
  solarToGrid: "#3fae82",
  gridToHome: "#5b8def",
  batteryToHome: "#9b83f0",
}

// Waypoints for each directed flow, in scene units.
const FLOW_PATHS: Record<(typeof FLOW_KEYS)[number], [number, number, number][]> =
  {
    solarToHome: [ANCHORS.panels, ANCHORS.inverter, ANCHORS.home],
    solarToBattery: [ANCHORS.panels, ANCHORS.inverter, ANCHORS.battery],
    solarToGrid: [ANCHORS.panels, ANCHORS.inverter, ANCHORS.meter, ANCHORS.grid],
    gridToHome: [ANCHORS.grid, ANCHORS.meter, ANCHORS.home],
    batteryToHome: [ANCHORS.battery, ANCHORS.home],
  }

// ---------------------------------------------------------------------------
// Camera rig
// ---------------------------------------------------------------------------

function Rig({ preset, resetKey }: { preset: CameraPreset; resetKey: number }) {
  const ref = useRef<CameraControls>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (preset === "flow") {
      c.setLookAt(-1.6, 3.0, 8.8, -1.3, 1.0, -0.2, true)
    } else {
      c.setLookAt(7.6, 4.7, 8.4, -0.2, 1.1, 0, true)
    }
  }, [preset, resetKey])

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={5}
      maxDistance={20}
      // Keep the camera above the ground.
      maxPolarAngle={Math.PI / 2.05}
    />
  )
}

// ---------------------------------------------------------------------------
// Procedural studio environment: gives glass and metal real reflections
// without loading any external HDRI. Baked once (frames={1}).
// ---------------------------------------------------------------------------

function StudioEnvironment({ daylight }: { daylight: number }) {
  return (
    <Environment resolution={256} frames={1} background={false}>
      {/* Warm key from the sun side. */}
      <Lightformer
        form="rect"
        intensity={2.2 + daylight * 1.4}
        color="#fff0d0"
        position={[5, 6, -2]}
        scale={[8, 6, 1]}
        target={[0, 1, 0]}
      />
      {/* Cool sky fill from above. */}
      <Lightformer
        form="rect"
        intensity={1.1 + daylight * 0.6}
        color="#cfe2f2"
        position={[0, 8, 3]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[12, 12, 1]}
      />
      {/* Soft rim from the rear to separate the house from the sky. */}
      <Lightformer
        form="rect"
        intensity={1.4}
        color="#ffd9a0"
        position={[-6, 3, -6]}
        scale={[6, 5, 1]}
        target={[0, 1, 0]}
      />
    </Environment>
  )
}

// ---------------------------------------------------------------------------
// Lighting that tracks the time of day
// ---------------------------------------------------------------------------

function DayLighting({ hour, daylight }: { hour: number; daylight: number }) {
  // Continuous sun direction for the sky shader (dips below the horizon at
  // night so the sky darkens on its own).
  const a = (Math.PI * (hour - 6)) / 12
  const skySun: [number, number, number] = [
    -Math.cos(a) * 100,
    Math.sin(a) * 100,
    -30,
  ]
  const sunPos = sunPosition(hour) ?? [4, 6, -3]

  return (
    <>
      <Sky
        sunPosition={skySun}
        turbidity={6}
        rayleigh={daylight > 0 ? 1.4 : 0.3}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />
      <hemisphereLight
        intensity={0.3 + 0.3 * daylight}
        color="#fff6e6"
        groundColor="#8f8467"
      />
      <ambientLight intensity={0.15 + 0.25 * daylight} />
      {/* Key light for crisp highlights; grounding shadow comes from
          ContactShadows so this one stays cheap (no shadow map). */}
      <directionalLight
        position={sunPos}
        intensity={0.2 + 1.6 * daylight}
        color="#fff1d0"
      />
      {/* Warm interior glow that grows as the sun sets, so the house reads at night. */}
      <pointLight
        position={[-0.4, 1, 0.4]}
        intensity={0.6 * (1 - daylight)}
        color="#ffcf87"
        distance={6}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// The sun: core sphere plus layered halos that bloom into a warm glow
// ---------------------------------------------------------------------------

function Sun({
  hour,
  selected,
  onSelect,
}: {
  hour: number
  selected: boolean
  onSelect: (id: ComponentId | null) => void
}) {
  const pos = sunPosition(hour)
  if (!pos) return null
  return (
    <group position={pos}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect("sun")
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto"
        }}
      >
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshStandardMaterial
          color="#fff2c2"
          emissive="#ffb638"
          emissiveIntensity={selected ? 4 : 2.6}
          toneMapped={false}
        />
      </mesh>
      {/* Layered halos — soft on the outside, brighter toward the core. */}
      <mesh scale={1.35}>
        <sphereGeometry args={[0.72, 24, 24]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh scale={2.1}>
        <sphereGeometry args={[0.72, 24, 24]} />
        <meshBasicMaterial color="#ffcf6b" transparent opacity={0.12} toneMapped={false} />
      </mesh>
      <mesh scale={3.0}>
        <sphereGeometry args={[0.72, 24, 24]} />
        <meshBasicMaterial color="#ffc768" transparent opacity={0.05} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Clickable helper: wires up selection + hover cursor
// ---------------------------------------------------------------------------

function Clickable({
  id,
  onSelect,
  children,
}: {
  id: ComponentId
  onSelect: (id: ComponentId | null) => void
  children: React.ReactNode
}) {
  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto"
      }}
    >
      {children}
    </group>
  )
}

// ---------------------------------------------------------------------------
// House + roof + panels
// ---------------------------------------------------------------------------

const ROOF_RISE = 0.9
const ROOF_HALF_DEPTH = 1.5
const ROOF_ANGLE = Math.atan2(ROOF_RISE, ROOF_HALF_DEPTH)

function PanelArray({ count }: { count: number }) {
  // Lay out up to 24 panels in a tidy grid sized to the roof.
  const shown = Math.max(3, Math.min(24, count))
  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(shown * 1.6))))
  const rows = Math.min(4, Math.ceil(shown / cols))
  const pw = 0.52
  const ph = 0.34
  const gap = 0.06
  const totalW = cols * pw + (cols - 1) * gap
  const totalH = rows * ph + (rows - 1) * gap

  const panels: React.ReactNode[] = []
  let placed = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (placed >= shown) break
      const x = -totalW / 2 + pw / 2 + c * (pw + gap)
      const z = -totalH / 2 + ph / 2 + r * (ph + gap)
      panels.push(
        <group key={`${r}-${c}`} position={[x, 0.06, z]}>
          {/* Silver frame */}
          <mesh castShadow>
            <boxGeometry args={[pw, 0.05, ph]} />
            <meshStandardMaterial color="#c9d2dc" metalness={0.85} roughness={0.35} />
          </mesh>
          {/* Reflective glass cell face, inset slightly above the frame */}
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[pw - 0.05, 0.02, ph - 0.05]} />
            <meshStandardMaterial
              color="#123456"
              emissive="#2f6fae"
              emissiveIntensity={0.28}
              metalness={0.95}
              roughness={0.12}
            />
          </mesh>
          {/* Cell grid lines */}
          <mesh position={[0, 0.041, 0]}>
            <boxGeometry args={[pw - 0.05, 0.001, 0.012]} />
            <meshBasicMaterial color="#0c2540" />
          </mesh>
          <mesh position={[0, 0.041, 0]}>
            <boxGeometry args={[0.012, 0.001, ph - 0.05]} />
            <meshBasicMaterial color="#0c2540" />
          </mesh>
        </group>,
      )
      placed++
    }
  }

  return (
    // Front-facing slope: sit at the slope centre and tilt so the +z (eave)
    // edge drops away from the ridge.
    <group position={[0, 2.15, 0.75]} rotation={[ROOF_ANGLE, 0, 0]}>
      {/* Mounting deck the panels rest on. */}
      <mesh receiveShadow>
        <boxGeometry args={[totalW + 0.24, 0.06, totalH + 0.24]} />
        <meshStandardMaterial color="#3a4250" metalness={0.5} roughness={0.6} />
      </mesh>
      {panels}
    </group>
  )
}

function Window({ x, y = 0.95, z = 1.52 }: { x: number; y?: number; z?: number }) {
  return (
    <group position={[x, y, z]}>
      {/* Outer casing */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[0.74, 0.74, 0.06]} />
        <meshStandardMaterial color="#efe7d5" roughness={0.7} />
      </mesh>
      {/* Glass */}
      <mesh>
        <boxGeometry args={[0.58, 0.58, 0.04]} />
        <meshStandardMaterial
          color="#bcdcea"
          emissive="#ffdda0"
          emissiveIntensity={0.3}
          metalness={0.5}
          roughness={0.08}
        />
      </mesh>
      {/* Muntins (cross bars) */}
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.6, 0.03, 0.02]} />
        <meshStandardMaterial color="#efe7d5" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.03, 0.6, 0.02]} />
        <meshStandardMaterial color="#efe7d5" roughness={0.7} />
      </mesh>
      {/* Shutters */}
      {[-0.42, 0.42].map((sx) => (
        <mesh key={sx} position={[sx, 0, 0]}>
          <boxGeometry args={[0.14, 0.72, 0.04]} />
          <meshStandardMaterial color="#3f5d52" roughness={0.7} />
        </mesh>
      ))}
      {/* Sill */}
      <mesh position={[0, -0.42, 0.06]}>
        <boxGeometry args={[0.82, 0.06, 0.1]} />
        <meshStandardMaterial color="#e0d6c0" roughness={0.7} />
      </mesh>
    </group>
  )
}

function House({ onSelect }: { onSelect: (id: ComponentId | null) => void }) {
  return (
    <group>
      <Clickable id="home" onSelect={onSelect}>
        {/* Main body */}
        <RoundedBox
          args={[4, 1.7, 3]}
          radius={0.04}
          smoothness={4}
          position={[0, 0.85, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#f4eada" roughness={0.75} metalness={0.02} />
        </RoundedBox>

        {/* Stone foundation course */}
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <boxGeometry args={[4.08, 0.26, 3.08]} />
          <meshStandardMaterial color="#9c9384" roughness={0.95} />
        </mesh>

        {/* Corner quoins for architectural detail */}
        {[
          [-1.99, 1.99],
          [1.99, 1.99],
          [-1.99, -1.99],
          [1.99, -1.99],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.85, z]}>
            <boxGeometry args={[0.14, 1.6, 0.14]} />
            <meshStandardMaterial color="#e6dcc7" roughness={0.8} />
          </mesh>
        ))}

        {/* Covered entry: recessed door, porch roof, and steps */}
        <group position={[0, 0, 1.5]}>
          {/* Door */}
          <mesh position={[0, 0.6, 0.02]}>
            <boxGeometry args={[0.66, 1.2, 0.06]} />
            <meshStandardMaterial color="#5e3d24" roughness={0.55} />
          </mesh>
          {/* Door panels inset */}
          <mesh position={[0, 0.6, 0.06]}>
            <boxGeometry args={[0.5, 1.02, 0.02]} />
            <meshStandardMaterial color="#6f4a2c" roughness={0.5} />
          </mesh>
          {/* Handle */}
          <mesh position={[0.2, 0.58, 0.08]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#e0b452" metalness={0.9} roughness={0.25} />
          </mesh>
          {/* Transom light above door */}
          <mesh position={[0, 1.28, 0.05]}>
            <boxGeometry args={[0.66, 0.18, 0.03]} />
            <meshStandardMaterial color="#bcdcea" emissive="#ffdda0" emissiveIntensity={0.35} roughness={0.1} metalness={0.4} />
          </mesh>
          {/* Small porch roof */}
          <mesh position={[0, 1.5, 0.28]} castShadow>
            <boxGeometry args={[1.1, 0.08, 0.6]} />
            <meshStandardMaterial color="#5f3d2e" roughness={0.8} />
          </mesh>
          {[-0.42, 0.42].map((px) => (
            <mesh key={px} position={[px, 0.7, 0.5]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 1.4, 12]} />
              <meshStandardMaterial color="#efe7d5" roughness={0.7} />
            </mesh>
          ))}
          {/* Steps */}
          <mesh position={[0, 0.03, 0.5]} receiveShadow>
            <boxGeometry args={[1.0, 0.08, 0.5]} />
            <meshStandardMaterial color="#b7ad98" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.1, 0.32]} receiveShadow>
            <boxGeometry args={[0.8, 0.08, 0.3]} />
            <meshStandardMaterial color="#c2b8a2" roughness={0.9} />
          </mesh>
        </group>

        {/* Windows flanking the entry */}
        <Window x={-1.2} />
        <Window x={1.2} />

        {/* Chimney */}
        <mesh position={[1.3, 2.75, -0.5]} castShadow>
          <boxGeometry args={[0.36, 0.75, 0.36]} />
          <meshStandardMaterial color="#a8907a" roughness={0.9} />
        </mesh>
        <mesh position={[1.3, 3.15, -0.5]}>
          <boxGeometry args={[0.44, 0.1, 0.44]} />
          <meshStandardMaterial color="#8a7461" roughness={0.9} />
        </mesh>
      </Clickable>

      {/* --- Roof: shingled slopes with an overhanging eave + fascia --- */}
      {/* Front (south) slope beneath the panels. */}
      <mesh
        position={[0, 2.15, 0.78]}
        rotation={[ROOF_ANGLE, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[4.4, 0.12, 2.05]} />
        <meshStandardMaterial color="#6d4436" roughness={0.9} />
      </mesh>
      {/* Back (north) slope. */}
      <mesh
        position={[0, 2.15, -0.78]}
        rotation={[-ROOF_ANGLE, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[4.4, 0.12, 2.05]} />
        <meshStandardMaterial color="#6d4436" roughness={0.9} />
      </mesh>
      {/* Fascia board along the front eave. */}
      <mesh position={[0, 1.83, 1.72]}>
        <boxGeometry args={[4.4, 0.14, 0.06]} />
        <meshStandardMaterial color="#efe7d5" roughness={0.7} />
      </mesh>
      {/* Gable end fills (triangles approximated by thin tapered prisms). */}
      {[-2.02, 2.02].map((x) => (
        <mesh key={x} position={[x, 2.15, 0]}>
          <boxGeometry args={[0.06, 0.9, 2.6]} />
          <meshStandardMaterial color="#e9dfca" roughness={0.8} />
        </mesh>
      ))}
      {/* Ridge cap along the top of the two slopes. */}
      <mesh position={[0, 2.64, 0]} castShadow>
        <boxGeometry args={[4.45, 0.14, 0.2]} />
        <meshStandardMaterial color="#4f3125" roughness={0.85} />
      </mesh>
      {/* Panels are rendered by HouseWithPanels so the count stays live. */}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Left-wall equipment: inverter, meter, battery
// ---------------------------------------------------------------------------

function Equipment({
  hasBattery,
  onSelect,
}: {
  hasBattery: boolean
  onSelect: (id: ComponentId | null) => void
}) {
  return (
    <group>
      {/* Inverter */}
      <Clickable id="inverter" onSelect={onSelect}>
        <RoundedBox
          args={[0.24, 0.6, 0.4]}
          radius={0.04}
          smoothness={4}
          position={ANCHORS.inverter}
          castShadow
        >
          <meshStandardMaterial color="#eef1f4" roughness={0.35} metalness={0.35} />
        </RoundedBox>
        <mesh position={[ANCHORS.inverter[0] + 0.13, ANCHORS.inverter[1], ANCHORS.inverter[2]]}>
          <boxGeometry args={[0.02, 0.3, 0.22]} />
          <meshStandardMaterial color="#2f6fae" emissive="#3f8fd0" emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      </Clickable>

      {/* Meter */}
      <Clickable id="meter" onSelect={onSelect}>
        <RoundedBox
          args={[0.22, 0.4, 0.34]}
          radius={0.04}
          smoothness={4}
          position={ANCHORS.meter}
          castShadow
        >
          <meshStandardMaterial color="#dfdccf" roughness={0.5} metalness={0.2} />
        </RoundedBox>
        <mesh
          position={[ANCHORS.meter[0] + 0.12, ANCHORS.meter[1] + 0.05, ANCHORS.meter[2]]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.09, 0.09, 0.03, 24]} />
          <meshStandardMaterial color="#2a323b" emissive="#5b8def" emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </Clickable>

      {/* Battery (only when the system includes one) */}
      {hasBattery ? (
        <Clickable id="battery" onSelect={onSelect}>
          <RoundedBox
            args={[0.28, 0.7, 0.5]}
            radius={0.05}
            smoothness={4}
            position={ANCHORS.battery}
            castShadow
          >
            <meshStandardMaterial color="#f0ece2" roughness={0.35} metalness={0.25} />
          </RoundedBox>
          <mesh position={[ANCHORS.battery[0] + 0.15, ANCHORS.battery[1], ANCHORS.battery[2]]}>
            <boxGeometry args={[0.02, 0.42, 0.08]} />
            <meshStandardMaterial color="#9b83f0" emissive="#9b83f0" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        </Clickable>
      ) : null}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Utility grid: pole + transformer + service wire
// ---------------------------------------------------------------------------

function GridPole({ onSelect }: { onSelect: (id: ComponentId | null) => void }) {
  const [gx, , gz] = ANCHORS.grid
  return (
    <Clickable id="grid" onSelect={onSelect}>
      {/* Pole */}
      <mesh position={[gx, 1.6, gz]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 3.2, 12]} />
        <meshStandardMaterial color="#7a6549" roughness={0.85} />
      </mesh>
      {/* Crossarm */}
      <mesh position={[gx, 2.9, gz]} castShadow>
        <boxGeometry args={[0.12, 0.12, 1.4]} />
        <meshStandardMaterial color="#5f4d3b" roughness={0.85} />
      </mesh>
      {/* Insulators */}
      {[-0.5, 0.5].map((dz) => (
        <mesh key={dz} position={[gx, 3.0, gz + dz]}>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
          <meshStandardMaterial color="#3a4048" roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {/* Transformer */}
      <mesh position={[gx, 2.2, gz + 0.25]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.5, 16]} />
        <meshStandardMaterial color="#9a958a" metalness={0.6} roughness={0.4} />
      </mesh>
    </Clickable>
  )
}

// ---------------------------------------------------------------------------
// Static conduit lines (always visible, subtle) + animated flow particles
// ---------------------------------------------------------------------------

function ConduitLines() {
  return (
    <>
      {FLOW_KEYS.map((key) => {
        // Draw import/discharge conduits once (they overlap export paths).
        if (key === "solarToBattery" || key === "solarToGrid" || key === "batteryToHome")
          return null
        return (
          <Line
            key={key}
            points={FLOW_PATHS[key]}
            color="#6f6857"
            lineWidth={1.2}
            transparent
            opacity={0.28}
          />
        )
      })}
      <Line points={FLOW_PATHS.solarToBattery} color="#6f6857" lineWidth={1.2} transparent opacity={0.28} />
    </>
  )
}

function FlowParticles({
  points,
  color,
  active,
  kw,
  reducedMotion,
}: {
  points: [number, number, number][]
  color: string
  active: boolean
  kw: number
  reducedMotion: boolean
}) {
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map((p) => new Vector3(...p))),
    [points],
  )
  const count = active ? Math.min(7, Math.max(3, Math.round(kw) + 3)) : 0
  const meshes = useRef<(Group | null)[]>([])
  const t = useRef(0)
  const speed = 0.1 + Math.min(0.35, kw * 0.03)

  useFrame((_, delta) => {
    if (!active || reducedMotion) return
    t.current = (t.current + delta * speed) % 1
    for (let i = 0; i < count; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const at = (t.current + i / count) % 1
      const p = curve.getPointAt(at)
      m.position.set(p.x, p.y, p.z)
    }
  })

  if (!active) return null

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        // Static, evenly spaced when motion is reduced.
        const at = reducedMotion ? i / count : 0
        const p = curve.getPointAt(at)
        return (
          <group
            key={i}
            ref={(el) => {
              meshes.current[i] = el
            }}
            position={[p.x, p.y, p.z]}
          >
            {/* Bright core */}
            <mesh>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={2.6}
                toneMapped={false}
              />
            </mesh>
            {/* Soft glow shell that blooms */}
            <mesh scale={2.1}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial color={color} transparent opacity={0.22} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Selection ring + popup card
// ---------------------------------------------------------------------------

function SelectionRing({
  anchor,
  reducedMotion,
}: {
  anchor: [number, number, number]
  reducedMotion: boolean
}) {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (reducedMotion || !ref.current) return
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08
    ref.current.scale.set(s, s, s)
    ref.current.rotation.z = state.clock.elapsedTime * 0.6
  })
  return (
    <mesh ref={ref} position={anchor} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.62, 0.028, 12, 48]} />
      <meshStandardMaterial
        color="#f5b445"
        emissive="#f5b445"
        emissiveIntensity={2.2}
        toneMapped={false}
      />
    </mesh>
  )
}

function InfoPopup({
  id,
  hour,
  onSelect,
}: {
  id: ComponentId
  hour: number
  onSelect: (id: ComponentId | null) => void
}) {
  const info = COMPONENT_INFO[id]
  const anchor =
    id === "sun" ? sunPosition(hour) ?? [4, 6, -3] : ANCHORS[id]
  const cardAnchor: [number, number, number] = [
    anchor[0],
    anchor[1] + 0.95,
    anchor[2],
  ]
  return (
    <Html position={cardAnchor} center distanceFactor={9} zIndexRange={[40, 0]}>
      <div className="w-60 overflow-hidden rounded-xl border border-primary/25 bg-card/95 text-left shadow-xl ring-1 ring-black/5 backdrop-blur-md">
        <div className="flex items-start justify-between gap-2 border-b border-border/70 bg-gradient-to-r from-primary/12 to-transparent px-3 py-2">
          <h4 className="font-serif text-sm font-semibold text-card-foreground">
            {info.title}
          </h4>
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(null)
            }}
            className="-mr-0.5 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <p className="px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {info.blurb}
        </p>
      </div>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Ground: radial-gradient plot that fades into the sky at the edges
// ---------------------------------------------------------------------------

// A painted top-down site plan: mown lawn with subtle mowing stripes, a warm
// flagstone path leading to the front door, and a soft vignette that fades the
// plot into the horizon so there's no hard disc edge.
function useGroundTexture() {
  return useMemo(() => {
    const size = 1024
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")!

    // Base lawn gradient (richer green in the middle, drying toward the edge).
    const g = ctx.createRadialGradient(
      size / 2, size * 0.46, size * 0.08,
      size / 2, size / 2, size * 0.52,
    )
    g.addColorStop(0, "#6f8f46")
    g.addColorStop(0.5, "#5f8340")
    g.addColorStop(0.8, "#8a9a5e")
    g.addColorStop(1, "#b9bd94")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)

    // Diagonal mowing stripes for a manicured lawn.
    ctx.save()
    ctx.translate(size / 2, size / 2)
    ctx.rotate(-0.5)
    ctx.globalAlpha = 0.06
    const stripe = size / 16
    for (let i = -20; i < 20; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#0b2a0b"
      ctx.fillRect(i * stripe, -size, stripe, size * 2)
    }
    ctx.restore()

    // Speckle for grass texture.
    ctx.globalAlpha = 0.05
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      ctx.fillStyle = Math.random() > 0.5 ? "#dfeecb" : "#243d16"
      ctx.fillRect(x, y, 1.5, 1.5)
    }
    ctx.globalAlpha = 1

    // Flagstone path from the front door (bottom center) toward the camera.
    const cx = size / 2
    ctx.strokeStyle = "#c9bda0"
    ctx.fillStyle = "#d8ccae"
    for (let i = 0; i < 9; i++) {
      const y = size * 0.62 + i * 44
      const w = 120 - i * 3
      ctx.beginPath()
      ctx.roundRect(cx - w / 2, y, w, 34, 10)
      ctx.fill()
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Edge vignette so the circle dissolves into the distance.
    const v = ctx.createRadialGradient(
      size / 2, size / 2, size * 0.34,
      size / 2, size / 2, size * 0.5,
    )
    v.addColorStop(0, "rgba(0,0,0,0)")
    v.addColorStop(1, "rgba(196,201,168,0.85)")
    ctx.fillStyle = v
    ctx.fillRect(0, 0, size, size)

    const tex = new CanvasTexture(canvas)
    return tex
  }, [])
}

// One stylized tree: a tapered trunk with two clustered foliage blobs. Cheap,
// but reads clearly as a tree and casts a soft contact shadow via the scene.
function Tree({
  position,
  scale = 1,
  tint = "#4f7a3a",
}: {
  position: [number, number, number]
  scale?: number
  tint?: string
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 1, 8]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial color={tint} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0.28, 1.65, 0.1]} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial color="#5c8a44" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[-0.26, 1.5, -0.12]} castShadow>
        <icosahedronGeometry args={[0.38, 1]} />
        <meshStandardMaterial color="#456d34" roughness={0.85} flatShading />
      </mesh>
    </group>
  )
}

// Low foundation hedge run made of overlapping rounded boxes.
function Hedge({
  position,
  length = 2,
  rotation = 0,
}: {
  position: [number, number, number]
  length?: number
  rotation?: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[length, 0.32, 0.34]} radius={0.14} smoothness={3} position={[0, 0.16, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3f6a30" roughness={0.9} flatShading />
      </RoundedBox>
    </group>
  )
}

function Ground() {
  const tex = useGroundTexture()
  return (
    <group>
      {/* Manicured plot the house sits on. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.3, 0, 0]} receiveShadow>
        <circleGeometry args={[9, 96]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
      {/* Raised soil bed under the foundation planting along the front wall. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 1.75]} receiveShadow>
        <planeGeometry args={[4.4, 0.9]} />
        <meshStandardMaterial color="#4a3524" roughness={1} />
      </mesh>

      {/* Foundation hedges flanking the door. */}
      <Hedge position={[-1.35, 0, 1.72]} length={1.4} />
      <Hedge position={[1.35, 0, 1.72]} length={1.4} />

      {/* Trees framing the plot, kept clear of equipment (left) and flows. */}
      <Tree position={[3.6, 0, 2.1]} scale={1.15} />
      <Tree position={[4.3, 0, -1.6]} scale={0.9} tint="#557f3f" />
      <Tree position={[-3.9, 0, 2.6]} scale={0.8} tint="#4b7538" />
      <Tree position={[2.2, 0, 3.4]} scale={0.7} tint="#5c8a44" />

      {/* A couple of shrubs by the utility pole for scale. */}
      <mesh position={[-4.6, 0.18, 0.6]} castShadow>
        <icosahedronGeometry args={[0.3, 1]} />
        <meshStandardMaterial color="#4f7a3a" roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Scene assembly
// ---------------------------------------------------------------------------

function SceneContents({
  frame,
  panelCount,
  hasBattery,
  selected,
  onSelect,
  preset,
  resetKey,
  reducedMotion,
}: SceneProps) {
  return (
    <>
      <Rig preset={preset} resetKey={resetKey} />
      <StudioEnvironment daylight={frame.daylight} />
      <DayLighting hour={frame.hour} daylight={frame.daylight} />
      <Ground />
      {/* Soft grounding shadow under everything. */}
      <ContactShadows
        position={[-0.3, 0.03, 0]}
        scale={18}
        far={6}
        blur={2.8}
        opacity={0.32 + frame.daylight * 0.22}
        resolution={1024}
        color="#243d16"
      />

      <group>
        {/* House with the panel array wired to the live count. */}
        <HouseWithPanels panelCount={panelCount} onSelect={onSelect} />
        <Equipment hasBattery={hasBattery} onSelect={onSelect} />
        <GridPole onSelect={onSelect} />
      </group>

      <Sun hour={frame.hour} selected={selected === "sun"} onSelect={onSelect} />

      <ConduitLines />
      {FLOW_KEYS.map((key) => (
        <FlowParticles
          key={key}
          points={FLOW_PATHS[key]}
          color={FLOW_COLORS[key]}
          active={frame.flows[key] > 0.05}
          kw={frame.flows[key]}
          reducedMotion={reducedMotion}
        />
      ))}

      {selected ? (
        <>
          <SelectionRing
            anchor={
              selected === "sun"
                ? (sunPosition(frame.hour) ?? [4, 6, -3])
                : ANCHORS[selected]
            }
            reducedMotion={reducedMotion}
          />
          <InfoPopup id={selected} hour={frame.hour} onSelect={onSelect} />
        </>
      ) : null}

      {/* Bloom makes the sun, glowing indicators, and energy particles read as
          light. Threshold > 1 so only the toneMapped=false emissives bloom,
          leaving the house and ground crisp. */}
      <EffectComposer enableNormalPass={false}>
        <Bloom
          intensity={0.85}
          luminanceThreshold={1}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.32} darkness={0.42} />
      </EffectComposer>
    </>
  )
}

// House needs the panel count; kept as a thin wrapper so House stays tidy.
function HouseWithPanels({
  panelCount,
  onSelect,
}: {
  panelCount: number
  onSelect: (id: ComponentId | null) => void
}) {
  return (
    <group>
      <House onSelect={onSelect} />
      {/* Overlay the real panel array (House renders a placeholder group). */}
      <Clickable id="panels" onSelect={onSelect}>
        <PanelArray count={panelCount} />
      </Clickable>
    </group>
  )
}

export default function SolarScene3D(props: SceneProps) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [7.6, 4.7, 8.4], fov: 45 }}
      onPointerMissed={() => props.onSelect(null)}
      gl={{ antialias: true }}
    >
      {ready ? <SceneContents {...props} /> : null}
    </Canvas>
  )
}
