# Codebase Audit — Prioritized Findings

> Audited at commit `cf30f23` (2026-07-08), standard depth.
> Method: recon + three parallel audit passes (correctness/security, performance/architecture,
> tests/DX/deps/docs), every finding re-verified against the cited source before inclusion.
> Baseline: `bun test` 22/22 pass (4 files), `bunx tsc --noEmit` clean,
> `bun run lint` **fails** (12 errors, 4 warnings).
> Not audited: `public/` assets, `scripts/`, `.agents/`, doc prose depth,
> dependency CVE scan (`bun audit` not run).

## How to read this

Priorities are leverage-ordered (impact ÷ effort, weighted by confidence).
P0 blocks a safe public deploy. P1 is cheap and high-value.
P2 is worthwhile refactor/test work. P3 is hygiene.
Effort: S (< half day), M (1–2 days), L (multi-day).

---

## P0 — Before any public deploy

### 1. Unauthenticated API routes spend paid third-party credits (SEC-01)

- **Evidence**: all six routes under `src/app/api/` — `chat/route.ts:62`,
  `oracle-quip/route.ts:72`, `voice/route.ts:50`, `crossword/regenerate/route.ts:52`,
  `valence/route.ts:26`, and `scribe-token/route.ts:35` where `requireScribeAccess()` is an
  explicit no-op stub with a "harden before public deploy" TODO.
  No `middleware.ts`, no rate limiting anywhere in `src/`.
- **Impact**: any anonymous client can loop these endpoints and run up
  OpenRouter + ElevenLabs + Valence bills (financial DoS).
  The scribe route additionally mints usable single-use STT tokens for anyone.
- **Fix**: one `assertApiAccess(req)` helper (origin/Referer allowlist + per-IP rate limit)
  called at the top of every route; wire the `requireScribeAccess` stub to it.
- Effort: M · Risk: low · Confidence: high.

### 2. `/api/valence` buffers an unbounded request body (SEC-02)

- **Evidence**: `src/app/api/valence/route.ts:5-18` reads the whole body with no size cap;
  `src/lib/valence.ts` then writes it to a tmp file.
- **Impact**: memory/disk exhaustion DoS; compounds finding 1.
- **Fix**: reject over a few MB via `Content-Length` check + post-read cap
  (legit clips are < 1 MB).
- Effort: S · Risk: low · Confidence: high.

### 3. Malformed WAV throws an unhandled `RangeError` (BUG-01)

- **Evidence**: `src/lib/valence.ts:83-87` reads `fmt` chunk fields at fixed offsets without
  verifying the chunk fits in the buffer; the loop guard only covers the 8-byte chunk header.
  `src/app/api/valence/route.ts:38` calls `analyzeDiscreteWav` outside any try/catch.
- **Impact**: a truncated WAV turns the fail-open (`null`) endpoint into a 500 —
  a cheap crash vector on an unauthenticated route.
- **Fix**: bounds-check chunk reads in `parseWavPcm`; wrap the route's analyze call to coerce
  any throw to `Response.json(null)`. Add a truncated-fmt unit test.
- Effort: S · Risk: low · Confidence: high (throw path verified by reading the parser).

---

## P1 — Cheap, high leverage

### 4. No CI gate; lint is already red (DX-01, TEST-05)

- **Evidence**: `.github/workflows/` has only `react-doctor.yml`; nothing runs
  tsc/eslint/tests. `bun run lint` fails with 12 errors today
  (unused vars, `import type`, `set-state-in-effect`).
- **Fix**: fix the 12 lint errors, add a `verify` script (`tsc --noEmit` + `eslint` +
  `bun test`), and a `ci.yml` running it on PR + push.
- Effort: S · Risk: low · Confidence: high.

### 5. Core crossword logic untested + pre-1.0 dep unpinned (TEST-02, DEP-02)

- **Evidence**: `src/lib/game.ts` (`buildGamePayload`, `pickAlternateCrosswordIds`,
  `rebuildCrosswordPayload`) has no tests; it wraps `crossword-layout-generator@^0.1.1` —
  a caret range on a 0.1.x package with hand-rolled local types
  (`src/types/crossword-layout-generator.d.ts`).
