"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  CameraControls,
  ContactShadows,
  Environment,
  Grid,
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
  DoubleSide,
  type Group,
  type Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
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

// The three art directions the user is comparing.
export type SceneStyle = "clay" | "photoreal" | "holo"

export const SCENE_STYLES: { id: SceneStyle; label: string; hint: string }[] = [
  { id: "clay", label: "Claymation", hint: "Soft matte miniature model" },
  { id: "photoreal", label: "Photoreal", hint: "Lifelike materials & sun" },
  { id: "holo", label: "Hologram", hint: "Glowing digital twin" },
]

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
  sceneStyle: SceneStyle
}

// ---------------------------------------------------------------------------
// Style plumbing: one context so every surface can theme itself without the
// geometry components needing to know which look is active.
// ---------------------------------------------------------------------------

const StyleContext = createContext<SceneStyle>("photoreal")
const useStyle = () => useContext(StyleContext)

const TextureContext = createContext<{
  wall: Texture | null
  roof: Texture | null
  ground: Texture | null
}>({ wall: null, roof: null, ground: null })
const useTextures = () => useContext(TextureContext)

// Themed surface material. Geometry stays identical across styles; only the
// finish changes here:
//  - photoreal: PBR with the real map + environment reflections
//  - clay:      flat matte, no metal, gentle env light (toy model)
//  - holo:      translucent neon shell that blooms (digital twin)
function M({
  color,
  emissive,
  emissiveIntensity,
  roughness = 0.8,
  metalness = 0,
  map,
  neon,
  holoOpacity = 0.32,
  flatShading = false,
  toneMapped = true,
}: {
  color: string
  emissive?: string
  emissiveIntensity?: number
  roughness?: number
  metalness?: number
  /** Which photoreal texture to apply, if any. */
  map?: "wall" | "roof" | "ground"
  /** Neon emissive hue used only in the hologram style. */
  neon?: string
  holoOpacity?: number
  flatShading?: boolean
  toneMapped?: boolean
}) {
  const style = useStyle()
  const tex = useTextures()
  const resolvedMap = map ? tex[map] : null

  if (style === "clay") {
    return (
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissive ? (emissiveIntensity ?? 0.2) * 0.7 : 0}
        roughness={0.98}
        metalness={0}
        envMapIntensity={0.55}
        flatShading={flatShading}
        toneMapped={toneMapped}
      />
    )
  }

  if (style === "holo") {
    return (
      <meshStandardMaterial
        color="#08131f"
        emissive={neon ?? emissive ?? color}
        emissiveIntensity={0.85}
        roughness={0.25}
        metalness={0.1}
        transparent
        opacity={holoOpacity}
        side={DoubleSide}
        toneMapped={toneMapped}
      />
    )
  }

  // photoreal
  return (
    <meshStandardMaterial
      color={color}
      map={resolvedMap ?? undefined}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughness}
      metalness={metalness}
      envMapIntensity={1.15}
      flatShading={flatShading}
      toneMapped={toneMapped}
    />
  )
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
      maxPolarAngle={Math.PI / 2.05}
    />
  )
}

// ---------------------------------------------------------------------------
// Procedural studio environment: gives glass and metal real reflections
// without loading any external HDRI. Baked once (frames={1}).
// ---------------------------------------------------------------------------

