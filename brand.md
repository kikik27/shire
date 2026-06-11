# Brand — Shire

_Status: active_

Shire is an AI-powered hiring marketplace with stablecoin escrow on Celo. The brand
reads **trustworthy fintech**: confident blue, deep navy, clean white surfaces, generous
whitespace. AI is the helpful copilot; the chain is the quiet guarantee underneath.

## Palette

Tokens live in `apps/web/app/globals.css` as OKLCH CSS variables (light `:root` + `.dark`).
Always use the semantic token, never a raw hex.

| Token | Light | Role |
|---|---|---|
| `primary` | `oklch(0.546 0.227 263)` ≈ `#3b5bfd` | Brand blue — CTAs, links, focus rings, active nav |
| `background` | `oklch(0.985 0.003 247)` ≈ `#f6f7fb` | App canvas (cool near-white) |
| `card` | `oklch(1 0 0)` `#ffffff` | Cards, panels, surfaces |
| `foreground` | `oklch(0.21 0.03 264)` | Primary text (slate-900) |
| `muted-foreground` | `oklch(0.5 0.02 257)` | Secondary text — passes AA on white |
| `border` | `oklch(0.927 0.006 255)` | Hairlines (slate-200) |
| `success` | `oklch(0.62 0.16 150)` | Active / staked / hired |
| `warning` | `oklch(0.74 0.16 70)` | Pending / needs action |
| `destructive` | `oklch(0.58 0.22 27)` | Disputes / rejected |
| `chart-1..5` | blue / sky / coral / violet / teal | Data viz ramp |

**Dark theme** is a deep navy (`background ≈ #0b1120`). The marketing hero, final CTA, and
pricing bands render dark on the otherwise-light landing page by wrapping the section in
`className="dark"`, which flips shadcn tokens locally — no hardcoded colors.

## Typography

- **Sans (UI + display):** Inter via `next/font`, exposed as `--font-sans`.
- **Mono (numbers, stats, addresses):** JetBrains Mono via `next/font`, `--font-mono`.
- Stats, balances, and any changing number use `font-mono tabular-nums` to stop digit jitter.
- Display headings: tight tracking (`tracking-tight`), fluid sizing (`text-4xl md:text-6xl`).

## Shape & depth

- Radius: `--radius: 0.75rem`. Cards `rounded-2xl`, buttons `rounded-lg`, chips `rounded-full`.
- Separate with **border OR shadow, not both**. Marketing cards float (`shadow-sm`→`shadow-lg`
  on hover); dashboard cards use hairline borders on white.
- Soft, brand-tinted gradient glows behind the hero and section headers only.

## Motion

- Micro feedback 100ms, element enter 150–250ms, never past 500ms. `ease-out` to enter,
  `ease-in` to exit. Specify properties (`transition-[transform,opacity]`), never `all`.
- Page entrances are choreographed and gentle; everything respects `prefers-reduced-motion`
  (globally short-circuited in `globals.css`).

## Voice

Concise, active, candidate-first. "Land your next role." not "Find employment opportunities."
Name the chain guarantee plainly: "Stablecoin escrow protects both sides." Never overstate the
AI — it _finds and drafts_; the human _approves_.
