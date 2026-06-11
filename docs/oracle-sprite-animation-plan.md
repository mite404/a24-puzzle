# Oracle Character Sprite Animation — Implementation Plan

**Stack:** React Three Fiber · `@react-three/drei` · Next.js App Router  
**Scope:** Animate PixelLab-generated spritesheets for multiple oracle characters wandering over the A24 background  
**Prerequisites:** Sprite sheets exported from PixelLab (6 frames × 4 directions per character)

---

## Spritesheet Contract

Before writing any code, pin down the exact layout of your exported sheets.
Everything downstream depends on this.

**Expected format from your PixelLab prompt:**

```
Columns:  6  (animation frames, left to right)
Rows:     4  (directions, top to bottom)
Layout:

Row 0 (top)    → facing DOWN  (toward camera)
Row 1          → facing UP    (away from camera)
Row 2          → facing LEFT
Row 3 (bottom) → facing RIGHT
```

> **Verify this before Phase 1.** Open the exported PNG in Figma or Preview,
> draw a grid overlay, and confirm which row maps to which direction. PixelLab
> doesn't guarantee a fixed row order — if your sheet differs, update the
> `DIRECTION_ROW` map in `lib/sprites.ts` accordingly. Everything else stays the same.

**Per-character config that lives in `lib/sprites.ts`:**

```typescript
// lib/sprites.ts
export interface SpritesheetConfig {
  url: string          // path to the PNG
  cols: number         // total columns (animation frames)
  rows: number         // total rows (directions)
  fps: number          // walk cycle playback speed
  scale: number        // world-space size of the character
  directionRow: {
    down: number
    up: number
    left: number
    right: number
  }
}

export const ORACLE_CONFIGS: Record<string, SpritesheetConfig> = {
  oracle_a: {
    url: '/sprites/oracle_a.png',
    cols: 6,
    rows: 4,
    fps: 8,
    scale: 1.2,
    directionRow: { down: 0, up: 1, left: 2, right: 3 },
  },
  oracle_b: {
    url: '/sprites/oracle_b.png',
    cols: 6,
    rows: 4,
    fps: 8,
    scale: 1.2,
    directionRow: { down: 0, up: 1, left: 2, right: 3 },
  },
  oracle_c: {
    url: '/sprites/oracle_c.png',
    cols: 6,
    rows: 4,
    fps: 8,
    scale: 1.2,
    directionRow: { down: 0, up: 1, left: 2, right: 3 },
  },
}
```

---

## Architecture Overview

```
app/page.tsx
└── <OracleScene />               ← R3F Canvas, orthographic camera
    ├── <OracleCharacter />       ← oracle_a, wandering
    ├── <OracleCharacter />       ← oracle_b, wandering
    └── <OracleCharacter />       ← oracle_c, wandering

Hooks (internal to OracleCharacter):
├── useSpriteAnimation()          ← UV offset math, frame cycling
└── useWander()                   ← autonomous movement state machine
```

The A24 canvas background stays as-is (Canvas 2D, `position: absolute`).
The R3F canvas sits on top of it, also `position: absolute`, with
`style={{ background: 'transparent' }}` and `gl={{ alpha: true }}`.
Two independent layers — no need to migrate the background to Three.js.

---

## File Structure

```
components/
  three/
    OracleScene.tsx         ← Canvas wrapper + camera
    OracleCharacter.tsx     ← mesh + animation + movement wired together
    useSpriteAnimation.ts   ← hook: UV offset cycling
    useWander.ts            ← hook: autonomous wandering state machine
lib/
  sprites.ts                ← SpritesheetConfig type + ORACLE_CONFIGS
public/
  sprites/
    oracle_a.png
    oracle_b.png
    oracle_c.png
```

---

## The Non-Obvious Part: UV Math

This is the single trickiest concept in the whole implementation.
Understand this before writing any animation code.

Three.js textures use UV coordinates where `(0, 0)` is **bottom-left**.
Image files have `(0, 0)` at **top-left**. They are Y-flipped relative to
each other.

