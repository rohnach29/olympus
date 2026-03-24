# Olympus UI Redesign: The Body Map

## Overview

Complete visual overhaul of Olympus from a standard sidebar + card dashboard to an immersive "Body Map" experience. The dashboard centers on a 3D constellation-style human body rendered with Three.js. Each health domain maps to a body part — click a hotspot to "zoom into" that organ, which becomes the page layout for that domain's data. The result is a health platform where you're literally exploring your own body.

## Design Direction

**Aesthetic**: Obsidian Vitality — deep black canvas (#030305), emerald/teal primary accent, constellation wireframe visuals (glowing dots connected by thin lines), surgical precision, monospace numbers.

**Typography**:
- Display/scores: Outfit (800/900 weight, tight letter-spacing)
- UI text/labels: DM Sans (400-600)
- Numbers/data: JetBrains Mono (500-700)
- All uppercase labels: 9-10px, letter-spacing 2-3px

**Color System**:
- Background: `#030305` (base), `#0c0d12` (raised), `#111218` (surface)
- Borders: `rgba(255,255,255,0.04-0.06)`
- Text: `#e8eaed` (primary), `rgba(148,163,184,0.65)` (secondary), `rgba(148,163,184,0.4)` (tertiary)
- Accent colors per domain:
  - Heart/Cardiovascular: `#ef4444` (red)
  - Sleep/Brain: `#818cf8` (indigo)
  - Recovery/Nervous: `#10b981` (emerald)
  - Nutrition/Gut: `#f59e0b` (amber)
  - Activity/Muscles: `#3b82f6` (blue)
  - Strain: `#fbbf24` (yellow)
  - Blood Work: `#ef4444` (red, shared with heart)
  - Longevity: `#10b981` (emerald, shared with recovery)
  - AI Coach: `#a78bfa` (purple)

**Motion**:
- Page transitions: 3D camera zoom (Three.js) from body → organ (600-800ms, ease-in-out)
- Element entrances: fade-up with stagger (50ms delay per item)
- Hotspot dots: pulsing aura animation (3s infinite)
- Heart hotspot: heartbeat animation (1.2s)
- Organ region glows: slow opacity breathing (4-6s)

## Architecture

### Layout Structure

Every page follows a three-column layout:
```
[Left Panel: 260px] [Center: flex] [Right Panel: 300-320px]
```

- **Left panel**: Context-specific data (vitals on dashboard, stage breakdown on sleep, macros on nutrition), navigation at bottom
- **Center**: The visualization (3D body, brain, stomach, etc.)
- **Right panel**: AI insights feed (dashboard), timeline/trends (sub-pages)

### Navigation

**Primary nav**: Click body part hotspots on the 3D body to navigate to health domains. Each hotspot has a labeled tag showing the current value.

**Fallback nav**: Left panel bottom has icon nav items for all pages. Active page highlighted with domain accent color.

**Back navigation**: Sub-pages show a breadcrumb ("Body Map / Sleep") with back arrow that triggers the reverse zoom animation.

**Command palette** (Cmd+K): Quick navigation and actions overlay. Search pages, log food, log workout, ask coach. Raycast-style with fuzzy search.

Keyboard shortcuts:
- `Cmd+K` / `Ctrl+K`: Open palette
- `Escape`: Close palette
- `↑` / `↓`: Navigate results
- `Enter`: Activate selected result
- `Cmd+1-8`: Direct navigation to pages (1=Dashboard, 2=Nutrition, 3=Workouts, 4=Sleep, 5=Recovery, 6=Blood Work, 7=Longevity, 8=Coach)

### Technology

- **3D rendering**: `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`
- **3D models**: Procedurally generated using Three.js `BufferGeometry` + `Points` + `LineSegments`. The constellation aesthetic (dots at vertices, thin connecting lines) does NOT require pre-made GLTF files — it is built from coordinate arrays defining joint/vertex positions. Each organ visualization is a set of `[x,y,z]` arrays for vertices and edge pairs for connections, defined in TypeScript data files (e.g., `body-vertices.ts`, `brain-vertices.ts`). This avoids external asset dependencies entirely. If higher-fidelity models are desired later, GLTF files can be loaded and their geometry extracted for the wireframe rendering.
- **Camera transitions**: Animated camera position/target using `@react-three/drei`'s `CameraControls` or a custom `useFrame` tween with easing
- **Post-processing**: Bloom effect for glow (via `@react-three/postprocessing` `Bloom` pass), subtle vignette. Bloom disabled when `prefers-reduced-motion` is set.
- **Hotspot rendering**: HTML overlay elements positioned via `drei`'s `Html` component for crisp text at any zoom level
- **All 3D scene components**: `"use client"` leaf components, wrapped in `Suspense` with constellation SVG fallback

### Route Transition Architecture

The cross-route zoom transition is the highest-complexity piece of this design. The solution:

**Single persistent `<Canvas>` in `(dashboard)/layout.tsx`**. The Three.js canvas lives in the layout and does NOT unmount between routes. Each page passes a `sceneTarget` prop (camera position + target + which organ model to show) to a shared `<CameraController>` component. When the route changes:

1. Current page's exit: content panels fade out (200ms)
2. Camera animates to new target position (600ms ease-in-out)
3. Old organ model fades, new organ model fades in (during camera move)
4. New page's content panels fade in (200ms, staggered)

Implementation pattern:
```
(dashboard)/layout.tsx [Server Component]
  ├── <LeftPanel> [Server Component — fetches data, renders vitals/nav]
  ├── <BodyCanvas> [Client Component — persistent Three.js canvas]
  │     ├── <CameraController target={routeTarget} />
  │     ├── <BodyModel visible={isHome} />
  │     ├── <BrainModel visible={isSleep} />
  │     ├── <GutModel visible={isNutrition} />
  │     └── <Particles />
  ├── <RightPanel> [Server Component — fetches data, renders insights]
  └── {children} — page-specific overlay content (if needed)
```

The `<BodyCanvas>` reads the current pathname via `usePathname()` and derives camera target + visible model. Left/Right panels are Server Components that fetch from CockroachDB and pass data as props. The canvas is a client-side leaf node.

### Server Component / Client Component Boundaries

| Component | Type | Rationale |
|---|---|---|
| `(dashboard)/layout.tsx` | Server | Fetches user, passes data down |
| `LeftPanel` / vitals | Server | Fetches metrics from DB |
| `RightPanel` / insights | Server | Fetches AI insights |
| `BodyCanvas` (Three.js) | Client | WebGL requires client |
| `CameraController` | Client | Animation logic |
| `Organ models` | Client | Three.js geometry |
| `Hotspot` (Html overlay) | Client | Interactive |
| `CommandPalette` | Client | Keyboard listener |
| `page.tsx` files | Server | Can fetch, pass to client children |

### Loading & Performance

- 3D geometry is procedural (TypeScript vertex arrays) — no GLTF download needed
- Each organ's vertex data: ~5-15KB of TypeScript
- Fallback: constellation SVG (like the mockup) renders instantly while `<Canvas>` hydrates
- Target: < 3s first meaningful paint, < 1s subsequent navigations
- **Runtime performance target**: 60fps on Apple Silicon / discrete GPU, 30fps minimum on integrated Intel GPU at 1440p
- **Particle budget**: max 300 particles per scene
- **Post-processing**: Bloom pass optional, disabled at `prefers-reduced-motion`
- **`prefers-reduced-motion`**: All animations (pulsing dots, camera zoom, breathing idle, particle flow) replaced with instant/static states. Camera transitions become instant cuts. This is a hard requirement for accessibility.

### Responsive Strategy

This release is **desktop-first** (minimum viewport: 1280px). The three-column layout requires sufficient width for the 3D visualization to be meaningful.

- **1280px+**: Full three-column layout as designed
- **768-1279px**: Left panel collapses to icon-only (56px), right panel becomes a slide-out drawer. Center gets more space.
- **< 768px (mobile)**: Deferred to a future release. Mobile users see a simplified card-based layout without 3D (using the constellation SVG fallback as a static hero image). Full mobile design is out of scope for this spec.

## Page Specifications

### 1. Dashboard (Body Map)

**Center**: 3D constellation human body
- Wireframe/point-cloud rendering: vertices as glowing dots, edges as thin lines
- Subtle idle animation: slow breathing motion (scale Y oscillation)
- Mouse interaction: drag to rotate (constrained), hover hotspots to highlight
- Post-processing: bloom on vertices, subtle ambient occlusion

**Hotspots** (6 interactive points on the body):
| Hotspot | Position | Color | Label | Click Target |
|---|---|---|---|---|
| Brain | Head | `#818cf8` | Sleep + score | `/sleep` |
| Heart | Chest-left | `#ef4444` | Heart + HR bpm | `/recovery?focus=cardiac` |
| Gut | Abdomen | `#f59e0b` | Nutrition + kcal | `/nutrition` |
| Spine | Back/core | `#10b981` | Recovery + score | `/recovery` |
| Muscles | Arms/shoulders | `#fbbf24` | Strain + value | `/workouts` |
| Legs | Thighs | `#3b82f6` | Activity + steps | `/workouts?focus=activity` |

When navigating with `?focus=` params, the target page scrolls/highlights the relevant section and the camera targets the corresponding sub-region of the organ model.

Each hotspot renders:
- Glowing dot with pulsing aura rings
- Connector line (gradient from dot color to transparent)
- Glass-morphism tag with icon + label + value

**Readiness score**: Centered above the body, large Outfit 800 weight, text-shadow glow, with "Ready to train" pill badge.

**Left panel**:
- Logo (Olympus + gradient icon)
- Vitals grouped by system (Cardiovascular, Metabolic, Recovery)
- Each vital: animated pulse dot + name + monospace value + trend badge
- Bottom: Settings + Sign out nav items

**Right panel**:
- "AI Insights — Live" header with pulsing green dot
- Insight cards with color-coded category tags (Recovery Analysis, Nutrition Alert, Sleep Optimization, Cardiovascular, Activity)
- Each insight: tag + paragraph text with bold highlights + timestamp
- Bottom: Quick action pills (Log Food, Log Workout, Ask Coach)

### 2. Sleep Page (Brain)

**Transition**: Camera zooms from body into head region. Body fades, brain constellation grows to fill center.

**Center**: 3D constellation brain
- Brain regions visible: frontal lobe, temporal lobe, parietal lobe, occipital lobe, cerebellum, brain stem
- Each region has a subtle glow zone colored by sleep stage:
  - Frontal: Deep Sleep (`#6366f1`) — memory consolidation
  - Temporal/Parietal: REM (`#a78bfa`) — emotional processing
  - Central/Thalamus: Core Sleep (`#818cf8`) — neural maintenance
  - Cerebellum: Motor Recovery
- Region labels: glass cards with stage name, duration, percentage, function description
- Glow zones pulse slowly (4-6s) to indicate brain activity during sleep

**Left panel**:
- Back breadcrumb: "Body Map / Sleep"
- Last Night's Sleep: stat grid (duration, efficiency, bedtime, wake time)
- Sleep Stages: color-coded stage cards with:
  - Colored bar indicator
  - Stage name, duration, percentage
  - Progress bar showing proportion
- Biometrics During Sleep: avg HR, HRV during sleep
- Bottom nav: Dashboard, Sleep (active), Recovery

**Right panel**:
- Sleep Timeline: vertical timeline with colored dots showing stage transitions through the night (10:42 PM fell asleep → 6:24 AM woke up)
- 7-Day Sleep Scores: bar chart with today highlighted
- AI Sleep Insight card

### 3. Nutrition Page (Gut/Digestive System)

**Transition**: Camera zooms from body into abdomen. Digestive system constellation appears.

**Center**: 3D constellation digestive system (esophagus → stomach → intestines)
- Animated particles flowing through the digestive tract representing nutrients
- Particle colors: protein (blue), carbs (amber), fat (purple)
- Flow speed/density reflects current intake
- Stomach region shows meal breakdown
- Region labels: macro values at key points in the digestive tract

**Left panel**:
- Back breadcrumb: "Body Map / Nutrition"
- Daily totals: calories, protein, carbs, fat with progress bars toward goals
- Meal log by time: Breakfast, Lunch, Dinner, Snack sections
- Each meal: food items with calorie/macro values
- Goal setup access
- Bottom nav

**Right panel**:
- Macro split donut/ring visualization
- Recent foods quick-add
- Weekly calorie trend
- AI Nutrition insight (protein gap alert, etc.)

### 4. Workouts Page (Muscles/Skeleton)

**Transition**: Camera zooms into shoulder/torso muscle region.

**Center**: 3D constellation muscular system
- Major muscle groups visible: chest, back, shoulders, arms, core, legs
- Each muscle group glows based on recent strain (brighter = more strain)
- Click a muscle group to see workout history for that area
- Rest days: muscles dim, recovery glow

**Left panel**:
- Back breadcrumb: "Body Map / Workouts"
- Today's strain score + strain gauge
- Recent workouts list: name, duration, type, calories
- Log workout button
- Bottom nav

**Right panel**:
- Muscle group strain breakdown
- Weekly activity bar chart
- Workout streak / consistency
- AI training recommendation

### 5. Recovery Page (Spine/Nervous System)

**Transition**: Camera zooms into spine/core region.

**Center**: 3D constellation nervous system (spine + branching nerve pathways)
- Nerve pathways pulse with activity representing parasympathetic/sympathetic balance
- Green pulses = parasympathetic (recovery)
- Red/amber pulses = sympathetic (stress)
- Spine vertebrae as constellation nodes

**Left panel**:
- Back breadcrumb: "Body Map / Recovery"
- Recovery score + readiness
- HRV trend (current vs baseline)
- Resting HR trend
- Recovery factors breakdown (sleep contribution, activity contribution, stress)
- Bottom nav

**Right panel**:
- 7-day recovery trend
- HRV vs RHR correlation chart
- Recovery timeline (when you were most/least recovered)
- AI Recovery insight

### 6. Blood Work Page (Circulatory System)

**Transition**: Camera zooms into arm/vein region.

**Center**: 3D constellation circulatory system (veins + arteries branching)
- Biomarker nodes positioned along the circulatory network
- Each node: biomarker name + value + range indicator (green/yellow/red)
- Blood cell particles flowing through vessels
- Node size reflects how far from optimal range

**Left panel**:
- Back breadcrumb: "Body Map / Blood Work"
- Most recent panel date
- Biomarker list grouped by category (Lipids, Metabolic, Hormones, Vitamins)
- Each biomarker: name, value, unit, range status indicator
- Upload new results button
- Bottom nav

**Right panel**:
- Out-of-range biomarkers highlighted
- Trend charts for key markers (past 3-6 panels)
- AI Blood Work insight (correlations, recommendations)

### 7. Longevity Page (Full Body — Zoomed Out)

**Transition**: Camera pulls back to show full body with vitality heat map overlay.

**Center**: 3D body with vitality overlay
- Body colored by system health: green (optimal) → yellow (moderate) → red (needs attention)
- Overall longevity score centered
- Biological age vs chronological age comparison

**Left panel**:
- Longevity score breakdown
- Biological age estimate
- Key longevity factors (sleep consistency, VO2max estimate, inflammation markers)
- Active protocols list
- Bottom nav

**Right panel**:
- Longevity trend over months
- Factor contribution breakdown
- AI Longevity insight

### 8. AI Coach Page (Chat Overlay)

**No zoom transition** — the chat interface overlays on top of the body map.

**Layout**: The three-column layout shifts:
- Left panel: remains as-is (vitals + nav), Sleep/Recovery/Nutrition nav items highlighted when coach references them
- Center: Body remains visible but dimmed to 30% opacity, hotspots non-interactive
- Right panel: expands from 320px to ~500px, becomes the chat interface

**Chat interface**:
- Message history: scrollable, newest at bottom
- User messages: right-aligned, glass card with emerald border
- AI messages: left-aligned, glass card, markdown rendered (bold, lists, code blocks)
- When AI mentions a health domain (e.g., "your sleep"), the corresponding body hotspot briefly pulses/glows (2s animation)
- Quick suggestion chips above input: "How's my recovery?", "What should I eat?", "Analyze my sleep", "Workout recommendation"
- Input: full-width text field with send button, `Enter` to send, `Shift+Enter` for newline
- Loading state: three pulsing dots animation while AI responds
- No separate chat history sidebar — single conversation thread, cleared on new session

### 9. Settings Page (Standard Layout)

**No zoom** — clean settings UI without 3D visualization. Body canvas shows a dimmed, static body at rest.

**Left panel**: Navigation only (same nav as all pages)
**Center + Right merged**: Full-width settings form with glass card sections

Keeps existing settings page structure and functionality, restyled with:
- Glass card sections for each settings group
- DM Sans typography, JetBrains Mono for values
- Input/select components use existing Radix/Shadcn primitives, restyled with new dark theme colors
- Sections: Profile (name, email), Timezone, Integrations (Apple Health status + connect), Nutrition Goals, Notification Preferences

## Auth Pages (Login/Signup)

**Design**: Full-screen dark background with a slowly rotating, dimly-lit constellation body in the background (no interaction, `prefers-reduced-motion`: static). Login card centered with glass-morphism treatment.

Keeps existing auth page functionality (form logic, API calls, error handling, routing). Only visual changes:
- Background: `#030305` with constellation body SVG (static fallback) or 3D body (if JS loaded), dimmed to 15% opacity
- Subtle particle field drifting behind the card
- Card: glass-morphism (`rgba(255,255,255,0.03)`, `backdrop-filter: blur(24px)`, border `rgba(255,255,255,0.06)`)
- Logo: Olympus icon + text, centered above card
- Heading: "Welcome to Olympus" in Outfit 700
- Fields: restyled Input components (dark background, subtle border)
- Button: emerald gradient, white text, glow shadow
- Link: "Don't have an account? Sign up" / "Already have an account? Sign in"
- Error state: red-tinted glass card for error messages

## CSS Strategy

All design tokens (colors, radii, opacity values) are defined as CSS custom properties in `globals.css` within the `:root` / `.dark` scope, following the existing pattern. Glassmorphism values (`rgba` backgrounds, `backdrop-filter`, border opacities) are defined as Tailwind CSS 4 theme extensions in `globals.css` using `@theme inline {}`, not as inline `style` props. This ensures consistency and allows Tailwind utility classes like `bg-card`, `border-border` to carry the new aesthetic.

## Shared Components

### Card
- `background: rgba(255,255,255,0.02-0.03)`
- `border: 1px solid rgba(255,255,255,0.04-0.06)`
- `backdrop-filter: blur(12px)`
- `border-radius: 12-16px`
- Hover: border brightens, subtle scale(1.01)

### Button
- Primary: emerald gradient (`#10b981` → `#059669`), white text, glow shadow
- Outline: transparent bg, rgba white border, hover brightens
- Ghost: no border, hover bg appears
- Quick action pills: rounded-full, small, outline style with colored icon

### Progress Bar
- Track: `rgba(255,255,255,0.04-0.06)`, 3-4px height, rounded
- Fill: gradient matching domain color

### Score Ring (kept for sub-components)
- SVG-based, gradient stroke, glow drop-shadow
- Monospace score in center

### Command Palette (Cmd+K)
- Centered overlay, glass-morphism background
- Search input with icon
- Results list with icons, labels, hints, keyboard shortcuts
- Footer with navigation hints

## Font Loading

```tsx
// app/layout.tsx
import { Outfit, DM_Sans, JetBrains_Mono } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-display' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
```

## New Dependencies

```json
{
  "@react-three/fiber": "^9.x",
  "@react-three/drei": "^10.x",
  "@react-three/postprocessing": "^3.x",
  "three": "^0.172.x",
  "@types/three": "^0.172.x"
}
```

Note: Verify peer dependency compatibility between `@react-three/fiber` and `three` at install time. Use the latest stable versions that are mutually compatible.

## File Structure (New/Modified)

```
src/
├── components/
│   ├── body-map/
│   │   ├── body-scene.tsx          # Main Three.js scene with body model
│   │   ├── body-model.tsx          # 3D body wireframe/constellation
│   │   ├── hotspot.tsx             # Interactive hotspot with label
│   │   ├── camera-controller.tsx   # Zoom transition camera logic
│   │   ├── particles.tsx           # Background particle field
│   │   └── loading-fallback.tsx    # SVG constellation fallback
│   ├── organs/
│   │   ├── brain-scene.tsx         # Sleep page brain visualization
│   │   ├── gut-scene.tsx           # Nutrition page digestive viz
│   │   ├── muscle-scene.tsx        # Workouts page muscle viz
│   │   ├── spine-scene.tsx         # Recovery page nervous system
│   │   ├── circulatory-scene.tsx   # Blood work page veins
│   │   └── vitality-scene.tsx      # Longevity page body heat map
│   ├── dashboard/
│   │   ├── sidebar.tsx             # Redesigned left panel
│   │   ├── header.tsx              # REMOVED — greeting moved into left panel, avatar into top-right of layout
│   │   ├── ai-insights-panel.tsx   # Right panel AI feed (NEW)
│   │   ├── vitals-panel.tsx        # Left panel vitals list (NEW — replaces metric-card usage in page.tsx)
│   │   ├── score-ring.tsx          # Kept, restyled
│   │   ├── metric-card.tsx         # REMOVED — replaced by vitals-panel.tsx. Currently used only in (dashboard)/page.tsx.
│   │   └── quick-actions.tsx       # Restyled as pill buttons, moved to right panel bottom
│   ├── command-palette/
│   │   ├── command-palette.tsx     # Cmd+K overlay
│   │   └── command-item.tsx        # Search result item
│   └── ui/
│       ├── card.tsx                # Restyled glass card
│       ├── button.tsx              # Restyled with new variants
│       ├── progress.tsx            # Restyled thin bars
│       └── ... (existing kept)
├── app/
│   ├── globals.css                 # Complete retheme
│   ├── layout.tsx                  # New fonts, updated theme
│   ├── (auth)/
│   │   ├── layout.tsx              # Background body constellation
│   │   ├── login/page.tsx          # Restyled
│   │   └── signup/page.tsx         # Restyled
│   └── (dashboard)/
│       ├── layout.tsx              # Three-column layout, no header bar
│       ├── page.tsx                # Body map dashboard
│       ├── sleep/page.tsx          # Brain visualization
│       ├── nutrition/page.tsx      # Gut visualization
│       ├── workouts/page.tsx       # Muscle visualization
│       ├── recovery/page.tsx       # Spine/nervous visualization
│       ├── blood-work/page.tsx     # Circulatory visualization
│       ├── longevity/page.tsx      # Full body vitality
│       ├── coach/page.tsx          # Chat overlay on body
│       └── settings/page.tsx       # Standard settings
└── public/
    └── models/
        ├── body.glb                # Low-poly human body
        ├── brain.glb               # Brain model
        ├── digestive.glb           # Digestive system
        ├── muscles.glb             # Muscle groups
        ├── spine.glb               # Spine + nerves
        ├── circulatory.glb         # Veins/arteries
        └── ...
```

## Migration Notes

- All existing data-fetching logic (API routes, DB queries) stays unchanged for existing pages
- Only UI layer changes — components, layouts, styles
- **Longevity page data**: Longevity score, biological age, and VO2max estimates are computed client-side from existing metrics (sleep consistency, HRV trends, resting HR, activity levels, blood work results). No new DB schema or API routes needed — the computation logic lives in `src/lib/utils/longevity-scoring.ts` which already exists. Inflammation markers come from blood work results already stored in the DB.
- Existing Shadcn/Radix components (Dialog, Tabs, Select, Toast) kept and restyled
- Score ring component kept but restyled to match new aesthetic
- Recharts usage can stay for charts or be replaced with custom SVG
- No database schema changes
- No API changes
