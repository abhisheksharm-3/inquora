# Design artefacts

The mockups behind the Inquora interface. Open the HTML files in a browser; they are self-contained
apart from two Google Fonts.

These files are the record. There are no screenshots checked in, because any view regenerates by
opening the corresponding file, and a screenshot goes stale the moment the markup changes.

## Mockups

| File | What it is |
|---|---|
| `01-direction-probes.html` | Three competing directions for the chat surface: The Ledger, The Margin, The Workbench. Same conversation, same documents, same tool calls, so the comparison is design rather than content. |
| `02-apparatus-hybrid.html` | The Ledger and The Margin folded into one direction, in both themes. This is the one that won. |
| `03-all-surfaces.html` | The winning direction applied to ten surfaces, landing page through phone. |

## The ten surfaces, in `03-all-surfaces.html`

```
01  landing                       brand register, dark, no imagery
02  sign in
03  new conversation
04  adding a document             ingestion progress as a true fraction
05  empty conversation            where the personality lives
06  in conversation               the core surface
07  following a citation          the reading column becomes the document
08  history
09  settings
10  phone                         the apparatus becomes footnotes
```

## Visual references

Not checked in. The three pages that informed the direction are described, with the reasoning about
each, in `.polaris/specs/2026-08-25-ui-scope.md`:

- **The General Intelligence Company of New York** is the one with authorship. Illustrated rather
  than stock, offset rather than centred, and a second visual register colliding with the first.
  The principles carried forward come from that page.
- **Scrolltide** is a template marketplace, recorded as an anti-reference. Those files ship to
  hundreds of sites, and full-bleed cinematic landscape with a serif over it is the saturated
  aesthetic for AI products.
- **GrowthX** is a centred headline over a generated image with a centred pill call to action,
  recorded because it is the exact shape `PRODUCT.md` bans.

## The documents these support

- `PRODUCT.md` — register, users, personality, anti-references, accessibility floor
- `DESIGN.md` — the layout law, tokens, type, motion
- `.polaris/specs/2026-08-25-ui-shape-brief.md` — the confirmed design brief
- `.polaris/specs/2026-08-25-ui-scope.md` — what was measured, and what it changed in the schema