function StudioEnvironment({
  daylight,
  style,
}: {
  daylight: number
  style: SceneStyle
}) {
  // The hologram lives in a dark room lit mostly by its own glow, so it gets a
  // dim cool environment; the other two get a warm daylight rig.
  if (style === "holo") {
    return (
      <Environment resolution={256} frames={1} background={false}>
        <Lightformer form="rect" intensity={0.5} color="#2b6cff" position={[5, 5, 2]} scale={[10, 10, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#22d3ee" position={[-6, 3, -4]} scale={[8, 6, 1]} />
      </Environment>
    )
  }

  const warm = style === "clay" ? 1.4 : 2.2
  return (
    <Environment resolution={256} frames={1} background={false}>
      <Lightformer
        form="rect"
        intensity={warm + daylight * 1.4}
        color="#fff0d0"
        position={[5, 6, -2]}
        scale={[8, 6, 1]}
        target={[0, 1, 0]}
      />
      <Lightformer
        form="rect"
        intensity={1.1 + daylight * 0.6}
        color="#cfe2f2"
        position={[0, 8, 3]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[12, 12, 1]}
      />
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
// Lighting that tracks the time of day (and the active style)
// ---------------------------------------------------------------------------

function DayLighting({
  hour,
  daylight,
  style,
}: {
  hour: number
  daylight: number
  style: SceneStyle
}) {
  const a = (Math.PI * (hour - 6)) / 12
  const skySun: [number, number, number] = [
    -Math.cos(a) * 100,
    Math.sin(a) * 100,
    -30,
  ]
  const sunPos = sunPosition(hour) ?? [4, 6, -3]

  if (style === "holo") {
    // No sky; the scene reads against a dark backdrop with cool fill only.
    return (
      <>
        <color attach="background" args={["#050b16"]} />
        <ambientLight intensity={0.35} color="#7fb8ff" />
        <directionalLight position={sunPos} intensity={0.35} color="#8fd3ff" />
        <pointLight position={[0, 3, 4]} intensity={0.6} color="#22d3ee" distance={14} />
      </>
    )
  }

  const clay = style === "clay"
  return (
    <>
      {clay ? (
        <color attach="background" args={["#efe7d6"]} />
      ) : (
        <Sky
          sunPosition={skySun}
          turbidity={6}
          rayleigh={daylight > 0 ? 1.4 : 0.3}
          mieCoefficient={0.006}
          mieDirectionalG={0.85}
        />
      )}
      <hemisphereLight
        intensity={(clay ? 0.55 : 0.3) + 0.3 * daylight}
        color="#fff6e6"
        groundColor={clay ? "#cfc3a0" : "#8f8467"}
      />
      <ambientLight intensity={(clay ? 0.4 : 0.15) + 0.25 * daylight} />
      <directionalLight
        position={sunPos}
        intensity={(clay ? 0.5 : 0.2) + (clay ? 1.0 : 1.6) * daylight}
        color="#fff1d0"
      />
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
          <mesh castShadow>
            <boxGeometry args={[pw, 0.05, ph]} />
            <M color="#c9d2dc" metalness={0.85} roughness={0.35} neon="#37b6ff" />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[pw - 0.05, 0.02, ph - 0.05]} />
            <M
              color="#123456"
              emissive="#2f6fae"
              emissiveIntensity={0.28}
              metalness={0.95}
              roughness={0.12}
              neon="#37b6ff"
              holoOpacity={0.5}
            />
          </mesh>
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
    <group position={[0, 2.15, 0.75]} rotation={[ROOF_ANGLE, 0, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[totalW + 0.24, 0.06, totalH + 0.24]} />
        <M color="#3a4250" metalness={0.5} roughness={0.6} neon="#2b6cff" />
      </mesh>
      {panels}
    </group>
  )
}

function Window({ x, y = 0.95, z = 1.52 }: { x: number; y?: number; z?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[0.74, 0.74, 0.06]} />
        <M color="#efe7d5" roughness={0.7} neon="#38e6ff" />
      </mesh>
      <mesh>
        <boxGeometry args={[0.58, 0.58, 0.04]} />
        <M
          color="#bcdcea"
          emissive="#ffdda0"
          emissiveIntensity={0.3}
          metalness={0.5}
          roughness={0.08}
          neon="#ffd27a"
          holoOpacity={0.55}
        />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.6, 0.03, 0.02]} />
        <M color="#efe7d5" roughness={0.7} neon="#38e6ff" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.03, 0.6, 0.02]} />
        <M color="#efe7d5" roughness={0.7} neon="#38e6ff" />
      </mesh>
      {[-0.42, 0.42].map((sx) => (
        <mesh key={sx} position={[sx, 0, 0]}>
          <boxGeometry args={[0.14, 0.72, 0.04]} />
          <M color="#3f5d52" roughness={0.7} neon="#38e6ff" />
        </mesh>
      ))}
      <mesh position={[0, -0.42, 0.06]}>
        <boxGeometry args={[0.82, 0.06, 0.1]} />
        <M color="#e0d6c0" roughness={0.7} neon="#38e6ff" />
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
          <M color="#f4eada" roughness={0.75} metalness={0.02} map="wall" neon="#38e6ff" holoOpacity={0.22} />
        </RoundedBox>

        {/* Stone foundation course */}
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <boxGeometry args={[4.08, 0.26, 3.08]} />
          <M color="#9c9384" roughness={0.95} neon="#2b6cff" />
        </mesh>

        {/* Corner quoins */}
        {[
          [-1.99, 1.99],
          [1.99, 1.99],
          [-1.99, -1.99],
          [1.99, -1.99],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.85, z]}>
            <boxGeometry args={[0.14, 1.6, 0.14]} />
            <M color="#e6dcc7" roughness={0.8} neon="#38e6ff" />
          </mesh>
        ))}

        {/* Covered entry */}
        <group position={[0, 0, 1.5]}>
          <mesh position={[0, 0.6, 0.02]}>
            <boxGeometry args={[0.66, 1.2, 0.06]} />
            <M color="#5e3d24" roughness={0.55} neon="#ffb454" />
          </mesh>
          <mesh position={[0, 0.6, 0.06]}>
            <boxGeometry args={[0.5, 1.02, 0.02]} />
            <M color="#6f4a2c" roughness={0.5} neon="#ffb454" />
          </mesh>
          <mesh position={[0.2, 0.58, 0.08]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <M color="#e0b452" metalness={0.9} roughness={0.25} neon="#ffe08a" />
          </mesh>
          <mesh position={[0, 1.28, 0.05]}>
            <boxGeometry args={[0.66, 0.18, 0.03]} />
            <M color="#bcdcea" emissive="#ffdda0" emissiveIntensity={0.35} roughness={0.1} metalness={0.4} neon="#ffd27a" holoOpacity={0.55} />
          </mesh>
          <mesh position={[0, 1.5, 0.28]} castShadow>
            <boxGeometry args={[1.1, 0.08, 0.6]} />
            <M color="#5f3d2e" roughness={0.8} neon="#38e6ff" />
          </mesh>
          {[-0.42, 0.42].map((px) => (
            <mesh key={px} position={[px, 0.7, 0.5]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 1.4, 12]} />
              <M color="#efe7d5" roughness={0.7} neon="#38e6ff" />
            </mesh>
          ))}
          <mesh position={[0, 0.03, 0.5]} receiveShadow>
            <boxGeometry args={[1.0, 0.08, 0.5]} />
            <M color="#b7ad98" roughness={0.9} neon="#2b6cff" />
          </mesh>
          <mesh position={[0, 0.1, 0.32]} receiveShadow>
            <boxGeometry args={[0.8, 0.08, 0.3]} />
            <M color="#c2b8a2" roughness={0.9} neon="#2b6cff" />
          </mesh>
        </group>

        <Window x={-1.2} />
        <Window x={1.2} />

        {/* Chimney */}
        <mesh position={[1.3, 2.75, -0.5]} castShadow>
          <boxGeometry args={[0.36, 0.75, 0.36]} />
          <M color="#a8907a" roughness={0.9} neon="#38e6ff" />
        </mesh>
        <mesh position={[1.3, 3.15, -0.5]}>
          <boxGeometry args={[0.44, 0.1, 0.44]} />
          <M color="#8a7461" roughness={0.9} neon="#38e6ff" />
        </mesh>
      </Clickable>

      {/* --- Roof --- */}
      <mesh position={[0, 2.15, 0.78]} rotation={[ROOF_ANGLE, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.12, 2.05]} />
        <M color="#6d4436" roughness={0.9} map="roof" neon="#1f8fff" />
      </mesh>
      <mesh position={[0, 2.15, -0.78]} rotation={[-ROOF_ANGLE, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.12, 2.05]} />
        <M color="#6d4436" roughness={0.9} map="roof" neon="#1f8fff" />
      </mesh>
      <mesh position={[0, 1.83, 1.72]}>
        <boxGeometry args={[4.4, 0.14, 0.06]} />
        <M color="#efe7d5" roughness={0.7} neon="#38e6ff" />
      </mesh>
      {[-2.02, 2.02].map((x) => (
        <mesh key={x} position={[x, 2.15, 0]}>
          <boxGeometry args={[0.06, 0.9, 2.6]} />
          <M color="#e9dfca" roughness={0.8} neon="#38e6ff" />
        </mesh>
      ))}
      <mesh position={[0, 2.64, 0]} castShadow>
        <boxGeometry args={[4.45, 0.14, 0.2]} />
        <M color="#4f3125" roughness={0.85} neon="#1f8fff" />
      </mesh>
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
      <Clickable id="inverter" onSelect={onSelect}>
        <RoundedBox args={[0.24, 0.6, 0.4]} radius={0.04} smoothness={4} position={ANCHORS.inverter} castShadow>
          <M color="#eef1f4" roughness={0.35} metalness={0.35} neon="#38e6ff" />
        </RoundedBox>
        <mesh position={[ANCHORS.inverter[0] + 0.13, ANCHORS.inverter[1], ANCHORS.inverter[2]]}>
          <boxGeometry args={[0.02, 0.3, 0.22]} />
          <meshStandardMaterial color="#2f6fae" emissive="#3f8fd0" emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      </Clickable>

      <Clickable id="meter" onSelect={onSelect}>
        <RoundedBox args={[0.22, 0.4, 0.34]} radius={0.04} smoothness={4} position={ANCHORS.meter} castShadow>
          <M color="#dfdccf" roughness={0.5} metalness={0.2} neon="#38e6ff" />
        </RoundedBox>
        <mesh position={[ANCHORS.meter[0] + 0.12, ANCHORS.meter[1] + 0.05, ANCHORS.meter[2]]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.09, 0.09, 0.03, 24]} />
          <meshStandardMaterial color="#2a323b" emissive="#5b8def" emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </Clickable>

      {hasBattery ? (
        <Clickable id="battery" onSelect={onSelect}>
          <RoundedBox args={[0.28, 0.7, 0.5]} radius={0.05} smoothness={4} position={ANCHORS.battery} castShadow>
            <M color="#f0ece2" roughness={0.35} metalness={0.25} neon="#9b83f0" />
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
      <mesh position={[gx, 1.6, gz]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 3.2, 12]} />
        <M color="#7a6549" roughness={0.85} neon="#38e6ff" />
      </mesh>
      <mesh position={[gx, 2.9, gz]} castShadow>
        <boxGeometry args={[0.12, 0.12, 1.4]} />
        <M color="#5f4d3b" roughness={0.85} neon="#38e6ff" />
      </mesh>
      {[-0.5, 0.5].map((dz) => (
        <mesh key={dz} position={[gx, 3.0, gz + dz]}>
          <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
          <M color="#3a4048" roughness={0.4} metalness={0.3} neon="#5b8def" />
        </mesh>
      ))}
      <mesh position={[gx, 2.2, gz + 0.25]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.5, 16]} />
        <M color="#9a958a" metalness={0.6} roughness={0.4} neon="#5b8def" />
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
        if (key === "solarToBattery" || key === "solarToGrid" || key === "batteryToHome")
          return null
        return (
          <Line key={key} points={FLOW_PATHS[key]} color="#6f6857" lineWidth={1.2} transparent opacity={0.28} />
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
            <mesh>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.6} toneMapped={false} />
            </mesh>
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
      <meshStandardMaterial color="#f5b445" emissive="#f5b445" emissiveIntensity={2.2} toneMapped={false} />
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
  const anchor = id === "sun" ? sunPosition(hour) ?? [4, 6, -3] : ANCHORS[id]
  const cardAnchor: [number, number, number] = [anchor[0], anchor[1] + 0.95, anchor[2]]
  return (
    <Html position={cardAnchor} center distanceFactor={9} zIndexRange={[40, 0]}>
      <div className="w-60 overflow-hidden rounded-xl border border-primary/25 bg-card/95 text-left shadow-xl ring-1 ring-black/5 backdrop-blur-md">
        <div className="flex items-start justify-between gap-2 border-b border-border/70 bg-gradient-to-r from-primary/12 to-transparent px-3 py-2">
          <h4 className="font-serif text-sm font-semibold text-card-foreground">{info.title}</h4>
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
        <p className="px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{info.blurb}</p>
      </div>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Procedural textures (photoreal only)
// ---------------------------------------------------------------------------

function makeWallTexture() {
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#f4eada"
  ctx.fillRect(0, 0, size, size)
  // Broad mottling for stucco.
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.04
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#c9bda0"
    const r = 20 + Math.random() * 90
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Fine grain.
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#8f8467"
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4)
  }
  ctx.globalAlpha = 1
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(2, 1)
  return tex
}

