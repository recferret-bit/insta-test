# 03 — Design System, Layout & Accessibility

Feature: `F-FE-11`.

## Visual Direction

Clean, content-first, modern: neutral surfaces, generous whitespace, rounded media corners, a single vibrant accent gradient reserved for story rings and the primary brand mark. Media is the hero; chrome is quiet. The visual identity (name "Insta-test", logo, palette) is original and must not copy any existing product's trademarks or assets.

## Design Tokens (`apps/web/src/styles/tokens.css`)

```css
:root {
  /* color — light */
  --color-bg: #ffffff;
  --color-surface: #fafafa;
  --color-surface-raised: #ffffff;
  --color-border: #e5e7eb;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-accent: #6d28d9;            /* buttons, links */
  --color-accent-contrast: #ffffff;
  --color-like: #e11d48;
  --color-danger: #dc2626;
  --color-focus: #2563eb;
  --gradient-story: conic-gradient(from 210deg, #f59e0b, #ec4899, #8b5cf6, #f59e0b);

  /* type */
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --text-xs: 12px; --text-sm: 14px; --text-md: 16px; --text-lg: 20px; --text-xl: 28px;
  --weight-regular: 400; --weight-semibold: 600; --weight-bold: 700;

  /* spacing (4px grid) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px;

  /* shape & elevation */
  --radius-sm: 6px; --radius-md: 12px; --radius-lg: 20px; --radius-full: 9999px;
  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.1);
  --shadow-modal: 0 20px 50px rgb(0 0 0 / 0.25);

  /* motion */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-fast: 120ms; --dur-base: 200ms;
}

/* dark: explicit toggle, or OS preference unless the user forced light */
:root[data-theme="dark"] {
  --color-bg: #0b0b0f; --color-surface: #121218; --color-surface-raised: #1a1a22;
  --color-border: #2a2a35; --color-text: #f3f4f6; --color-text-muted: #9ca3af;
  --color-accent: #a78bfa; --color-accent-contrast: #0b0b0f;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #0b0b0f; --color-surface: #121218; --color-surface-raised: #1a1a22;
    --color-border: #2a2a35; --color-text: #f3f4f6; --color-text-muted: #9ca3af;
    --color-accent: #a78bfa; --color-accent-contrast: #0b0b0f;
  }
}
```

The theme toggle stores `light` / `dark` / `system` in `localStorage` (`insta.theme`) and sets or removes `data-theme` on `<html>`.

## Core Components (`ui/components/`)

| Component | Notes |
|---|---|
| `Button` | variants `primary`, `secondary`, `ghost`, `danger`; sizes `sm`/`md`; `loading` state with spinner and `aria-busy` |
| `Avatar` | sizes 24/32/44/56/88/150; `ring` prop (`none`/`unseen`/`seen`) draws story gradient ring |
| `TextField`, `TextArea` | label, error text linked with `aria-describedby`, character counter |
| `MediaCarousel` | `role="region"` + `aria-roledescription="carousel"`, slide labels "2 of 5" |
| `VideoPlayer` | muted autoplay in viewport, `playsInline`, controls on focus, respects `prefers-reduced-motion` (no autoplay) |
| `PostCard`, `PostGrid`, `PostGridTile` | grid is 3 columns with 2–4 px gaps, square crops (`object-fit: cover`) |
| `StoryTray`, `StoryRing`, `StoryProgress` | — |
| `Modal`, `Sheet` | focus trap, `Esc` closes, returns focus to trigger; sheet on mobile, modal on desktop |
| `Toast` | auto-dismiss 4 s, pause on hover/focus |
| `Skeleton` | shimmer disabled under `prefers-reduced-motion` |
| `EmptyState`, `ErrorState` | icon + message + action |
| `LikeButton` | `aria-pressed`, label "Like"/"Unlike", heart pop animation |

## Responsive Breakpoints

| Name | Min width | Layout |
|---|---|---|
| `sm` | 0 | Bottom tab bar, full-width feed, 3-col grid |
| `md` | 768 px | Icon-only sidebar |
| `lg` | 1264 px | Sidebar with labels |

## Accessibility Requirements

- WCAG 2.1 AA contrast for text and icons on both themes.
- Every interactive element reachable by keyboard with visible focus ring (`outline: 2px solid var(--color-focus)`).
- Images: `alt` from caption's first 100 chars or "Photo by @username"; decorative icons `aria-hidden`.
- Live regions: toasts (`polite`), upload progress (`aria-valuenow`).
- Respect `prefers-reduced-motion` for animations and video autoplay.
- Lighthouse accessibility score ≥ 90 on Home, Profile, Post pages (checked in CI e2e job).
