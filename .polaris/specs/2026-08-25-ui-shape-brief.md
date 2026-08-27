# Inquora UI: design brief

Date: 2026-08-25
Status: confirmed by the user on the rendered probes
Produced by: `impeccable shape`
Context: `PRODUCT.md`, `DESIGN.md`
Artefacts: `docs/design/01-direction-probes.html`, `02-apparatus-hybrid.html`,
`03-all-surfaces.html`

## 1. Feature summary

Inquora is a document-chat product whose thesis is verification: every answer traces to the passage
it came from. This brief covers the whole interface, ten surfaces from landing page to phone,
rebuilt from nothing. The existing UI is deleted rather than reworked.

The audience is one technically literate reader working across four document types: papers,
repositories, mixed business documents, and their own material.

## 2. Primary user action

**Read an answer, and reach the passage behind any claim in it in one action.**

Everything else on every surface is subordinate. A decision that makes sources harder to reach
loses to one that makes them easier, whatever it costs elsewhere.

## 3. Design direction

**The Apparatus.** Named for the _apparatus criticus_, the scholarly matter a critical edition sets
beside its text.

The rule, on every surface: **substance on the left, apparatus on the right.** Whatever the surface
is about occupies the reading column. Everything that supports, explains or records it occupies the
right column. Operations and specimens interleave chronologically there, so the apparatus reads as
what happened as well as what backs it.

- **Colour strategy.** Restrained on both registers: tinted neutrals plus one oxide mark held under
  ten percent. The brand register differs by committing to the dark ground, not by introducing a
  saturated colour.
- **Theme scene.** Open at 1am in a dim room three hours into a paper, and open at 2pm beside an
  editor and a browser. Neither is the exception, so both themes ship to the same standard and the
  system preference is a first-class path.
- **Anchor references.** The General Intelligence Company of New York, for authorship over stock and
  offset over centred. A critical edition, for the text-and-apparatus relationship the whole system
  is built on. A herbarium sheet, for specimen numbering and the discipline of labelling.

**Which probe won.** Three directions were built and compared: The Ledger (permanent evidence rail),
The Margin (dark critical edition, no bubbles), The Workbench (tool calls as instruments). The user
asked for a hybrid of the first two.

A straight mashup would have failed, because The Margin's gutter sits left and The Ledger's rail
sits right, and three columns crush the measure at laptop width. **What changed the brief:**
recognising that the gutter and the rail carry the same class of material, so folding them into one
right-hand column returns the layout to two columns and gives the direction its name.

The Workbench lost, but its idea survives: tool calls render as legible operations with real
timings rather than collapsing into a spinner.

## 4. Scope

- **Fidelity.** Production-ready. This brief hands to implementation, not to further exploration.
- **Breadth.** The whole product. Ten surfaces, listed in section 6.
- **Interactivity.** Shipped-quality components on `@assistant-ui/react` primitives.
- **Time intent.** Polish until it ships. The UI is the second slice, after the backend rebuild.

## 5. Layout strategy

Two columns, everywhere, at 1150px and above.

```
┌────────────────────────────────┬──────────────────┐
│  substance                     │  apparatus       │
│  58ch measure, Newsreader      │  330px, Plex Mono│
│  the thing being read or done  │  ops + specimens │
└────────────────────────────────┴──────────────────┘
```

**The reading column** carries the answer, the document, the form, the register, whatever the
surface is for. Newsreader at 300 weight, 58 characters, generous leading. Nothing is placed behind
it.

**The apparatus** carries everything else. IBM Plex Mono, 0.72rem, hairline rules between groups.
Two entry kinds: an **operation** (something ran, with a timestamp and a duration) and a
**specimen** (something cited, with a number, a source line and the passage itself).

**Specimen numbers are the only connective tissue.** A superscript mark in the text, a numbered box
in the apparatus. Clicking either reaches the other.

**Following a citation swaps the reading column**, not the apparatus. The document opens where the
text was, the passage marked in place, the apparatus unmoved. One click returns. This is why the
layout never needs a third column.

**Below 1150px the apparatus becomes footnotes**, which is what an apparatus has always done on a
narrow page. Specimens move below the answer as numbered notes; operations collapse to one line of
record; the viewer takes the full screen.

Hierarchy is scale and weight, never colour. Spacing varies for rhythm rather than repeating one
step. Cards appear only where a card is genuinely the best affordance, which on these ten surfaces
is nowhere.

## 6. Key states

Ten surfaces, each with its states. All rendered in `docs/design/03-all-surfaces.html`.

| #   | Surface               | What the apparatus carries                                        |
| --- | --------------------- | ----------------------------------------------------------------- |
| 01  | Landing (brand, dark) | Numbered specimens backing each claim the page makes              |
| 02  | Sign in               | What happens to your documents                                    |
| 03  | New conversation      | Which tools the current selection switches on, and which stay off |
| 04  | Adding a document     | The live ingestion log with a true progress fraction              |
| 05  | Empty conversation    | What is already known about the documents in scope                |
| 06  | In conversation       | Operations and specimens, interleaved                             |
| 07  | Following a citation  | Unchanged, while the reading column becomes the document          |
| 08  | History               | Search, filters, and the most-cited passage                       |
| 09  | Settings              | What this account has actually used, and what it cost             |
| 10  | Phone                 | Nothing. The apparatus becomes footnotes below the answer         |