function makeRoofTexture() {
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#6d4436"
  ctx.fillRect(0, 0, size, size)
  const courseH = 34
  const tabW = 46
  for (let y = 0, row = 0; y < size; y += courseH, row++) {
    const offset = (row % 2) * (tabW / 2)
    for (let x = -tabW; x < size; x += tabW) {
      const shade = 0.85 + Math.random() * 0.3
      ctx.fillStyle = `rgb(${Math.round(0x6d * shade)}, ${Math.round(0x44 * shade)}, ${Math.round(0x36 * shade)})`
      ctx.fillRect(x + offset + 1, y + 1, tabW - 2, courseH - 3)
    }
    // Shadow line under each course.
    ctx.fillStyle = "rgba(0,0,0,0.25)"
    ctx.fillRect(0, y + courseH - 3, size, 3)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(3, 2)
  return tex
}

// A painted top-down site plan: mown lawn with subtle mowing stripes, a warm
// flagstone path leading to the front door, and a soft vignette that fades the
// plot into the horizon so there's no hard disc edge.
function makeGroundTexture() {
  const size = 1024
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!

  const g = ctx.createRadialGradient(size / 2, size * 0.46, size * 0.08, size / 2, size / 2, size * 0.52)
  g.addColorStop(0, "#6f8f46")
  g.addColorStop(0.5, "#5f8340")
  g.addColorStop(0.8, "#8a9a5e")
  g.addColorStop(1, "#b9bd94")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

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

  ctx.globalAlpha = 0.05
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#dfeecb" : "#243d16"
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5)
  }
  ctx.globalAlpha = 1

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

  const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.34, size / 2, size / 2, size * 0.5)
  v.addColorStop(0, "rgba(0,0,0,0)")
  v.addColorStop(1, "rgba(196,201,168,0.85)")
  ctx.fillStyle = v
  ctx.fillRect(0, 0, size, size)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

