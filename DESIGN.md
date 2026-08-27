# Inquora design system

Companion to `PRODUCT.md`, which owns who and why. This file owns how it looks.

**Status: settled.** The shape run closed on 2026-08-25 against three rendered directions. The
system is called **The Apparatus**, after the _apparatus criticus_ a critical edition sets beside
its text. Brief at `.polaris/specs/2026-08-25-ui-shape-brief.md`; mockups at `docs/design/`.

## The layout law

**Substance on the left, apparatus on the right.** On every surface. Whatever the surface is about
occupies the reading column; everything that supports, explains or records it occupies the right
column.

```
┌────────────────────────────────┬──────────────────┐
│  substance                     │  apparatus       │
│  58ch, Newsreader 300          │  330px, Plex Mono│
└────────────────────────────────┴──────────────────┘
```

Two entry kinds in the apparatus: an **operation** (something ran, timestamped, with a duration) and
a **specimen** (something cited, numbered, with a source line and the passage). They interleave
chronologically, so the column reads as what happened as well as what backs it.

Specimen numbers are the only connective tissue between an assertion and its evidence: a superscript
mark in the text, a numbered box in the apparatus, each reaching the other.

**Following a citation swaps the reading column, never the apparatus.** The document opens where the
text was, the passage marked in place. One action returns. This is why the layout never needs a
third column.

**Below 1150px the apparatus becomes footnotes**, which is what an apparatus has always done on a
narrow page. Specimens move below the answer as numbered notes; operations collapse to one line of
record; the viewer takes the full screen.

## Colour

**Space: OKLCH.** Every colour is authored in OKLCH, never hex. Chroma reduces as lightness
approaches either extreme, because high chroma at the ends reads as garish.

**No pure black, no pure white.** `#000` and `#fff` are banned. Every neutral is tinted toward the
brand hue at chroma 0.005 to 0.01, which is enough to read as intentional without reading as
coloured.

**Strategy: restrained, on both registers.** Tinted neutrals plus one mark held under ten percent
of the surface. The landing page differs by committing to the **dark ground** rather than by
introducing a saturated colour, which is the statement the brand register is allowed and the
product register is not.

**Semantic tokens only.** A component never contains a raw colour value. It references a role.
Roles are defined once and both themes redefine the same role set.

```
                      light        dark
--ground              #E7E8E3      #0F1215
--panel               #EFF0EC      #14181B     the apparatus column
--ink                 #191C1A      #E3E7E2
--soft                #565D5A      #99A0A4
--faint               #8A918D      #656C70
--rule                #C6CAC2      #242A2E
--mark                #9C3D26      #D2705A     oxide; citations and carets
--wash                mark @ 13%   mark @ 16%  marked passages
--success --warning --danger                   semantic, separate from the mark
```

The mark shifts **lightness** between themes rather than hue, so it stays one colour idea on both
grounds. Values are authored in OKLCH in the implementation; the hex above is the reference.

There is exactly one accent. Citations use it, the composer caret uses it, and nothing decorative
does.

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

Two faces, and the pairing is the design rather than a delivery vehicle for it.

```
Reading and display   Newsreader      300 / 400, italic available
Apparatus and labels  IBM Plex Mono   400 / 500 / 600
```

A humanist serif carries everything **read**. An engineered mono carries everything **recorded**.
That is the two-register collision `PRODUCT.md` principle four requires, and it is structural rather
than decorative, which is why it holds across ten surfaces without tiring.

IBM Plex Mono also carries code and repository content, so no third face is needed.

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

## Still open

Named in the shape brief, and left for the implementer rather than guessed at here:

1. **The tablet range, roughly 700 to 1150px.** Too narrow for two columns, too wide for footnotes
   to sit comfortably. Likely footnotes at a wider measure, unproven.
2. **Whether operations persist.** Twenty turns in, the apparatus is mostly timings. Proposal: an
   operation collapses to one summary line once its turn completes, specimens persist.
3. **The landing page below the fold.** One screen exists. Whether the apparatus device runs the
   full length of the page is unanswered.

The landing page reaches its ambition through **typography and composition**, not an illustrated
world. The answer to the third question in the previous draft is: no image. The page argues the way
the product argues, with claims on the left and specimens backing them on the right.
