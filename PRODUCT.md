# Inquora

## Register

**Product primary, brand secondary.**

Inquora is a tool people work inside. The chat surface, document viewer, upload flow and history
carry the design investment. The landing page inherits the same type system and palette and is
allowed to be theatrical, but it is not where the product is won.

Per-task override is allowed. The landing page is a brand-register task. Everything behind
authentication is product register.

## Users and purpose

One audience, four document types. The reader is technically literate, works across formats, and
is often the person who built the thing.

- **Papers and textbooks.** Long sessions, dense text, citations that must resolve to a passage.
- **Repositories and technical documentation.** Wants exact matches and file reads more than prose
  summaries. Terminal-adjacent expectations about precision.
- **Mixed business documents.** Contracts, reports, spreadsheets, recorded meetings. Short
  sessions, needs the answer quickly, and needs to be able to check it.
- **The author's own material.** The tool is built for its maker first, which is a licence to be
  opinionated rather than to serve everyone equally.

The job: ask a question of a document and get an answer you can verify without leaving the page.
Verification is the product. An answer with no traceable source is a worse outcome than no answer.

## Brand personality

**Crafted, with unexpected moments.**

Serious where the text lives. Surprising in the seams: the empty state, the loading pass, the
moment a citation resolves, the first run. The working surface earns trust by getting out of the
way; the personality lives in the chrome and the transitions.

The reference that earned this: a painterly illustrated hero followed, without warning, by a
pixel-art flower. Two visual registers colliding is what made that page memorable, and neither
register alone would have.

Tone of voice: precise, unhurried, never chatty. The product does not congratulate the user or
apologise theatrically. Errors state a cause and a next action.

## Anti-references

Named by the user, and binding.

- **ChatGPT and Claude.** Not the quality bar, the shape: a centred column of grey bubbles, a
  sidebar of truncated titles, monochrome chrome. Borrowing that shape is what makes chat products
  interchangeable, and the stated goal is to surpass them rather than resemble them.
- **Notion, Notion AI, and the SaaS-cream lane.** Soft neutrals, rounded everything, friendly
  illustration, emoji used as iconography, identical card grids.
- **The cinematic AI-landscape lane.** Full-bleed atmospheric imagery with a serif headline over
  it, a single pill call to action. Currently the saturated aesthetic for AI products and sold as
  templates, so it is the fastest route to looking like everyone else.

Not excluded, and therefore available: the dark technical register of developer tooling. It must
still clear the category-reflex check below rather than arriving by default.

### Category-reflex check

Two altitudes, both binding.

- **First order.** If the theme and palette are guessable from the category alone ("AI document
  tool, so dark and blue"), it is the training-data reflex. Rework it.
- **Second order.** If they are guessable from category plus these anti-references ("not SaaS-cream
  and not cinematic, so editorial serif on paper"), it is the trap one tier down. Rework that too.

## Theme

**Both, genuinely.** The system preference is a first-class path, not an afterthought, and both
themes are designed to the same standard.

The scene that forces it: this app is open at 1am in a dim room three hours into a paper, and it is
open at 2pm beside an editor and a browser. Neither is the exception. The honest cost is roughly
double the visual QA, and both themes ship or neither does.

## Strategic design principles

1. **The citation is the product.** Every answer traces to a passage, and reaching that passage is
   one action. Design decisions that make sources harder to reach lose to decisions that make them
   easier, whatever they cost elsewhere.
2. **Reading is the primary act.** Text rendering, measure, contrast and rhythm outrank every
   decorative choice. Nothing goes behind body text.
3. **Personality lives in the seams.** Empty states, first run, loading, transitions, error copy.
   Not behind the transcript.
4. **Two registers, deliberately.** A humanist serif carries everything read; an engineered mono
   carries everything recorded. The collision is structural, which is why it survives ten surfaces
   without becoming a motif that tires.
5. **Offset, not centred.** Composition is asymmetric by default. The centred hero and the centred
   column are both banned shapes.
6. **Authored, never stock.** The shape run settled on no imagery at all: the landing page argues
   through typography and composition. If atmosphere is ever added, it is authored rather than
   stock or generically generated, because authorship is what survives being copied.
7. **Speed is a design feature.** Instant navigation, streamed reveals and optimistic feedback are
   part of the visual design, not an engineering afterthought.

## Accessibility floor

Not preferences. These ship or the work is not done.

- Contrast 4.5:1 for body text, 3:1 for large text, in **both** themes.
- Visible focus rings on every interactive element, 2px minimum. Never removed.
- Full keyboard operation, tab order matching visual order, escape routes from every modal and
  multi-step flow.
- `prefers-reduced-motion` honoured. Motion reduced or removed, never merely shortened.
- Never colour alone to carry meaning. Pair with icon, text or shape.
- Touch targets 44x44px minimum with 8px spacing.
- Sequential heading hierarchy, no skipped levels.
- Alt text on meaningful images, `aria-label` on icon-only controls.
- System text scaling supported without truncation.

## Engineering standards this design answers to

From `rules/craft.md`:

- **Tracer bullets.** One thin slice running end to end before widening. A chat surface that
  streams one real answer with one real citation comes before any second screen.
- **Orthogonality.** A change to the document viewer must not force edits to the composer.
- **Reversible decisions.** Component libraries and design tokens sit behind boundaries we own.
- **One source of truth.** A colour, a spacing step or a type size exists in exactly one place.
  Raw hex in a component is a defect.
- **No broken windows.** Rot in a file you are already touching gets fixed then, not later.
- **Good enough.** Polish serves the reading surface first. Gold-plating a settings page while the
  transcript renders badly is waste.

From the `ui-new` priority ladder, in order: accessibility, then touch and interaction, then
performance, then style. Style never outranks the three above it.

## Copy rules

- Every word earns its place. No heading restated as the first line beneath it.
- No em dashes. Commas, colons, semicolons, periods or parentheses.
- Sentence case in headings.
- Errors state cause and next action. No apology, no "oops", no "something went wrong".
- Banned throughout: delve, tapestry, pivotal, underscore as a verb, testament, vibrant, showcase,
  seamless, leverage, intricate, robust, nestled, boasts, groundbreaking, fostering, cultivating,
  holistic, synergy, cutting-edge.
- Banned structures: "not only X but also Y", "it is worth noting that", rule-of-three padding,
  "serves as" in place of "is".

## Absolute bans

Match and refuse. If about to write one of these, restructure the element instead.

- Side-stripe borders wider than 1px as a coloured accent.
- Gradient text via `background-clip`.
- Glassmorphism as a default surface. Rare and purposeful, or absent.
- The hero-metric template: big number, small label, supporting stats, gradient accent.
- Identical card grids of icon plus heading plus text.
- A modal as the first thought. Exhaust inline and progressive alternatives.
- Emoji as iconography.
- Placeholder text used as the only label.
- Animating layout properties. Transform and opacity only.

## Resolved in the shape step

Closed on 2026-08-25 against three rendered directions. See
`.polaris/specs/2026-08-25-ui-shape-brief.md` and `DESIGN.md`.

- **The second visual register** is a humanist serif carrying everything read against an engineered
  mono carrying everything recorded. Structural rather than decorative, which is why it survives
  ten surfaces.
- **The palette** is tinted neutrals plus one oxide mark, shifting lightness rather than hue
  between themes.
- **The landing page carries no illustrated world.** It reaches its ambition through typography and
  composition: claims on the left, numbered specimens backing them on the right. The page argues
  the way the product argues.
- **The system is called The Apparatus**, after the scholarly matter a critical edition sets beside
  its text. Substance left, apparatus right, on every surface.
