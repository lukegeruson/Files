"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  CameraControls,
  Html,
  Line,
  RoundedBox,
  Sky,
} from "@react-three/drei"
import { CatmullRomCurve3, type Group, type Mesh, Vector3 } from "three"
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
      c.setLookAt(-1.5, 3.1, 8.6, -1.3, 1.0, -0.2, true)
    } else {
      c.setLookAt(7.2, 5, 8, 0, 1.15, 0, true)
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
// Lighting + sky that track the time of day
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
      <Sky sunPosition={skySun} turbidity={8} rayleigh={daylight > 0 ? 2 : 0.4} />
      <hemisphereLight
        intensity={0.35 + 0.35 * daylight}
        color="#fff6e6"
        groundColor="#b7a98c"
      />
      <ambientLight intensity={0.2 + 0.35 * daylight} />
      <directionalLight
        position={sunPos}
        intensity={0.15 + 1.35 * daylight}
        color="#fff1d0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      {/* Warm interior glow that grows as the sun sets, so the house reads at night. */}
      <pointLight
        position={[-0.4, 1, 0.4]}
        intensity={0.5 * (1 - daylight)}
        color="#ffcf87"
        distance={6}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// The sun
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
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial
          color="#ffd66b"
          emissive="#ffb638"
          emissiveIntensity={selected ? 3 : 2}
          toneMapped={false}
        />
      </mesh>
      {/* Soft halo */}
      <mesh scale={1.6}>
        <sphereGeometry args={[0.7, 24, 24]} />
        <meshBasicMaterial color="#ffcf6b" transparent opacity={0.14} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Clickable helper: wires up selection, hover cursor, and a subtle hover lift
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
        <mesh key={`${r}-${c}`} position={[x, 0.05, z]} castShadow>
          <boxGeometry args={[pw, 0.04, ph]} />
          <meshStandardMaterial
            color="#1c3d63"
            emissive="#2f5c8a"
            emissiveIntensity={0.25}
            metalness={0.5}
            roughness={0.35}
          />
        </mesh>,
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
        <boxGeometry args={[4.1, 0.08, 1.85]} />
        <meshStandardMaterial color="#6d5b45" roughness={0.9} />
      </mesh>
      {panels}
    </group>
  )
}

function House({ onSelect }: { onSelect: (id: ComponentId | null) => void }) {
  return (
    <group>
      <Clickable id="home" onSelect={onSelect}>
        {/* Body */}
        <RoundedBox
          args={[4, 1.7, 3]}
          radius={0.06}
          smoothness={4}
          position={[0, 0.85, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#efe7d8" roughness={0.85} />
        </RoundedBox>
        {/* Door */}
        <mesh position={[0, 0.55, 1.51]}>
          <boxGeometry args={[0.6, 1.1, 0.04]} />
          <meshStandardMaterial color="#7c5a3a" roughness={0.7} />
        </mesh>
        {/* Windows */}
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} position={[x, 0.95, 1.51]}>
            <boxGeometry args={[0.6, 0.6, 0.04]} />
            <meshStandardMaterial
              color="#9fc4d8"
              emissive="#cfe6f0"
              emissiveIntensity={0.2}
              metalness={0.3}
              roughness={0.2}
            />
          </mesh>
        ))}
      </Clickable>

      {/* Back (north) roof slope — not clickable, just geometry. */}
      <mesh
        position={[0, 2.15, -0.75]}
        rotation={[-ROOF_ANGLE, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[4.1, 0.1, 1.85]} />
        <meshStandardMaterial color="#8a5a44" roughness={0.85} />
      </mesh>
      {/* Ridge cap along the top of the two slopes. */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[4.15, 0.1, 0.14]} />
        <meshStandardMaterial color="#5f4d3b" roughness={0.85} />
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
          <meshStandardMaterial color="#d8d3c8" roughness={0.6} metalness={0.2} />
        </RoundedBox>
        <mesh position={[ANCHORS.inverter[0] + 0.13, ANCHORS.inverter[1], ANCHORS.inverter[2]]}>
          <boxGeometry args={[0.02, 0.3, 0.22]} />
          <meshStandardMaterial color="#2f5c8a" emissive="#2f5c8a" emissiveIntensity={0.4} />
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
          <meshStandardMaterial color="#c9c3b6" roughness={0.6} />
        </RoundedBox>
        <mesh
          position={[ANCHORS.meter[0] + 0.12, ANCHORS.meter[1] + 0.05, ANCHORS.meter[2]]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.09, 0.09, 0.03, 24]} />
          <meshStandardMaterial color="#39434d" emissive="#5b8def" emissiveIntensity={0.3} />
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
            <meshStandardMaterial color="#e7e2d7" roughness={0.5} metalness={0.15} />
          </RoundedBox>
          <mesh position={[ANCHORS.battery[0] + 0.15, ANCHORS.battery[1], ANCHORS.battery[2]]}>
            <boxGeometry args={[0.02, 0.4, 0.06]} />
            <meshStandardMaterial color="#9b83f0" emissive="#9b83f0" emissiveIntensity={0.6} />
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
        <meshStandardMaterial color="#6f5b46" roughness={0.9} />
      </mesh>
      {/* Crossarm */}
      <mesh position={[gx, 2.9, gz]} castShadow>
        <boxGeometry args={[0.12, 0.12, 1.4]} />
        <meshStandardMaterial color="#5f4d3b" roughness={0.9} />
      </mesh>
      {/* Transformer */}
      <mesh position={[gx, 2.2, gz + 0.25]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.5, 16]} />
        <meshStandardMaterial color="#8a8578" metalness={0.4} roughness={0.5} />
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
            color="#7d7768"
            lineWidth={1.4}
            transparent
            opacity={0.35}
          />
        )
      })}
      <Line points={FLOW_PATHS.solarToBattery} color="#7d7768" lineWidth={1.4} transparent opacity={0.35} />
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
  const meshes = useRef<(Mesh | null)[]>([])
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
          <mesh
            key={i}
            ref={(el) => {
              meshes.current[i] = el
            }}
            position={[p.x, p.y, p.z]}
          >
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={2.2}
              toneMapped={false}
            />
          </mesh>
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
  })
  return (
    <mesh ref={ref} position={anchor} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.6, 0.03, 12, 40]} />
      <meshStandardMaterial
        color="#f5b445"
        emissive="#f5b445"
        emissiveIntensity={1.6}
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
    anchor[1] + 0.9,
    anchor[2],
  ]
  return (
    <Html position={cardAnchor} center distanceFactor={9} zIndexRange={[40, 0]}>
      <div className="w-56 rounded-lg border border-border bg-card/95 p-3 text-left shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-2">
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
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {info.blurb}
        </p>
      </div>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#c7bfa8" roughness={1} />
      </mesh>
      {/* Grass yard inset */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[6.2, 48]} />
        <meshStandardMaterial color="#a7b481" roughness={1} />
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
      <DayLighting hour={frame.hour} daylight={frame.daylight} />
      <Ground />

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
      dpr={[1, 1.75]}
      camera={{ position: [7.2, 5, 8], fov: 45 }}
      onPointerMissed={() => props.onSelect(null)}
      gl={{ antialias: true }}
    >
      {ready ? <SceneContents {...props} /> : null}
    </Canvas>
  )
}