To show one cell from a spritesheet:

```typescript
// Step 1: tell the texture to only show 1/cols × 1/rows of itself
texture.repeat.set(1 / cols, 1 / rows)

// Step 2: shift to the correct column (X — no flip needed)
texture.offset.x = frameCol / cols

// Step 3: shift to the correct row (Y — MUST account for flip)
// Row 0 in the image is at the TOP → highest UV Y value
// Row 0 in UV space = offset.y = 1 - (1 / rows)
// Row N in UV space = offset.y = 1 - ((N + 1) / rows)
texture.offset.y = 1 - (directionRow + 1) / rows
```

Visual example for a 6×4 sheet, Row 0, Frame 2:

```
Image coordinates (pixels):     UV coordinates:
┌─────────────────────────┐     Y=1.0
│ [0,0][1,0][2,0]...      │ ←── Row 0 top = UV Y = 0.75
│ [0,1][1,1][2,1]...      │     Row 1     = UV Y = 0.5
│ [0,2][1,2][2,2]...      │     Row 2     = UV Y = 0.25
│ [0,3][1,3][2,3]...      │     Row 3     = UV Y = 0.0
└─────────────────────────┘     Y=0.0

Frame 2, Row 0:
  offset.x = 2/6 = 0.333
  offset.y = 1 - (0+1)/4 = 0.75
```

---

## Phase 1 — Static Sprite (1–2 hours)

**Goal:** Get one frame of one character visible on screen.
No animation, no movement. Just confirm the UV math works.

### 1a. Install dependencies

```bash
npm install @react-three/fiber @react-three/drei three
npm install -D @types/three
```

### 1b. OracleScene — Canvas wrapper

```tsx
// components/three/OracleScene.tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { OracleCharacter } from './OracleCharacter'
import { ORACLE_CONFIGS } from '@/lib/sprites'

export function OracleScene() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 50, position: [0, 0, 100], near: 0.1, far: 1000 }}
      style={{ background: 'transparent', position: 'absolute', inset: 0 }}
      gl={{ alpha: true }}
    >
      <OracleCharacter
        config={ORACLE_CONFIGS.oracle_a}
        initialPosition={[0, 0, 0]}
      />
    </Canvas>
  )
}
```

> **`zoom: 50` explained:** With an orthographic camera, `zoom` controls how
> many world units fit in the viewport. `zoom: 50` means 1 world unit = 50px.
> A character with `scale: 1.2` will render at ~60px tall. Adjust until the
> character is the right size relative to your background.

### 1c. OracleCharacter — static single frame

```tsx
// components/three/OracleCharacter.tsx
'use client'

import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { SpritesheetConfig } from '@/lib/sprites'

interface Props {
  config: SpritesheetConfig
  initialPosition: [number, number, number]
}

export function OracleCharacter({ config, initialPosition }: Props) {
  const texture = useTexture(config.url)

  // CRITICAL: NearestFilter prevents pixel art from blurring
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter

  // Show only one cell
  texture.repeat.set(1 / config.cols, 1 / config.rows)

  // Show frame 0, direction 'down' (row 0) as a static test
  texture.offset.x = 0
  texture.offset.y = 1 - (config.directionRow.down + 1) / config.rows

  return (
    <mesh position={initialPosition}>
      <planeGeometry args={[config.scale, config.scale * 1.5]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.1} />
    </mesh>
  )
}
```

> **`alphaTest={0.1}`** discards pixels below 10% opacity, giving you clean
> transparent edges without blending artifacts. If you see a faint border
> around the character, raise this to `0.5`.

**Checkpoint:** Character appears on screen as a single still frame,
no blurring, clean transparent background around them.

---

## Phase 2 — Frame Animation (2–3 hours)

**Goal:** Cycle through walk frames in a loop. Direction is still hardcoded to `down`.

### 2a. useSpriteAnimation hook

