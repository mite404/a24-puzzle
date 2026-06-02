# Styling standards — A24 Oracle

## Typography

| Role | Font | Tailwind | Notes |
|------|------|----------|--------|
| UI / body | **Archivo** (Google Fonts stand-in for NB International Web) | `font-sans` | Loaded in `layout.tsx` as `--font-sans` |
| Oracle voice | Archivo italic | `font-sans italic` | Do not use `font-serif` for oracle copy — that resolves to system Georgia |
| Labels / meta | Archivo | `font-mono` only where monospace is intentional (scores, grid numbers) | Prefer `text-xs uppercase tracking-widest` for cinematic labels |

If you obtain NB International Web `.woff2` files, add them under `public/fonts/` and swap the `next/font` import in `layout.tsx`.

## Layout

- **Intake chat**: centered in the viewport inside `AppShell` (`max-w-2xl`, capped height `min(720px, 90dvh)`).
- **Games / end**: full-width within the same shell padding; games may use wider `max-w-*` internally.
- Prefer `flex` + `gap-*` over `space-x/y-*` (shadcn convention).

## Color & theme

- **shadcn preset**: `b5LCAabYm` — radix-rhea, neutral base, sky accent. Re-apply with  
  `bunx shadcn@latest init --preset b5LCAabYm --force --yes --no-reinstall`
- **Dark mode**: `className="dark"` on `<html>` so primitives pick up `.dark` CSS variables.
- **Experience canvas**: `bg-background text-foreground` (`.dark` sets background to true black).
- **UI primitives**: use semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`). Avoid raw `bg-white/10` on shadcn `Button` / `Input` when a variant exists.
- **Oracle chat accents**: `text-muted-foreground`, `border-border`, `bg-muted/50` for bubbles and inputs.

## Components

- Add shadcn pieces via `bunx shadcn@latest add <name>` — do not hand-roll controls that exist in `@/components/ui`.
- Vendored `components/ui/**` is ESLint-exempt; still follow preset tokens when editing.