- **Impact**: the feature the repo exists for has no regression net, and any `0.1.x` publish
  auto-installs with no type contract to catch breakage.
- **Fix**: characterization tests pinning current payloads, then pin exact versions for
  `crossword-layout-generator` and `valenceai`.
- Effort: S–M · Risk: low · Confidence: high.

### 6. mapbox-gl ships in the initial bundle (PERF-01)

- **Evidence**: static imports in `src/components/games/location-map.tsx:4-10` →
  `location-quiz.tsx:10` → `experience.tsx:27`; no `next/dynamic` anywhere.
- **Impact**: ~230 KB gzip of map JS + CSS loads on the landing/intake screen,
  which never renders a map.
- **Fix**: `next/dynamic(..., { ssr: false })` around `LocationMap` with a light fallback.
- Effort: S · Risk: low · Confidence: high.

### 7. Client-controlled `voiceId` passthrough with no caller (SEC-03)

- **Evidence**: `src/app/api/voice/route.ts:80` uses an arbitrary body `voiceId` verbatim;
  grep shows **no client code ever sends one** — every caller resolves via persona.
- **Impact**: anyone can synthesize with any voice on the account;
  the capability is dead code.
- **Fix**: delete the `voiceId` branch; always resolve from validated `personaId`.
- Effort: S · Risk: none (unused) · Confidence: high.

### 8. `fanTier()` has zero threshold tests (TEST-03)

- **Evidence**: `src/lib/scoring.ts:26` — the user-facing end-screen tier;
  `scoring.test.ts` only covers `scoreQuipTier`.
- **Fix**: boundary tests at 0.4 / 0.65 / 0.9 mirroring the existing table.
- Effort: S · Risk: low · Confidence: high.

---

## P2 — Worthwhile structural work

### 9. API route handlers have zero tests (TEST-01)

All six handlers (646 lines total; `chat/route.ts` is the most-churned backend file) are
untested at the request/response level.
Add handler tests with mocked upstreams; assert status codes and error branches.
Effort: M · Risk: low · Confidence: high.

### 10. Persona definition smeared across 5+ parallel tables (ARCH-01)

`oracle-personas.ts`, `crossword-oracle-quips.ts`, `oracle-score-quips.ts`,
`oracle-voice-settings.ts`, and `oracle-vocal-context.ts` each hold a
`Record<OraclePersonaId, …>`.
The union type catches missing keys, but adding a persona is a five-file archaeology task.
Consolidate into one registry per persona and derive the tables.
Effort: M · Risk: medium (voice/quip hot paths — lean on existing tests + finding 5) ·
Confidence: high.

### 11. Persona shared via mutable module singleton read during render (ARCH-02)

`src/lib/oracle-chat-persona.ts:11` module-level `let`, written by `oracle-tv-scene.tsx:87`,
read during render in `crossword-with-oracle.tsx:24`.
Impure render read; debug phase-jumps silently get the default persona.
The comment documents why (stable chat transport identity) — preserve that via a ref inside
`use-oracle-chat` while lifting persona into `Experience` state.
Effort: S–M · Risk: medium · Confidence: high.

### 12. Duplicated message-text helper (ARCH-03)

`tv-oracle-feed.tsx:90` and `use-oracle-voice.ts:10` are byte-identical.
Export one helper next to `OracleUIMessage` in `oracle-tools.ts`.
Effort: S · Risk: low · Confidence: high.

### 13. TTS can speak with the wrong turn's vocal emotion (BUG-02)

`src/hooks/use-oracle-voice.ts:87-98` reads live `vocalEmotion` props in the speak effect,
so a racing update can apply the previous turn's emotion.
Capture emotion per message id at submit time.
Effort: S · Risk: low · Confidence: medium (timing-dependent).

### 14. No security headers / CSP (SEC-04)

`next.config.ts` is empty; the app renders LLM output and runs an audio-worklet pipeline.
Add baseline CSP + `X-Content-Type-Options` + `Referrer-Policy`; test `blob:`/worker sources
against the worklet before shipping.
Effort: S · Risk: medium (CSP can break worklet/audio) · Confidence: medium.