```typescript
// components/three/useSpriteAnimation.ts
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpritesheetConfig } from '@/lib/sprites'

type Direction = 'down' | 'up' | 'left' | 'right'

export function useSpriteAnimation(
  texture: THREE.Texture,
  config: SpritesheetConfig,
  direction: Direction,
  isMoving: boolean,
) {
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()
    const interval = 1 / config.fps

    if (!isMoving) {
      // Idle: hold frame 0 of current direction
      frameRef.current = 0
    } else {
      // Advance frame at fps rate
      if (elapsed - lastTimeRef.current >= interval) {
        frameRef.current = (frameRef.current + 1) % config.cols
        lastTimeRef.current = elapsed
      }
    }

    const row = config.directionRow[direction]

    // Apply UV offsets — this is the hot path, runs every frame
    texture.offset.x = frameRef.current / config.cols
    texture.offset.y = 1 - (row + 1) / config.rows
  })
}
```

> **Why `useRef` for frame state instead of `useState`?**
> `useState` triggers a React re-render. `useRef` is mutable without
> re-rendering. Animation state that changes 8 times per second should
> never touch React's reconciler — put it in a ref and mutate it directly
> inside `useFrame`.

### 2b. Wire into OracleCharacter

```tsx
// In OracleCharacter.tsx — replace the static offset with the hook
import { useSpriteAnimation } from './useSpriteAnimation'

export function OracleCharacter({ config, initialPosition }: Props) {
  const texture = useTexture(config.url)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.repeat.set(1 / config.cols, 1 / config.rows)

  // Hardcode for testing — Phase 3 will make this dynamic
  useSpriteAnimation(texture, config, 'down', true)

  return (
    <mesh position={initialPosition}>
      <planeGeometry args={[config.scale, config.scale * 1.5]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.1} />
    </mesh>
  )
}
```

**Checkpoint:** Character walks in place, cycling through all 6 frames of the
`down` row. Axe arm swings naturally. No movement yet.

---

## Phase 3 — Direction-Aware Animation (1–2 hours)

**Goal:** Character faces the direction they're moving.
Still no autonomous wandering — drive movement manually with a hardcoded target.

### 3a. Direction from velocity

```typescript
// Add this utility to lib/sprites.ts or a new lib/direction.ts

type Direction = 'down' | 'up' | 'left' | 'right'

export function velocityToDirection(vx: number, vy: number): Direction {
  // Whichever axis has greater magnitude determines direction
  if (Math.abs(vx) > Math.abs(vy)) {
    return vx > 0 ? 'right' : 'left'
  }
  return vy > 0 ? 'up' : 'down'
}
```

> **Why not diagonals?** Your spritesheet has 4 directional rows, not 8.
> Snapping to the dominant axis gives clean direction switches without needing
> diagonal sprites. This matches how classic RPG sprites handle diagonals.

### 3b. Manual movement test

Before building the full wander system, verify direction-switching works
by driving the character to a hardcoded target:

```tsx
// Temporary test inside OracleCharacter — remove after Phase 3 is verified
const meshRef = useRef<THREE.Mesh>(null)
const posRef = useRef(new THREE.Vector3(...initialPosition))
const target = new THREE.Vector3(3, 0, 0)  // hardcoded target: move right
const speed = 1.5

useFrame((_, delta) => {
  const mesh = meshRef.current
  if (!mesh) return

  const dir = target.clone().sub(posRef.current).normalize()
  posRef.current.addScaledVector(dir, speed * delta)
  mesh.position.copy(posRef.current)

  const facing = velocityToDirection(dir.x, dir.y)
  // Pass facing to useSpriteAnimation — you'll need to make direction stateful
})
```

**Checkpoint:** Character walks rightward, sprite shows the `right` row.
When it reaches the target, movement stops, sprite holds frame 0.

---

## Phase 4 — Autonomous Wandering (2–3 hours)

**Goal:** Each character wanders independently, picking random targets,
pausing at each one, then moving again.

