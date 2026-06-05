# FOR_ETHAN — The A24 Oracle

## The Story So Far

A conversational “oracle” intake leads into location-guess rounds and a crossword. The UI now tracks **shop.a24films.com** more closely: generous gutters, centered content columns, vector A24 mark in the header, PREORDER-style meta type, still captions **below** photos, and a decorative black footer.

## Cast & Crew (Architecture)

Think of the page like a **single-camera master shot**: `SiteHeader` is the slate at the top, `AppShell` is the dolly track that keeps the action in a centered column, phase components (`OracleChat`, `LocationQuiz`, etc.) are the performers, and `SiteFooter` is the end credits roll — same framing whether the scene is chat or games.

## Behind the Scenes (Decisions)

- **Centered column, left-aligned copy** — Shop product pages feel editorial because the *block* is centered, not because every line is centered. `mx-auto` on `AppShell` does that while keeping prose left-aligned.
- **`a24-meta` vs `a24-caption`** — Grid “PREORDER” / price lines use tiny all-caps gray (`a24-meta`). Location hints use sentence-case italic under the still (`a24-caption`) so we never fight the image with white/black overlays.
- **Footer mockup** — Inert links for visual parity only; keeps the puzzle demo honest without implying a real shop checkout.

## Bloopers (Bugs & Fixes)

- **Hint on stills** — Gradient + white/gray text on photos failed on unpredictable frames (like bad lower-thirds on a documentary). Moved hints to `figcaption` under the image.
- **Footer flush to edge** — A global `* { padding: 0 }` sat *outside* Tailwind’s `@layer`, so it beat `.a24-gutter` in the cascade. Reset moved into `@layer base`; footer uses symmetric `a24-footer-inset` (~20–40px).
- **Gray Mapbox map (pins only)** — [PR #3](https://github.com/mite404/a24-puzzle/pull/3) already proved the map on `main`: simple `location-map.tsx` + `NEXT_PUBLIC_MAPBOX_TOKEN`. The regression on `styling-details` came from layering *more* Mapbox wiring on top — `mapLib`, CSP worker `postinstall`, debug probes, `transpilePackages: ["mapbox-gl"]`. You got logo, zoom, and pins on gray; `NaN LngLat` was usually fallout from a map that never reached `load`, not bad data in `locations.ts`. **Fix:** revert to the PR pattern (plain `<Map mapboxAccessToken mapStyle=…>`), drop worker/debug extras, `bun run dev:clean`. **Not the culprit:** missing files, zero-size container, or quota — style/tile API calls could still return **200** while the canvas stayed blank; a **304** on `_next/.../mapbox-gl.css` is just local bundle cache. Healthy Network tab: `api.mapbox.com` style + lots of `/v4/...vector.pbf` after the quiz reveals the map.

## Director's Commentary

When borrowing a brand’s layout, steal **tokens** (gutter, meta size, footer rhythm) before stealing **components**. One CSS variable (`--a24-meta`) buys consistent “small gray caps” everywhere without re-measuring Figma.

### Location map hover cards (Figma → code)

After the quiz, **Beat 2** is explore mode: hover a nearby pin and a **collapsed card** (346×364, rounded top, still + gradient + neighborhood / film / venue / “more info…”) appears. Click **more info…** and the popup grows to the **expanded card** (518px) with the A24 logo, carousel ticks, and black footer — like a push-in from a wide shot to a close-up on the same set.

- **Component:** `LocationPinCard` in `src/components/games/location-pin-card.tsx`; `LocationMap` only holds hover/expanded state.
- **Assets:** stills from each `FilmLocation.photoUrl`; logo from `/a24-assets/A24-Films-Logo-Vector.png` (no duplicate Figma exports).
- **Data:** optional `venueLabel` on locations (e.g. St. Barts Cathedral); film row uses `getFilmShortTitle()` (drops leading “The”).
- **Carousel:** four segments, first active — UI placeholder until gallery URLs exist in data.
