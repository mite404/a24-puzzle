# Styling standards — A24 Oracle

Reference: [On Location in New York City](https://shop.a24films.com/products/on-location-in-new-york-city) on shop.a24films.com.

## Typography

| Role | Font | Class | Notes |
|------|------|-------|--------|
| UI / body | **Archivo** (stand-in for NB International Web) | `font-sans` | 1.1rem, line-height 1.19, tracking −0.01em |
| Page title | Archivo bold | `a24-title` | clamp(3.5rem → 5.775rem), tracking −0.055em |
| Labels | Archivo semibold caps | `a24-eyebrow` | 0.756rem, tracking 0.04em |
| Copy column | — | `a24-prose` | max-width 29.7rem (shop description measure) |

## Layout (from shop product hero)

| Token | Value |
|-------|--------|
| `--a24-gutter-start` | clamp(1.46rem, **6vw**, 7.2rem) |
| `--a24-gutter-end` | clamp(0.73rem, **3vw**, 3.6rem) |
| `--a24-hero-pad-top` | clamp(6.75rem, 10vw, 11.6rem) |
| `--a24-hero-pad-bottom` | clamp(2.2rem, 3vw, 2.75rem) |

- Apply gutters with `a24-gutter` on `SiteHeader`, `AppShell`, and full-bleed sections.
- Intake is **left-aligned** in a copy column (`max-w-[45.6rem]`), not centered in the page.
- Hero phases use `a24-hero-pad` for top spacing below the header.

## Color & chrome

- Background: `#f1f1f1` (`--background`)
- Text / rules / borders: black (`--foreground`, `--border`)
- CTAs: `a24-cta` — square corners, 1px black border, uppercase, generous vertical padding (shop “Preorder” button)
- No `dark` class on `<html>`; experience matches the shop’s light editorial layout.

## shadcn

- Preset: `b5LCAabYm` — re-apply with  
  `bunx shadcn@latest init --preset b5LCAabYm --force --yes --no-reinstall`
- `--radius: 0` globally; prefer `a24-cta` for primary actions instead of default filled pills.

## Components

- `SiteHeader` — thin top bar + eyebrow labels
- `AppShell` — gutters + optional hero padding
- Add UI via `bunx shadcn@latest add <name>`