### 4a. useWander hook

```typescript
// components/three/useWander.ts
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { velocityToDirection } from '@/lib/sprites'

type Direction = 'down' | 'up' | 'left' | 'right'
type WanderState = 'idle' | 'moving'

interface WanderOptions {
  bounds: { x: [number, number]; y: [number, number] }  // world-space limits
  speed: number       // world units per second
  idleDuration: [number, number]  // [min, max] seconds to pause at each target
}

interface WanderResult {
  positionRef: React.MutableRefObject<THREE.Vector3>
  direction: Direction
  isMoving: boolean
}

export function useWander(
  initialPosition: [number, number, number],
  options: WanderOptions,
): WanderResult {
  const posRef = useRef(new THREE.Vector3(...initialPosition))
  const targetRef = useRef(new THREE.Vector3(...initialPosition))
  const [wanderState, setWanderState] = useState<WanderState>('idle')
  const [direction, setDirection] = useState<Direction>('down')
  const idleTimerRef = useRef(0)
  const idleDurationRef = useRef(0)

  function pickNewTarget() {
    const { x, y } = options.bounds
    targetRef.current.set(
      x[0] + Math.random() * (x[1] - x[0]),
      y[0] + Math.random() * (y[1] - y[0]),
      0,
    )
  }

  function startIdling(elapsed: number) {
    const [min, max] = options.idleDuration
    idleDurationRef.current = min + Math.random() * (max - min)
    idleTimerRef.current = elapsed
    setWanderState('idle')
  }

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()

    if (wanderState === 'idle') {
      if (elapsed - idleTimerRef.current >= idleDurationRef.current) {
        pickNewTarget()
        setWanderState('moving')
      }
      return
    }

    // Moving state
    const toTarget = targetRef.current.clone().sub(posRef.current)
    const distance = toTarget.length()
    const ARRIVAL_THRESHOLD = 0.1

    if (distance < ARRIVAL_THRESHOLD) {
      posRef.current.copy(targetRef.current)
      startIdling(elapsed)
      return
    }

    const velocity = toTarget.normalize()
    posRef.current.addScaledVector(velocity, options.speed * /* delta */ 0.016)
    setDirection(velocityToDirection(velocity.x, velocity.y))
  })

  return {
    positionRef: posRef,
    direction,
    isMoving: wanderState === 'moving',
  }
}
```

> **`delta` vs fixed `0.016`:** `useFrame` provides `delta` (time since last
> frame) as the second argument. Replace the hardcoded `0.016` with the actual
> `delta` from `useFrame((state, delta) => ...)` for frame-rate-independent
> movement. Shown simplified here for clarity.

### 4b. Wire wander into OracleCharacter

```tsx
export function OracleCharacter({ config, initialPosition, bounds }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useTexture(config.url)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.repeat.set(1 / config.cols, 1 / config.rows)

  const { positionRef, direction, isMoving } = useWander(initialPosition, {
    bounds,
    speed: 1.5,
    idleDuration: [1, 3],
  })

  useSpriteAnimation(texture, config, direction, isMoving)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(positionRef.current)
    }
  })

  return (
    <mesh ref={meshRef} position={initialPosition}>
      <planeGeometry args={[config.scale, config.scale * 1.5]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.1} />
    </mesh>
  )
}
```

**Checkpoint:** Single character wanders the scene, pauses, picks a new
direction, walks again. Sprite row changes correctly to face movement direction.

---

## Phase 5 — Multiple Oracle Characters (1 hour)

**Goal:** All three oracle characters wander simultaneously, each with their
own spritesheet.

This is straightforward once Phase 4 works — each `<OracleCharacter />` has
its own hook instances, so state is fully isolated.