States every surface owes:

- **Empty.** Surface 05 is the designed case. Every list needs its own.
- **Loading.** Streamed, never a spinner. Progress is a fraction wherever one exists.
- **Error.** Cause and next action, beside the thing that failed. Never written into the transcript.
- **First run.** Openers generated from the documents in scope, not generic prompts.
- **Partial.** A document still indexing is usable for the documents that are ready, and says so.
- **Refused.** "Not answerable from what is attached" is a first-class answer, set in italic.

## 7. Interaction model

- **Ask.** Composer is a line of writing with an oxide caret, not a bordered box. Send is
  `useActionState`; the pending state comes from the same transition.
- **Stream.** Text arrives token by token in the reading column. Operations appear in the apparatus
  as they run. Specimens appear the moment a source is cited, which is before the sentence citing it
  finishes.
- **Cite.** Click a mark or its specimen. The reading column becomes the document, the passage
  marked. `Back to the answer` returns. On a phone, the note scrolls into view and tapping its
  source line opens the viewer full screen.
- **Branch.** Edit any message and regenerate. `messages.parent_id` makes the conversation a tree;
  assistant-ui's BranchPicker walks it.
- **Scope.** Documents toggle in and out of retrieval from the set bar, backed by
  `chat_documents.enabled`. The apparatus updates to show which tools that switches on.
- **Navigate.** Instant, through `partialPrefetching` and `<Link prefetch>`. Route changes animate
  with `<ViewTransition>` and directional `transitionTypes`.
- **Reduced motion.** Every transition is removed, not shortened.

## 8. Content requirements

Voice: precise, unhurried, never chatty. No congratulation, no theatrical apology.

- **Errors** state cause and next action. "The file is password protected. Remove the password and
  add it again." Not "Something went wrong."
- **Refusals** are plain. "Neither document says why deal size fell. That is not answerable from
  what is attached."
- **Labels** name what a person recognises. "What are we reading?" over "Select documents".
- **The apparatus** is telegraphic, because it is a record. `searched 2 documents, 6 passages`.
- **No em dashes** anywhere in interface copy.
- Banned words and structures per `PRODUCT.md`.

Dynamic ranges to design against: 0 documents to 12 in one chat; 0 to roughly 200 turns in one
conversation; 0 to 40 specimens in one apparatus; document titles from 8 to 120 characters;
passages from one line to a full page.

## 9. Type and colour, now settled

```
Display and reading   Newsreader        300 / 400, italic available
Apparatus and labels  IBM Plex Mono     400 / 500 / 600
```

The two-register collision `PRODUCT.md` principle four asks for is this pairing: a humanist serif
carrying everything read, an engineered mono carrying everything recorded. It is structural rather
than decorative, which is why it holds across ten surfaces without becoming a motif that tires.

```
                    light        dark
ground              #E7E8E3      #0F1215
panel               #EFF0EC      #14181B
ink                 #191C1A      #E3E7E2
soft                #565D5A      #99A0A4
faint               #8A918D      #656C70
rule                #C6CAC2      #242A2E
mark  (oxide)       #9C3D26      #D2705A
wash                mark @ 13%   mark @ 16%
```

Authored in OKLCH in the implementation. The mark shifts lightness between themes rather than hue,
so it stays one colour idea on both grounds. No pure black, no pure white.

## 10. Recommended references during implementation

- `impeccable` `reference/product.md` for surfaces 02 to 10, `reference/brand.md` for 01.
- `impeccable audit` before any surface is called done, then `impeccable polish`.
- `DESIGN.md` for tokens; `PRODUCT.md` for the bans and the accessibility floor.
- Vercel's `Huddle` (github.com/aurorascharff/next16-team-chat) for the Next 16.3 chat patterns in
  a TanStack Query variant.

## 11. Open questions for the implementer

1. **The tablet range, roughly 700 to 1150px.** Too narrow for two columns, too wide for footnotes
   to sit comfortably. The likely answer is footnotes at a wider measure, and it needs building
   before anyone should believe it.
2. **Operations accumulate.** Twenty turns in, the apparatus is mostly timings. Proposal: an
   operation collapses to a single summary line once its turn completes, specimens persist. Needs
   testing against a long conversation, not a short one.
3. **The landing page below the fold.** One screen is designed. Whether the apparatus device runs
   the length of the page, which would be distinctive, or becomes exhausting, is unanswered.
4. **`@assistant-ui/react-langgraph` against a plain route handler.** Supported, unproven here.
   Phase 3 of the backend plan opens with a spike that streams one tool call end to end before
   anything is built on the assumption.
