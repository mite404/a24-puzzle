# Styling standards — A24 Oracle

Reference: [On Location in New York City](https://shop.a24films.com/products/on-location-in-new-york-city) on shop.a24films.com.

## Typography

| Role | Font | Class | Notes |
|------|------|-------|--------|
| UI / body | **Archivo** (stand-in for NB International Web) | `font-sans` | 1.1rem, line-height 1.19, tracking −0.01em |
| Page title | Archivo bold | `a24-title` | clamp(3.5rem → 5.775rem), tracking −0.055em |
| Labels | Archivo semibold caps | `a24-eyebrow` | 0.756rem, tracking 0.04em |
| PREORDER / price | Archivo caps, light gray | `a24-meta` | 0.625rem, `--a24-meta` color |
| Stills caption | Italic below image | `a24-caption` | Never overlay on photos |
| Body / UI copy | Archivo regular | `a24-body` | 1.1rem — footer nav, shared with prose |
| Copy column | — | `a24-prose` | `a24-body` + max-width 29.7rem |

## Layout (from shop product hero)

| Token | Value |
|-------|--------|
| `--a24-gutter-start` | clamp(1.75rem, **7vw**, 8rem) |
| `--a24-gutter-end` | clamp(1rem, **4vw**, 4rem) |
| `--a24-hero-pad-top` | clamp(7.5rem, 12vw, 13rem) |
| `--a24-hero-pad-bottom` | clamp(2.75rem, 4vw, 3.5rem) |
| `--a24-footer-spacer` | clamp(5rem, 10vw, 6.25rem) — gap above black footer |
| `--a24-footer-inline` | clamp(1.25rem, 2.5vw, 2.5rem) — symmetric footer side inset (~20–40px) |

- Apply gutters with `a24-gutter` on `SiteHeader`, `AppShell`, and full-bleed sections.
- Copy/game columns are **centered on the page** (`mx-auto`) with **left-aligned** text inside (`max-w-[45.6rem]` copy, `max-w-6xl` games).
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

- `SiteHeader` — eyebrow left, vector A24 logo centered (`public/a24-assets/A24-Films-Logo-Vector.png`)
- `SiteFooter` — black three-column shop footer mockup; use `a24-footer-inset` (not product-page asymmetric gutters)
- `AppShell` — gutters + optional hero padding + centered column
- Add UI via `bunx shadcn@latest add <name>`

## After pulling styling changes

Next.js can serve **stale compiled CSS** from `.next` (old Geist/dark tokens) even when source files are correct. If the shop look disappears after a merge:

```bash
bun run dev:clean
```

Quick sanity check — `src/app/globals.css` should define `.a24-gutter`, `.a24-title`, etc., and `layout.tsx` should load **Archivo** without a `dark` class on `<html>`.