```tsx
// components/three/OracleScene.tsx
const SCENE_BOUNDS = { x: [-8, 8] as [number, number], y: [-5, 5] as [number, number] }

export function OracleScene() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 50, position: [0, 0, 100] }}
      style={{ background: 'transparent', position: 'absolute', inset: 0 }}
      gl={{ alpha: true }}
    >
      <OracleCharacter
        config={ORACLE_CONFIGS.oracle_a}
        initialPosition={[-4, 1, 0]}
        bounds={SCENE_BOUNDS}
      />
      <OracleCharacter
        config={ORACLE_CONFIGS.oracle_b}
        initialPosition={[0, -2, 0]}
        bounds={SCENE_BOUNDS}
      />
      <OracleCharacter
        config={ORACLE_CONFIGS.oracle_c}
        initialPosition={[4, 2, 0]}
        bounds={SCENE_BOUNDS}
      />
    </Canvas>
  )
}
```

> **Depth sorting:** Add a small `z` value based on `y` position to get
> characters to sort correctly when they overlap — lower Y = in front.
> In `useFrame`: `meshRef.current.position.z = -positionRef.current.y * 0.01`

**Checkpoint:** All three characters wander independently, never sharing
state, facing correct directions.

---

## Phase 6 — Canvas Integration (1–2 hours)

**Goal:** R3F layer sits on top of the A24 Canvas 2D background.

The A24 pattern (Canvas 2D) and the oracle scene (R3F/WebGL) are two separate
rendering contexts. Stack them with absolute positioning:

```tsx
// In whatever page/component renders the background
<div style={{ position: 'relative', width: '100%', height: '100vh' }}>

  {/* Layer 1: A24 pattern — your existing canvas */}
  <canvas
    ref={bgCanvasRef}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
  />

  {/* Layer 2: Oracle characters — R3F canvas */}
  <OracleScene />

  {/* Layer 3: Crossword / game UI */}
  <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
    {/* game content */}
  </div>

</div>
```

`OracleScene`'s canvas is already `position: absolute, inset: 0` with
`gl={{ alpha: true }}` and `background: 'transparent'` — so the A24 pattern
shows through wherever there are no sprites.

> **`pointer-events`:** The R3F canvas will intercept mouse events. If you
> need clicks to pass through to game UI layers, add
> `style={{ pointerEvents: 'none' }}` to the R3F canvas (on the `Canvas`
> component via the `style` prop). For grab interactions, remove this.

---

## Known Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| Pixel art is blurry | Three.js default is `LinearFilter` | Set `NearestFilter` on both `magFilter` and `minFilter` |
| Wrong row showing | UV Y is flipped in Three.js | Use `1 - (row + 1) / rows`, not `row / rows` |
| Character stutters at 8fps | `useState` on frame causes re-render | Use `useRef` for frame counter, only set direction with `useState` |
| Texture shows whole sheet | `repeat` not set | `texture.repeat.set(1/cols, 1/rows)` before UV offsets |
| Characters overlap incorrectly | No depth sorting | Update `position.z = -pos.y * 0.01` each frame |
| Alpha fringe around sprite | `alphaTest` too low | Raise `alphaTest` from `0.1` to `0.5` |
| R3F canvas blocks UI clicks | WebGL canvas on top | Add `style={{ pointerEvents: 'none' }}` to `<Canvas>` |
| `useWander` causes re-renders | `useState` for `direction` | Accept 4 re-renders per direction change — only 4 possible values |

---

## Build Order

```
Phase 1 → Static frame visible           (~2h)
Phase 2 → Walk cycle animating           (~2h)  ← most satisfying checkpoint
Phase 3 → Direction-aware row switching  (~1h)
Phase 4 → Autonomous wandering           (~3h)  ← most complex logic
Phase 5 → All three oracles              (~1h)  ← mostly free after Phase 4
Phase 6 → Canvas layer integration       (~1h)
─────────────────────────────────────────────
Total:                                   ~10h
```

Do not skip Phase 1 to jump to Phase 4. The UV math must be verified against
your actual spritesheet before building movement logic on top of it. One wrong
constant in `offset.y` wastes hours of debugging in the wrong layer.