// ---------------------------------------------------------------------------
// Landscaping
// ---------------------------------------------------------------------------

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
        <M color="#6b4a2f" roughness={0.9} neon="#2fbf6f" />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <icosahedronGeometry args={[0.62, 1]} />
        <M color={tint} roughness={0.85} flatShading neon="#2fbf6f" />
      </mesh>
      <mesh position={[0.28, 1.65, 0.1]} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
        <M color="#5c8a44" roughness={0.85} flatShading neon="#2fbf6f" />
      </mesh>
      <mesh position={[-0.26, 1.5, -0.12]} castShadow>
        <icosahedronGeometry args={[0.38, 1]} />
        <M color="#456d34" roughness={0.85} flatShading neon="#2fbf6f" />
      </mesh>
    </group>
  )
}

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
        <M color="#3f6a30" roughness={0.9} flatShading neon="#2fbf6f" />
      </RoundedBox>
    </group>
  )
}

// Neon grid floor for the hologram style.
function GridFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.3, -0.01, 0]}>
        <circleGeometry args={[12, 64]} />
        <meshBasicMaterial color="#040a12" />
      </mesh>
      <Grid
        position={[-0.3, 0.001, 0]}
        args={[24, 24]}
        cellSize={0.6}
        cellThickness={0.6}
        cellColor="#1f6f8f"
        sectionSize={3}
        sectionThickness={1.1}
        sectionColor="#38e6ff"
        fadeDistance={22}
        fadeStrength={1.2}
        infiniteGrid
      />
    </group>
  )
}

