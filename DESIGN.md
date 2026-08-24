# Inquora design system

Companion to `PRODUCT.md`, which owns who and why. This file owns how it looks.

**Status: partial and deliberately so.** The palette and the second visual register are decided in
the shape step from rendered variants, not chosen in a document. Everything below is settled and
binding regardless of which variant wins.

## Colour

**Space: OKLCH.** Every colour is authored in OKLCH, never hex. Chroma reduces as lightness
approaches either extreme, because high chroma at the ends reads as garish.

**No pure black, no pure white.** `#000` and `#fff` are banned. Every neutral is tinted toward the
brand hue at chroma 0.005 to 0.01, which is enough to read as intentional without reading as
coloured.

**Strategy: restrained for product, committed for brand.** The working surfaces use tinted neutrals
plus one accent held under ten percent of the surface. The landing page is permitted to commit a
saturated colour across thirty to sixty percent, because the register is different and the reading
load is not there.

**Semantic tokens only.** A component never contains a raw colour value. It references a role.
Roles are defined once and both themes redefine the same role set.

```
--surface, --surface-raised, --surface-sunken
--text-primary, --text-secondary, --text-muted
--border-subtle, --border-strong
--accent, --accent-contrast
--source, --source-contrast     (citations, which are the product's core act)
--success, --warning, --danger
```

Both themes define **every** role. A role defined only inside a media query is a defect, because
the fallback then borrows the host's theme.

## Theme

Three states, all handled:

1. Explicit choice stamps `data-theme="dark"` or `data-theme="light"` on the root.
2. No choice means system preference, resolved through `prefers-color-scheme`.
3. The default palette lives on bare `:root`, dark overrides live under
   `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again
   under `:root[data-theme="dark"]` so the explicit toggle wins in both directions.

`body` carries an explicit token background. A transparent body inherits whatever is behind it.

Both themes are designed to the same standard and reviewed together. Neither is the afterthought.

## Typography

- **Display: an editorial serif with real presence.** Used for headings, the landing page, and
  nowhere inside body text.
- **Body: a clean sans with excellent screen rendering**, because the primary act is reading for an
  hour.
- **Code and citations: a mono** with a distinguishable zero and clear bracket forms. Repositories
  are a first-class document type.

Rules:

- Body measure capped at 65 to 75 characters. Non-negotiable on the reading surface.
- Type scale ratio of at least 1.25 between steps. Flat scales read as unconsidered.
- Hierarchy comes from scale and weight contrast, not from colour.
- Base body size 16px minimum, line height 1.5 minimum.
- Body text never below 12px anywhere, including captions and metadata.
- System text scaling supported without truncation.

## Layout

- **Asymmetric by default.** Offset composition, not centred. The centred hero and the centred
  chat column are both banned shapes in `PRODUCT.md`.
- **Spacing varies for rhythm.** Identical padding everywhere is monotony, not consistency. The
  scale is fixed; which step applies is a judgement per context.
- **Cards are the lazy answer.** Used only where a card is genuinely the best affordance. Nested
  cards are always wrong.
- **Not everything needs a container.** Most things do not.
- Mobile-first breakpoints. No horizontal page scroll ever. Wide content such as tables, diagrams
  and code blocks scrolls inside its own `overflow-x: auto` container.
- Zoom is never disabled.

## Motion

- Never animate layout properties. Transform and opacity only.
- Ease out with exponential curves: ease-out-quart, quint or expo. No bounce, no elastic.
- Duration 150 to 300ms for interface transitions.
- Motion carries meaning: spatial continuity, state change, arrival of streamed content. Decorative
  motion is cut.
- `prefers-reduced-motion` reduces or removes, rather than shortening.
- Reserve space for content that is about to arrive. Cumulative layout shift stays under 0.1.

Where motion belongs here specifically: streamed message reveals, the moment a citation resolves,
list morphs when a chat is removed, and directional route transitions. All of these use React's
`<ViewTransition>` rather than hand-written animation.

## Components

- Unstyled primitives from `@assistant-ui/react` for the chat surface, styled entirely by this
  system. A library that imposed its own look would guarantee the templated feel the product is
  trying to escape.
- Radix primitives elsewhere, same principle.
- SVG icons from one set. Emoji are never iconography.
- Every interactive element has a visible focus ring of at least 2px. Focus rings are never removed.
- Touch targets 44x44px minimum, 8px apart.
- Form labels are visible. Placeholder text is never the only label. Errors appear beside the field
  they concern, not collected at the top.
- Loading states show progress where a real fraction exists. The ingestion pipeline records an
  expected chunk count precisely so this is possible.

## Absolute bans

Restated here because they are visual, and enforced at review:

- Side-stripe borders wider than 1px as a coloured accent.
- Gradient text.
- Glassmorphism as a default surface.
- The hero-metric template.
- Identical card grids of icon plus heading plus text.
- Modals reached for before inline alternatives.
- Grey text on grey background.
- Raw hex values inside components.

## Pending the shape step

Decided from rendered variants, not from a document:

1. **The second visual register.** Three directions, built and compared. `PRODUCT.md` principle
   four requires the collision; it does not name the second register.
2. **The palette**, derived from whichever register wins, then validated for 4.5:1 in both themes
   before any component consumes it.
3. **Whether the landing page carries an illustrated world**, or reaches its ambition through
   typography and composition alone.