---

## P3 — Hygiene

| #  | Finding                                          | Evidence                        | Fix                            |
|----|--------------------------------------------------|---------------------------------|--------------------------------|
| 15 | `shadcn` CLI in prod deps, never imported        | `package.json`                  | devDeps or `bunx shadcn`       |
| 16 | README is create-next-app boilerplate; says npm/pnpm, contradicting bun mandate | `README.md` vs `AGENTS.md` | rewrite with bun + env setup |
| 17 | `package.json` still named `my-app`              | `package.json:2`                | rename `a24-puzzle`            |
| 18 | `OPENROUTER_MODEL` read but absent from example  | `src/app/api/chat/route.ts:29`  | add to `.env.example`          |
| 19 | Prototype HTML tracked at repo root              | `a24_superfan_crossword_v2.html`| move to `docs/` or delete      |
| 20 | ~9 large `docs/*-plan.md` files with no index    | `docs/`                         | `docs/README.md` + status tags |
| 21 | AGENTS.md asserts `CONTEXT.md` + `docs/adr/` exist; they don't | `AGENTS.md`       | reword to "if present"         |

## Lower-priority / watch items

- **Crossword full-grid re-render per keystroke** (`crossword.tsx:350-411`):
  bounded churn on a single grid; only worth a memoized `Cell` if larger grids or
  low-end jank appear.
  Risk of desyncing the intricate focus logic outweighs the win today.
- **Static data catalog bundled client-side** (`src/data/*`): small now; it's the growth
  vector — keep prompt-building data server-side as the catalog grows.
- **`console.log` global swap in `buildCrosswordLayout`** (`game.ts:35-42`): safe while
  client-only and synchronous; latent hazard if ever called from shared server code.
  Prefer a generator quiet flag if upstream adds one.
- **Prompt injection into the oracle**: contained by design — no secrets in the prompt,
  all privileged effects (palette ids, profiles, crossword ids) re-validated server-side.
  Optionally add an injection-resistance clause to `buildSystemPrompt`.
- **`mergeArrayBuffers` fragility** (`scribe-audio-tap.ts:28-37`): correct today;
  assert `byteLength === total` if audio corruption is ever reported.

## Considered and rejected

- `tsconfig.tsbuildinfo` committed — false; it's gitignored and untracked.
- Missing `CONTEXT.md`/`docs/adr/` as a broken pointer — `docs/agents/domain.md` explicitly
  says to proceed silently; only the AGENTS.md wording (item 21) remains.
- Unifying `oracle-quip`'s raw REST call with the AI SDK — documented in-code as intentional
  (Kimi `reasoning.effort` passthrough bug).
- `.env.local` present on disk — correctly gitignored, never tracked; no secrets committed or
  leaked to the client (verified).
- `FOR_ETHAN.md` size — mandated by AGENTS.md.

---

## Direction (product options, not ranked against the bugs)

1. **Location photo carousel** — the roadmap (`docs/remaining-features-plan.md`) already
   specs it: `photoUrls[]` + ~40 lines of slide logic against the existing placeholder dots
   in `location-pin-card.tsx`. Estimated 1–2 h, no new deps.
   Highest polish-per-hour on the explore phase.
2. **Push-to-talk STT on the TV bezel** — listed as the roadmap's optional item;
   the scribe pipeline and `sendMessage` seam already exist, so this is wiring, not building.
   Deepens the "talk to the oracle" differentiator the architecture doc calls the core bet.
3. **Persistence (favorites/transcripts) + auth** — the roadmap explicitly defers this
   ("Better Auth / Supabase Auth when favorites matter"). Still the right call:
   nothing on the current roadmap needs a database. Revisit only if favoriting ships.

## Suggested execution order

1 → 2 → 3 (deploy blockers, ship together) → 4 (CI so nothing regresses) →
5 (tests before any refactor) → 6, 7, 8 → then P2,
where 5's characterization tests must land **before** 10 and 11.