function Ground() {
  const style = useStyle()
  const { ground } = useTextures()

  if (style === "holo") return <GridFloor />

  return (
    <group>
      {/* Manicured plot the house sits on. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.3, 0, 0]} receiveShadow>
        <circleGeometry args={[9, 96]} />
        {style === "clay" ? (
          <meshStandardMaterial color="#a7c078" roughness={1} metalness={0} />
        ) : (
          <meshStandardMaterial map={ground ?? undefined} roughness={1} />
        )}
      </mesh>
      {/* Raised soil bed under the foundation planting. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 1.75]} receiveShadow>
        <planeGeometry args={[4.4, 0.9]} />
        <M color="#4a3524" roughness={1} neon="#2fbf6f" />
      </mesh>

      <Hedge position={[-1.35, 0, 1.72]} length={1.4} />
      <Hedge position={[1.35, 0, 1.72]} length={1.4} />

      <Tree position={[3.6, 0, 2.1]} scale={1.15} />
      <Tree position={[4.3, 0, -1.6]} scale={0.9} tint="#557f3f" />
      <Tree position={[-3.9, 0, 2.6]} scale={0.8} tint="#4b7538" />
      <Tree position={[2.2, 0, 3.4]} scale={0.7} tint="#5c8a44" />

      <mesh position={[-4.6, 0.18, 0.6]} castShadow>
        <icosahedronGeometry args={[0.3, 1]} />
        <M color="#4f7a3a" roughness={0.9} flatShading neon="#2fbf6f" />
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
  sceneStyle,
}: SceneProps) {
  // Photoreal textures are the only heavy assets; build them once and share.
  const textures = useMemo(
    () => ({
      wall: makeWallTexture(),
      roof: makeRoofTexture(),
      ground: makeGroundTexture(),
    }),
    [],
  )

  const bloom =
    sceneStyle === "holo"
      ? { intensity: 1.5, threshold: 0.6 }
      : sceneStyle === "clay"
        ? { intensity: 0.45, threshold: 1 }
        : { intensity: 0.85, threshold: 1 }
  const vignette = sceneStyle === "holo" ? 0.62 : sceneStyle === "clay" ? 0.28 : 0.42

  return (
    <StyleContext.Provider value={sceneStyle}>
      <TextureContext.Provider value={textures}>
        <Rig preset={preset} resetKey={resetKey} />
        <StudioEnvironment daylight={frame.daylight} style={sceneStyle} />
        <DayLighting hour={frame.hour} daylight={frame.daylight} style={sceneStyle} />
        <Ground />

        {sceneStyle !== "holo" ? (
          <ContactShadows
            position={[-0.3, 0.03, 0]}
            scale={18}
            far={6}
            blur={2.8}
            opacity={0.32 + frame.daylight * 0.22}
            resolution={1024}
            color="#243d16"
          />
        ) : null}

        <group>
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
              anchor={selected === "sun" ? (sunPosition(frame.hour) ?? [4, 6, -3]) : ANCHORS[selected]}
              reducedMotion={reducedMotion}
            />
            <InfoPopup id={selected} hour={frame.hour} onSelect={onSelect} />
          </>
        ) : null}

        <EffectComposer enableNormalPass={false}>
          <Bloom intensity={bloom.intensity} luminanceThreshold={bloom.threshold} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette eskil={false} offset={0.32} darkness={vignette} />
        </EffectComposer>
      </TextureContext.Provider>
    </StyleContext.Provider>
  )
}

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
