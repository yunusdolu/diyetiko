# DESIGN.md — "Kinetic Kitchen"

Site and admin for **Diyetiko**. This document is the design contract. Code
that contradicts it is a bug; changing it requires a written reason in the changelog at the bottom.

---

## 1. Concept

**A food magazine that turns into a lab notebook while you scroll.**

The site's story is _food → data → health_. Every page starts in the kitchen (warm paper, big
serif, drawn ingredients), passes through the measurement bench (mono numerals, hairline rules,
nutrition-label layouts) and ends somewhere human and calm (deep green, plain sentences, a way to
talk to Muzahim).

One object carries the whole story: **the plate.** A plate is a circle; a circle is a chart. The
hero plate is filled with drawn ingredients, follows the pointer like it is being slid across a
table, and on scroll its contents fall away and the rim splits into three macro rings
(protein / carbohydrate / fat). The same ring then appears everywhere data appears — calculator,
recipe detail, wizard result, program share page, admin progress-to-goal. The ring is the brand
mark, not a decoration.

What we are **not**: a spa. No leaves-and-water-drops, no pastel gradients, no smiling stock
people holding salads, no "transform your body". The brand voice is a knowledgeable friend in a
kitchen, not a coach on a stage.

## 2. Moodboard in words

- The masthead of a 1970s food magazine: a Didone set so big it gets cut off by the page edge.
- A Turkish market stall at 7am: lemons stacked in pyramids, paprika in open sacks, hand-written
  price cards, a scale with a needle.
- The back of a food package: the _Besin Değerleri_ table — black hairlines, bold row labels,
  numbers right-aligned in a mono face. We borrow that grammar for every data display.
- A chef's prep list taped to steel: numbered steps, ticked with a marker.
- Risograph print: two or three flat inks, visible grain, slightly offset registration.
- Late-evening kitchen light from the upper left: one light source, long soft shadow down-right.

## 3. Type system

| Role      | Latin (tr / en / fr)                                            | Arabic (ar)                       | Why                                                                                                                                                                                                                                                    |
| --------- | --------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Display   | **Bodoni Moda** (variable, `opsz` 6–96, `wght` 400–900, italic) | **Amiri** 700                     | Didone contrast = magazine cover. Amiri is a Naskh with the same high thick/thin contrast and vertical stress, so the Arabic hero has the same drama, not a flat geometric substitute.                                                                 |
| Text / UI | **Schibsted Grotesk** (variable 400–900)                        | **Readex Pro** (variable 160–700) | Schibsted was drawn for a newspaper: sturdy, a little condensed, honest. Readex Pro's Arabic has open counters and a large x-height that sits at the same optical size and weight as Schibsted, so mixed tr/ar screens (admin, share page) don't jump. |
| Data      | **Martian Mono** (variable `wdth` 75–112.5, `wght` 100–800)     | Martian Mono (Latin digits)       | Every number is tabular by construction. `wdth: 75` for dense admin tables, `wdth: 112` for oversized counters. It reads as "instrument", which is what data should feel like.                                                                         |

Why not Fraunces / Instrument Serif / Inter / Geist: they are the current defaults of generated
sites and fail the "thousand other sites" test on sight.

### Scale (fluid, `clamp()`; 1rem = 16px)

| Token         | Size                                                      | Line-height | Use                         |
| ------------- | --------------------------------------------------------- | ----------- | --------------------------- |
| `display-2xl` | clamp(3.75rem, 14vw, 14rem)                               | 0.86        | Hero word, cropped          |
| `display-xl`  | clamp(3rem, 9vw, 8.5rem)                                  | 0.9         | Section openers             |
| `display-lg`  | clamp(2.25rem, 5.5vw, 5rem)                               | 0.95        | Page titles                 |
| `display-md`  | clamp(1.75rem, 3.2vw, 3rem)                               | 1.02        | Card titles, big statements |
| `text-xl`     | clamp(1.25rem, 1.6vw, 1.5rem)                             | 1.35        | Lead paragraphs             |
| `text-base`   | 1.0625rem                                                 | 1.6         | Body                        |
| `text-sm`     | 0.9375rem                                                 | 1.5         | UI                          |
| `label`       | 0.75rem, `letter-spacing: 0.08em`, uppercase (Latin only) | 1.2         | Nutrition-label captions    |
| `num-xl`      | clamp(3rem, 10vw, 9rem), Martian `wdth 112`               | 0.85        | Counters                    |

### Script rules

- **Arabic**: `letter-spacing: 0`, never uppercase, never italic, line-height × 1.25 relative to
  the Latin token (display 1.1, body 1.9). Animation splits **by word only** — splitting by
  character breaks cursive joining. Display size is reduced by one step (Amiri's ascenders are
  taller; at the same `font-size` it would crop).
- **Turkish**: casing goes through CSS `text-transform` with `lang="tr"` on `<html>` or through
  `toLocaleUpperCase(locale)`. Never `toUpperCase()`. Test string: **"İğdır şeker çöğüş"** must
  render as **"İĞDIR ŞEKER ÇÖĞÜŞ"**.
- **French**: longest strings (≈ +25 % vs. English). Every button and chip is tested with French
  copy; nothing has a fixed width. French punctuation: non-breaking space before `: ; ? !` handled
  in message files with ` `.
- **Latin** may use per-character reveals in the hero only. Everywhere else: per-word or per-line.

## 4. Grid & rhythm

- **Desktop (≥1024)**: 12 columns, gutter 24px, outer margin `clamp(16px, 4vw, 64px)`, max content
  width 1440px. Columns 1–2 are a **marginalia rail**: section numbers, captions, mono labels
  live there, the way a cookbook prints notes in the margin. Content starts at column 3. This
  asymmetry is the main defence against "centred template" layouts.
- **Tablet (768–1023)**: 8 columns, marginalia collapses into an eyebrow line above content.
- **Mobile (<768)**: 4 columns, 16px margins. Display type is allowed to bleed off the inline-end
  edge (cropped type), never off the start edge (would hide the first letter in RTL/LTR).
- **Vertical rhythm**: 8px base. Section padding `clamp(96px, 14vh, 192px)`. Hairline rules
  (1px, `currentColor` at 18 % opacity) separate everything instead of cards and shadows.
- Sections alternate **paper → green/ink → paper**. A dark section never follows a dark section.

## 5. Tokens

### Colour

| Token          | Hex     | Notes                                                                                                              |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `paper`        | #F3EEE4 | Default light background                                                                                           |
| `paper-2`      | #E8E0D0 | Sunken surfaces on paper                                                                                           |
| `ink`          | #0F1B17 | Text on light; darkest background                                                                                  |
| `ink-70`       | #3B4843 | Secondary text on paper (8.3:1)                                                                                    |
| `ink-60`       | #4A5550 | Tertiary text on paper (6.7:1)                                                                                     |
| `green`        | #123B2E | Dark section background                                                                                            |
| `green-2`      | #1B4D3D | Raised surface on green                                                                                            |
| `sage`         | #B9C4BE | Secondary text on green (6.9:1)                                                                                    |
| `citrus`       | #D8F24A | Accent — **only on green / ink** (9.9:1 / 14.1:1)                                                                  |
| `paprika`      | #FF5B36 | Accent fill; text only on ink (5.7:1) or large text on green (4.0:1)                                               |
| `paprika-deep` | #B23114 | **Added**: paprika text on paper (5.4:1). Justification: paprika on paper is 2.67:1, fails AA even for large text. |

Measured contrast (script in `scripts/contrast.mjs`): ink/paper 15.3, green/paper 10.7,
citrus/green 9.9, paprika/ink 5.7, paprika-deep/paper 5.4, ink/paprika 5.7 (so paprika buttons
carry **ink** text, never paper — paper/paprika is 2.67).

Macro colours (fixed across the whole product so people learn them):
protein = paprika, carbohydrate = citrus (on dark) / `#8FA31A` stroke on light, fat = `#E9B949`
(mustard), fibre/water = sage.

### Radii, lines, depth

- Radii: `0` for layout, `999px` for chips and pill buttons, `20px` for the few real containers
  (sheets, dialogs). Nothing in between — mid radii are what make UIs look generic.
- No drop shadows on the public site. Depth comes from overlap, grain, and the offset "print
  registration" shadow: a 3px solid ink offset on pressed buttons.
- Grain: one static SVG `feTurbulence` texture at 6 % opacity, `mix-blend-mode: multiply` on
  paper, `soft-light` on dark. Never animated (performance and vestibular reasons).

## 6. Illustration system

No stock photos. A drawn ingredient set (`components/site/ingredients.tsx`), all sharing:

- Flat shapes in the palette plus four food colours (tomato red, olive, mustard, aubergine).
- **One light source, upper-left**: every object gets a highlight crescent at 10–11 o'clock and a
  shadow crescent at 4–5 o'clock drawn with the same two opacities (0.35 white, 0.18 ink).
- A 2px ink outline offset by (1.5px, 1.5px) — the "risograph mis-registration".
- Grain via a shared SVG filter.

Set: lemon, egg, avocado, chickpea, pomegranate, olive, tomato, fig, carrot, walnut, bread
(pide slice), yogurt, pepper, fish, oats, cucumber, apple. The plate composes them.

Photo slots (about portrait, recipe hero, guide cover) are art-directed frames with the same
offset outline; they show a drawn ingredient until the admin uploads a real photo.

## 7. Motion language (`lib/motion.ts`)

One vocabulary, everywhere.

| Name                         | Value                                      | Use                             |
| ---------------------------- | ------------------------------------------ | ------------------------------- |
| `ease.out`                   | `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) | Entrances, reveals              |
| `ease.inOut`                 | `cubic-bezier(0.76, 0, 0.24, 1)` (quart)   | Wipes, page transitions, morphs |
| `ease.in`                    | `cubic-bezier(0.7, 0, 0.84, 0)`            | Exits                           |
| `spring.snappy`              | stiffness 520, damping 34                  | Toggles, tabs, checkboxes       |
| `spring.soft`                | stiffness 180, damping 24                  | Cards, layout changes           |
| `spring.magnet`              | stiffness 260, damping 18, mass 0.6        | Magnetic buttons, cursor        |
| `dur.xs / sm / md / lg / xl` | 120 / 200 / 350 / 600 / 900 ms             |                                 |
| `stagger.word / char / item` | 45 / 18 / 60 ms                            |                                 |

Rules:

1. Only `transform`, `opacity`, `clip-path` (and SVG `stroke-dashoffset`) animate.
2. Things **enter from below with a mask** (line mask reveal), **exit up and faster** (exits are
   60 % of the entrance duration).
3. Horizontal motion follows reading direction: `x` values are multiplied by `dir` (`1` LTR,
   `-1` RTL). Progress fills grow from `inline-start`. Arrows mirror; check/play/plus do not.
4. Not everything animates on scroll. Rule of thumb: **one** reveal per viewport, the rest is
   already there. No fade-up on every paragraph.
5. `prefers-reduced-motion: reduce` → no scroll-scrubbing, no pinning, no Lenis, no cursor, no
   marquee movement, no parallax. Reveals become 150 ms opacity cross-fades. Every signature
   moment has a designed static composition (not "the animation's first frame").
6. `save-data` or `deviceMemory ≤ 2` or `hardwareConcurrency ≤ 4` → same as reduced motion for
   GSAP sequences; micro-interactions stay.
7. Admin: same easings, no scroll theatre. Controls stay ≤ 250 ms; content may arrive with a
   short stagger and data may draw itself in (v1.13).

### Micro-interaction states

Every interactive primitive implements: rest, hover (fine pointer only), focus-visible (2px
citrus ring on dark / ink ring on light, 3px offset — never removed), pressed (scale 0.97 +
3px offset shadow collapses to 0), loading (label slides up, spinner slides in), success (spinner
morphs into a drawn check), error (4px horizontal shake × 3, 280 ms, mirrored in RTL), disabled
(40 % opacity, no hover, `cursor: not-allowed`).

## 8. The five boldest ideas

### 1. The plate that becomes data (hero)

Desktop: a 560px SVG plate with drawn ingredients trails the pointer on a magnet spring (max 24px
travel). Headline words rise from masks. On scroll (GSAP scrub, hero pinned for 120 % viewport)
ingredients fall and fade outward, the plate rim splits into three concentric rings which draw
their stroke to real example macro percentages and labels count up.
**Mobile**: no pointer follow; the plate gently tilts with scroll, no pin (pinning on mobile
causes address-bar jank) — the decomposition plays once when the plate is 50 % in view.
**Reduced motion**: static composition — plate on the left third with rings already drawn
beside it, labels visible. Nothing moves.

### 2. Pinned four-step story (Tanışma → Planlama → Takip → Sonuç)

A pinned stage; background morphs paper → paper-2 → green → ink as the step changes. A hairline
progress line draws along the inline-start edge (mirrored in RTL). Each step has a micro-graphic:
a conversation card stack, a weekly grid filling, a line chart plotting, a ring closing.
**Mobile**: no pin; four stacked panels, each micro-graphic plays once in view.
**Reduced motion**: four panels, graphics in their end state.

### 3. Nutrition-label typography as the data system

Every number on the site sits in a _Besin Değerleri_-style table: bold hairline top rule, mono
tabular numbers aligned to inline-end, thick separator before totals. Calculator, recipe macros,
program share page and admin totals all use one `NutritionLabel` component. This is the idea a
dietitian will want to copy; it makes the site recognisable without a logo.
Degrades trivially — it's typography.

### 4. "Hedefini bul" as a full-screen, one-question-at-a-time flow

Huge answer tiles (Bodoni numerals + drawn ingredient per option), the chosen tile expands to
fill the screen then collapses into the progress rail. Result screen draws the macro rings and
gives three plain first steps. Keyboard: 1–5 picks, Enter continues, Esc goes back.
**Mobile**: tiles become full-width rows, same transitions (they are transform-only).
**Reduced motion**: instant step changes with 150 ms cross-fade.

### 5. Direction-aware kinetic strips (weekly menu + ingredient marquee)

The weekly menu scrubs horizontally while pinned; in RTL it scrubs the other way (day 1 on the
right). Day cards flip (rotateY, mirrored in RTL) to reveal meals and kcal bars. The ingredient
marquee's speed follows scroll velocity and reverses with scroll direction; it has a visible
pause button.
**Mobile**: native horizontal scroll-snap for the week (no pin), cards flip on tap. Marquee
runs at base speed.
**Reduced motion**: week is a static grid; marquee is a static wrapped list; pause is hidden
because nothing moves.

## 9. Critique of this document (round 1) and what changed

1. _"Didone at 900 weight on a phone will have hairlines that disappear."_ → Accepted. Bodoni
   Moda's `opsz` axis is pinned to 28 for every display use (`--display-opsz`, see v1.4); body-adjacent sizes
   (< 32px) use Schibsted, never Bodoni. Minimum Bodoni size is 28px.
2. _"The plate-to-rings hero is the same idea as the calculator donut — repetitive?"_ → Kept on
   purpose: repetition of **one** idea is what makes a brand. But the calculator uses a gauge
   (half ring) for BMR/TDEE so the two screens don't read identically.
3. _"Paprika + citrus + green is loud; with the grain it could look like a festival poster."_ →
   Constrained: citrus appears at most once per viewport (one highlight word, one button, or one
   chart series). Paprika is for protein and for the WhatsApp CTA only.
4. _"Marginalia rail wastes space on 1024–1280 screens."_ → Rail shrinks to 1 column below
   1280px and holds only the section number.
5. _"Custom cursor is a known accessibility and performance irritant."_ → It never replaces the
   system cursor on text fields, is `pointer: fine` + `hover: hover` only, and turns off with
   reduced motion.

Committed as v1.

## 10. Changelog

- v1 — initial direction. Added `paprika-deep` (#B23114) for paprika-coloured text on paper
  (AA), `ink-70`, `ink-60`, `paper-2`, `green-2`, `sage` as neutral steps; mustard `#E9B949` for
  fat. No base-palette hex values changed.
- v1.1 — found while building and screenshotting (no base hex values changed):
  - **Macro colours on light surfaces.** Citrus/mustard fail as thin strokes and text on paper.
    Added `protein-on-light` #D9431F, `carb-on-light` #6F8A12, `fat-on-light` #A87A12; the
    bright originals stay for dark surfaces (the hero, the wizard result, the footer).
  - **Numerals.** Big display numbers (`num-display`) use Bodoni Moda lining/tabular figures;
    Martian Mono stays for data rows and labels. Two numeral voices, never mixed in one row.
  - **Admin.** Same tokens, calmer: field radius 10px, ≤250 ms, no grain. Charts are
    single-series `--a-chart` (#2E7D4F light, #7FA126 dark, validated for contrast and CVD) with
    a table view next to every chart.
  - **Arabic data text.** On Arabic pages Readex Pro (Arabic + Latin subsets) leads the sans
    _and_ the mono stack. Reason: next/font's metric fallback for Martian ("Martian Mono
    Fallback" = local Arial, no unicode-range) caught Arabic glyphs inside numeric labels, so
    "مجموع اليوم" rendered in Arial on screen and in PDFs. Checked with `scripts/font-probe.mjs`.
  - **Open Graph images** are rendered by Chromium from `/dev/og` (`scripts/gen-og.mjs`), not
    by Satori/`ImageResponse`, which cannot shape Arabic. Composition: headline left (right in
    Arabic), plate bleeding off the opposite edge with the rings drawn to a fixed split.
  - **Filter chips** no longer prefix "≤": the group label already says "max", and the glyph
    was missing from Readex Pro (it fell back to a system font).
  - **Share page** tabs use weekday + day built from `formatToParts` (the Arabic long date has a
    comma that leaked into tab labels); units come from messages (سعرة / غ in Arabic).
- v1.2 — interaction QA pass (found by recording frames in a real browser):
  - **Page transitions** animate the root snapshot (the whole, opaque viewport) instead of the
    `<main>` element. The element snapshot was transparent, so the old page showed through the
    new one and slid with the scroll offset. The old page now stays put and dims to 90 %; the
    knife cut is 560 ms (was 720 ms).
  - **Language switch** is a real page load with a cross-document view transition (fade). The
    language lives in the root layout, so a client-side switch remounted the whole document anyway.
  - **Springs**: `follow` (over-damped) for everything that trails the pointer — cursor ring,
    guide previews, hero plate; `magnet` re-tuned to settle without bouncing.
  - **Guide previews** sit beside the cursor (inline end, flipping at the edge), never on the
    title being read; one element for the whole list; they stay attached while scrolling.
  - **Gauge**: needle and BMR tick rotate around the gauge centre (Motion's SVG default measured
    the origin from each line's own box); the target band is computed per frame from numbers.
  - **Weekly menu** day numbers are semibold: at regular weight Bodoni's hairline 4 vanished.
- v1.3 — client portal (`/panel`), a third surface in the site's language, not the admin's:
  - **Same tokens as the public site** (paper, ink, Didone titles, grain), calmer motion: no
    scroll pins, no marquee; layout springs only (`layoutId` pill in the rail / tab bar).
  - **Shell**: desktop = numbered side rail in the marginalia style (01–05); phone/tablet = slim
    top bar + bottom tab bar (safe-area aware, 5 items, active pill). Content column `max-w-3xl`
    for reading pages, `max-w-6xl` for diary / progress.
  - **Cards** (`PortalCard`): `paper-2/70` at 20 px radius; the check-in card is the one raised
    object (print shadow). Green tone only for the next appointment.
  - **Data**: day totals reuse the macro rings; weight chart is a custom SVG with one axis,
    check-ins as a 2 px line with dots, clinic measurements as diamonds (shape + colour), goal as a
    dashed labelled line, table view, keyboard/hover crosshair. Chart pair validated against
    paper: `--color-chart-self #2e7d4f`, `--color-chart-clinic #c2410c` (CVD ΔE 8.8, ≥ 3:1).
    Habits = 28-day grid (filled / outlined / dot = done / missed / no entry).
  - **RTL**: time flows right-to-left in charts, grid and water bars; user-written text (habit
    labels, food names, notes, messages) is isolated with `<bdi>` / `dir="auto"` so Turkish
    entries keep their order inside the Arabic UI.
  - **Entry pages** (sign-in, invite, consent): dark editorial panel beside the form on desktop;
    the panel headline is decorative (`aria-hidden`), the real `h1` stays in the form column
    (`lg:sr-only`).
- v1.4 — Bodoni hairlines: `font-optical-sizing: auto` gave poster-size headlines `opsz` 96,
  whose hairlines nearly vanish on screen (the "t" of _tabakta_, the tail of "y", worst on
  phones). Every `.font-display` / `num-display` now uses `opsz` 28 (`--display-opsz`): same
  typeface, same thick/thin drama, hairlines that survive at 390 px. Compared 96 / 60 / 40 / 28 / 18
  side by side; 18 turned the Didone into a text face, 40 still lost the italic "t".
- v1.5 — "Hedefini bul" shared layout: the chosen tile, the full-screen flash and the rail pill
  shared one permanent `layoutId`, so going back through the rail (or Esc) pulled the chosen tile
  out of the rail pill (the pill vanished, the card flew down from the top bar). The three now
  share an id only for the choice being made; tiles move to a new generation afterwards. The
  flash also fades while it shrinks into the pill, so no dark block sits on the rail.
- v1.6 — every device, touch first:
  - **Scroll-driven, both ways.** The process graphics (notebook written line by line with a
    pencil, week grid, habit line, closing rings) follow the scroll position: they draw while
    scrolling down and un-draw while scrolling up — nothing plays on a timer. The hero plate on
    phones and tablets is scrubbed the same way (it turns into rings once the whole plate is on
    screen, and comes back when scrolling up).
  - **Pinning is for mice only** (`(min-width: 1024px) and (hover: hover) and (pointer: fine)`):
    touch tablets in landscape used to get pinned, scrubbed sections that fight the browser's
    own scrolling, and a weekly strip that could not be swiped. They now get the stacked story
    and a native swipe strip.
  - **44 px targets on touch** (`pointer: coarse`): h-9/h-10 controls grow to 44 px, standalone
    text links get `tap-44`, the range thumb is 30 px. Tooltips open with a tap. Guide
    illustrations sit inline in each row on touch (the floating preview follows a mouse only).
    `scripts/touch-audit.mjs` checks all of this on 5 device sizes.
  - **Plate v2**: a real lunch — heaped salad (rounded leaves, tomato, cucumber, red onion,
    purple cabbage, carrot, olives), grilled chicken slices, yoghurt with pul biber and olive oil,
    chickpeas, a bulgur pilaf mound, lemon and mint on a çini-dotted plate. Same class hooks, so
    the plate → rings transition is unchanged.
  - **Cursor labels** say what happens instead of "Aç": "Bu benim →" on the goal cards (the
    disc turns citrus on the dark hover), "Pişirelim" on recipes.
- v1.7 — upright tablets: the side-by-side hero (plate beside the headline, pinned scrub) now
  needs a landscape screen as well as ≥ 1024 px (`wide:` variant). A 12.9"/13" iPad Pro held
  upright (1024 × 1366) got the laptop hero with the plate squeezed into the corner and an empty
  lower half; it now gets the stacked tablet hero like every other portrait tablet. The weekly
  strip's full-height centring is limited to where it is pinned (mouse), macro rings stay hidden
  until they start drawing (no stray dots above the plate), and contact rows align on one line.
- v1.8 — short laptop windows (1366×768, 125 % Windows scaling, browser zoom on a 13" MacBook):
  the pinned sections are exactly one screen tall, so their content now follows the window
  HEIGHT as well as its width. Weekly cards fill the space left under the heading (19–30 rem,
  `pin:` variant) and tighten their own content through size container queries (`card-short`,
  `card-tiny`); below 600 px of height the strip is not pinned and scrolls. Hero headline, plate
  and paddings are bounded by `svh` so the call to action is always on screen; the process stage
  number and graphic are bounded the same way.
- v1.9 — touch screens play, mice scrub: on phones and tablets (`pointer: coarse`) the process
  graphics and the hero plate → rings transition play ONCE, by themselves (2.4 s), when they
  come on screen — a finger flicks past a scrubbed animation before it can be read. Where the
  plate is already on screen at load (landscape tablets) it waits for the first bit of scroll.
  Mouse-driven screens keep the scroll-driven versions, in both directions (this replaces the
  "scrubbed on phones and tablets" part of v1.6).
- v1.10 — cursor label zones: "Pişirelim" shows over the recipe IMAGE only (featured card, grid
  cards, the thumbnails of the home list), never over the title or text. The card's link is
  stretched over the whole card, so the cursor looks through it (`data-cursor-zones`) for the
  element carrying `data-cursor`. Over the image's dark data layer the disc is citrus. Card
  titles turn paprika on hover, like the list rows.
- v1.11 — calculator audit and small-window fixes:
  - **Gauge scale** adapts (0–4.000 → 0–6.000 → 0–8.000 kcal, with a middle label): a large,
    very active body used to pin the needle at the end of a fixed 0–4.000 scale. In Arabic the
    scale labels now follow the mirrored gauge (0 on the right). Units come from the messages
    (غ / سعرة in Arabic).
  - **BMI label** describes the number that is displayed (24.96 reads "25,0" → overweight range).
  - All calculator maths lives in `calculate()` (lib/nutrition/energy.ts); the wizard's result
    uses the same function. Checked against reference formulas over 25 920 inputs (unit) and 120
    on-screen combinations (`scripts/calc-audit.mjs`).
  - **Recipe filters** on short windows: the sticky column is its own scroll area with edge
    fades; the wheel moves the column while it can, then the page.
  - **Reduced motion** is read through a hydration-safe hook (`usePrefersReducedMotion`):
    Motion's own hook made React throw a hydration mismatch for visitors with that setting on.
- v1.12 — "Hedefini bul" choice transition rebuilt (replaces the v1.5 shared layout):
  - The tile → full screen → rail pill move is one full-screen ink layer seen through a
    **clip-path window** ("iris"), not a `layoutId` morph. A shared-layout box is scaled, so its
    corners went square and its text squashed mid-flight, and only rounded off at the end.
    The window is real geometry: corners are round on every frame (tile radius 18 → 44 px while
    travelling, clamped to a pill on the rail; square only when flush with the viewport), and
    the ingredient + label inside are never distorted.
  - The chosen tile turns ink immediately; the answer is committed and the step changes under
    the full layer; the layer then closes onto the answer's pill and melts into it.
  - **Back button** ("Geri") under the rail on every question (Esc and the rail still work).
    Going back is a plain, quick slide from the reading-start side with the chosen tile selected.
  - Reduced motion: no layer, the step changes directly.
- v1.13 — dietitian panel rebuilt around the working day; device fixes:
  - **Motion vocabulary for the panel** (`components/admin/fx.tsx`): _Rise_ (blocks arrive,
    14 px + fade, 0.45 s expo-out, 50 ms stagger), _Spotlight_ (a citrus glow follows a mouse
    over cards; fine pointers only), _Sparkline_ (drawn in real pixels, draws itself in once on
    screen, mirrored in RTL), _Meter_/journey tracks (fill from the reading-start side),
    tickers for numbers, springs for pills/badges, layout animation for lists. The hero's slow
    drifting light is the only ambient motion. Reduced motion: fades only, nothing drawn in.
  - **Dashboard**: an ink hero (greeting, three live shortcuts, the next appointment with a ring
    that closes over the last three hours), KPI cards with neutral deltas + sparklines, today's
    agenda, needs-attention, tasks, goal board, then the charts and feeds.
  - **Client overview** tab (default): allergy strip, quick actions (measurement, note,
    appointment, message, WhatsApp, call, e-mail), goal journey, clinical indicators, a 28-day
    adherence strip, tasks, next appointment / program / last message / note.
  - **Navigation**: grouped sidebar with line icons (Practice · Planning · Site); on phones a
    bottom dock (Overview, Clients, Messages, Appointments, Menu) with an animated pill; toasts
    sit above it.
  - Colours stay neutral for progress and deltas (no "good = green"); warnings use the new
    `--a-warn` token, never red for a client's numbers.
  - **Phones never scroll sideways**: every grid that defines columns only from a breakpoint
    up now has `grid-cols-1` (an implicit `auto` column grew to its widest child — the admin
    clients list and measurements tab were 465–738 px wide on a 390 px phone). Overflow tests
    compare against the device width: with `isMobile` a too-wide page zooms out instead of
    scrolling, so `scrollWidth − innerWidth` stayed 0 and hid it.
  - **Example week cards**: a turning card swings ~8 % out of its box in perspective — the
    scrolling strip clipped it; the strip now has room above and below (`py-12 -mb-12`) and the
    section clips sideways only. Day total and "Günü çevir" never wrap: on narrow cards
    (`card-narrow`, ≤ 20 rem) the button sits under the total.
  - Recipe ingredients header: the servings stepper wraps under the heading on 320–360 px phones.
- v1.14 — panel speed and safety (measured on the real Supabase project, ~67 ms per round trip):
  - **Transactions open in one message**: BEGIN + JWT claims + SET ROLE go out as one simple
    query, pipelined with the first statement; independent reads of a page are started together
    (Promise.all → pipelined). A one-query transaction went from ~400 ms to ~135 ms; panel pages
    from ~1.1 s to ~0.45 s, the dashboard from 2.2 s to ~0.8 s, a client page from 2.7 s to ~0.8 s.
  - **Auth check without a network hop**: the session JWT (ES256) is verified locally
    (`getClaims`); the role still comes from the database on every request.
  - **MFA could be skipped by editing the cookie** (pre-existing): "has a verified factor" was
    read from the unsigned session copy. It now comes from the Auth server (cached 5 min per
    account, cleared on enrolment); the session's assurance level from the verified JWT.
  - A DNS/network hiccup while opening a connection is retried (nothing sent yet → safe); a
    failing page shows a "Tekrar dene" screen instead of crashing; navigation shows a skeleton
    (`loading.tsx`) at once.
  - Dashboard additions: a 7-day schedule strip, an inbox answerable in place, new leads with
    call / WhatsApp / contacted / make-client, birthdays of the coming week with wishes in the
    client's language, a live clock, word-by-word greeting, KPI cards that tilt toward the mouse.
- v1.15 — **sidebar replaced by the client's chosen component** (`components/ui/sidebar.tsx`,
  adapted 1:1 from the "Wensity" sidebar): collapsible to an icon rail with the toggle in the
  header (or Ctrl/⌘+B; collapsed, the logo expands it), remembered in a cookie. The width
  animates with a 240 ms CSS transition and the page beside it is a flex sibling, so it reflows
  on every frame of the transition (tested frame by frame). Subtle items with a gliding active
  pill, faded section labels, search / theme / language / site as items, the user row in the
  footer. The same sidebar sits inside the phone drawer. Adaptations: `motion/react` instead of
  a second copy of framer-motion, Radix Slot for `asChild`, three inlined Tabler icons,
  next/link, logical (RTL-safe) directions, the hydration-safe reduced-motion hook.
- v1.16 — **smoothness, theme, transitions, practice tools**.
  - Sidebar at 60 fps: a spacer takes the final width at once (the page lays out once), the
    sidebar animates its own width over it, and the page slides along with a compositor-only
    transform on the same 240 ms curve (FLIP in `AdminShell`). Charts and sparklines redraw
    once the size settles (debounced), never per frame. Measured: 16 → 56–60 fps on the
    dashboard with the CPU slowed 4×.
  - Day/night: the switch answers on the click (client state + cookie, no server round trip)
    and the new theme opens as a circle from the switch over the old one (View Transitions,
    720 ms quart in-out, the old screen dims). The sun/moon icon morphs: rays fold, a shadow
    slides across the disc.
  - Admin navigation uses the site's **knife cut** (560 ms) — only when the path changes
    (`[data-nav-cut]`, set inside React's transition commit); refreshes after saving swap at
    once. The sidebar is its own transition layer and stays put, live.
  - Practice: **packages & payments** (sessions count down from appointments marked "came",
    paid / owed per currency, renewal list on the dashboard's revenue card), **lab results**
    (19 common tests with units, the lab's own range copied from the report, flags, trend,
    HOMA-IR), a printable **progress report** in the client's language, and **repeating
    appointments** (weekly / every two weeks, up to 12).
- v1.17 — **loader, applications, sign-in**.
  - Ink loader: decided by an inline script before the first paint (next/script ran only after
    the framework loaded, so the loader was drawn and then cut off half-way — and the headline's
    delay flipped mid-animation). It plays on the first page of a visit and after every language
    switch, always to the end: the old page is covered in ink (circle, 380 ms), the new one plays
    the ring and opens. The headline waits paused under it and rises as it opens
    (`[data-loader-open]`), so its timing never jumps.
  - Home goal grid: the tablet rule ("odd tiles have an end border") no longer leaks into the
    desktop grid (third tile had a stray line).
  - Programme application page: month-cell duration cards (a crossed-out "1 ay" says why there is
    none), chip answers, steps that slide in the reading direction, a drawn check on success;
    an ink home band where a year of months fills in, the first three in citrus.
  - Footer and menu sign-in links; installable panel.
- v1.18 — **one headline, prompts that take turns**.
  - The home headline played twice: GSAP's pin wrapped the hero in a new `.pin-spacer` after
    load, moving it in the DOM — and a moved element restarts its CSS animations. Both pins
    (hero, example week) now use a wrapper we render as `pinSpacer`, so nothing is moved.
  - Cookie choice: an ink card with a drawn biscuit (a bite on accept, put away on reject);
    accept and reject equally easy; reopenable from the footer ("Çerez tercihleri"). Stored in
    `dm_consent` for a year; `optionalCookiesAllowed()` must gate anything optional added later.
  - Programme invitation: a modal (bottom sheet on phones) with the conditions — at least three
    months, online or in person, a plan made for you, a three-minute application — after 35 s or
    60 % of a page, never on the application, contact, goal or legal pages; "later" snoozes it
    for two weeks, an application sent from the browser ends it.
  - Prompts take turns (cookie → language suggestion → invitation, `components/site/prompts.ts`),
    never during the loader; the WhatsApp button steps aside while one is up.
  - Application page: drawn goal tiles, a summary of what will be sent with a way back to each
    step, Enter moves on, a draft kept in the tab (never the health answers), FAQ below.
- v1.19 — **wide screens, sign-in, applications, rail**.
  - Pinned home sections carry `w-full`: GSAP copies the section's display (flex) onto our pin
    wrapper before measuring, and a flex item without a width shrank to its content (1440 px) —
    a sideways scrollbar and a cut-off plate on wide screens. Checked at 1996 px and after resizes.
  - Headline mask reaches 0.3em above and 0.22em below each line (the dot of a large İ and the
    tails of y/g/ş were cut).
  - The loader's boot script lives in a plain module (`components/motion/loader-boot.ts`) and is
    sent as raw HTML: imported from a 'use client' module it reached the server as a client
    reference, and React then created the `<script>` on the client (console error).
  - Dietitian sign-in on the portal's frame: the panel's name and drawn rings on the dark side,
    the site's fields, show/hide password, a Caps Lock note, a six-box code step, a link to the
    client sign-in.
  - Applications in the panel: a wide drawer read in call order — what they ask for, how to
    reach them (one-tap call / WhatsApp / email), goal, person (with BMI), health, their own
    words; every question listed, "Belirtilmedi" when unanswered. List rows and the dashboard
    show "6 ay · Online · goal".
  - Sidebar: 360 ms on a soft curve (still 60 fps at 4× CPU slowdown); collapsed, the expand
    button stands under the logo and the logo stays a link; rail icons at 82 % ink, short rules
    in place of group titles, no scrollbar on the rail.
- v1.20 — **data that arrives whole, motion that never hitches**.
  - jsonb on live projects: the postgres.js driver no longer encodes `json()` text a second time;
    old rows read correctly at once and migration …000008 repairs them (applications showed
    "Belirtilmedi" everywhere; recipe and guide saves failed their array checks).
  - Button status, one continuous mark: the label keeps its place (no width jump) and fades up;
    the mark rises into the exact centre; while loading an arc turns on a faint ring; on the
    answer the arc stops, closes into a full ring, and only then the tick (or cross) is drawn
    inside it. A result stays at least 1 s whatever the caller does (`useHeldState`).
  - Ink loader rebuilt on transform/opacity only — the ring is two half-rings turning behind
    their windows, the opening a shrinking ink disc, the blot a scaled wrapper — so the
    compositor plays it while the new page parses scripts and fonts (Arabic was the worst).
    Language switches skip the browser's cross-document view transition on both sides (the ink
    cover + loader are the transition) and catch its promises: no hitch, no console error.
- v1.21 — **loader polish, client cards, sidebar**.
  - The loader paints solid ink from its first frame (a plain background, nothing to rasterise
    late); the opening disc (now 150vmax) takes over only as the page opens — the occasional
    flash of the page behind is gone. Half-rings stay invisible until they turn (their resting
    ends showed as faint ticks at 12 and 6 o'clock).
  - Button wipes: the status swap passes the button's gap on, so the label sits exactly under its
    hover-wipe copy again (the ghosted double text on orange buttons).
  - Client cards: avatar with unread count, portal dot, weight with a chip coloured by direction
    against the client's own goal, the last eight weigh-ins as a sparkline, a goal meter, and
    chips for the next appointment, the age of the last measurement (amber after 21 days) and
    missing consent. Application goals are stored as words, not codes.
  - Sidebar: 28 px icon tiles (centred on the rail too); the selected item gets an accent tile, a
    soft pill and a start-edge bar that glide together; section titles are small tracked caps
    with a hairline that narrows into the rail's separator — one element changing shape.
- v1.22 — **home details in motion**.
  - Hero rail as a margin note: "01 — Mutfak", a scroll cue (a light running down a hairline, the
    hint set vertically beside it), and the plate's split as three bars in the plate's colours
    that fill after the headline (paused under the loader, like the headline).
  - WhatsApp button: the label opens to its measured width on one decelerating tween and fades
    in; a spring overshot the width and settled back — the hitch at both ends.
  - Wipe buttons: the copy's arrow slides with the label's own (same curve and time), so the
    old-coloured arrow never peeks out while the colour sweeps across.
  - Example week, front: the day as a plate — its energy split in the hero's three rings drawn in
    on view, the day's kcal in the middle, meal dots (the shown meal filled), the main meal, the
    split as one line, and a lift with the flip icon turning on hover. The back is unchanged.
  - Process stepper: a node per step on one line — done steps filled with a drawn tick, the
    current ring filling with its share of the scroll and a soft pulse, the rest with their
    number; open circles take the section's colour so the line never shows through.
  - The stepper runs the rail's full height (lines outside the list, so they meet every node);
    tick and number share one cell and only fade/scale — nothing slides in from below; the step
    summary under the title is gone (it repeated the column beside it).
  - Kinetic headlines: each word has its own clip-path window (wide enough for the İ dot, tails
    and italic overhangs) and letters start 175 % down — no tips show before they rise, on any
    page or language.
- v1.23 — **tags, a ledger, and time**.
  - Site menu: the wipe is one number (`--wipe`, 100 → 0) and the clip-path is built from it, so
    closing mid-opening turns round from where it is (the clip-path string could not be
    interrupted: it jumped shut and waited).
  - Page scrollbar (site): thin ink thumb on paper, the same bar as the recipe filter list.
  - Section tags (`SectionTag` in `components/site/section.tsx`): "06 — Örnek hafta" is a pill
    with the number in a round chip. Green (citrus chip) on paper, paprika (ink chip) as the warm
    alternate on paper, cream (green chip) on ink / green; the pinned process section swaps with
    its surface. Looks like a button, is none: no pointer, no hover. Long names wrap inside it.
  - Admin date filter (`DateFilter` / `useDateRange`, `lib/admin/date-range.ts`): all time ·
    today · 7 days · 1 month · 3 months · 1 year, in the practice's calendar. On requests and
    clients (added), programmes and content lists (last changed), the client's ledger and the
    payments page (paid on).
  - Payments page (`/admin/payments`, "Muayenehane"): every client's payments grouped by month
    with the month's total; received / count / still owed as three figures that follow the
    filters; date, method and name filters; CSV of what is shown (made in the browser); open
    packages with a balance, each with "Ödeme al" (client, package and amount preset). Recording
    here picks the client first.
- v1.24 — **one sidebar motion for both panels** (taken from the client's other product).
  - Width: 500 ms on a soft spring (`cubic-bezier(0.25, 1.1, 0.4, 1)`). The page beside the
    sidebar follows the real width on every frame — cards narrow and widen with it (this replaces
    the slide-along of v1.16).
  - Inside: nothing is mounted or unmounted. Item labels, counts, the brand name, the demo note
    and the account line fade in place over the same 500 ms (`SIDEBAR_FADE`: opacity, then
    visibility); section titles close their height so the items move up; icons sit in fixed cells
    and never move.
  - Toggle: a chevron. Expanded, it stands at the end of the brand row and points to the edge;
    on the rail a row opens under the logo with the chevron that expands. The logo stays a link.
  - Client portal: the side rail is now collapsible in the same way (288 ↔ 84 px, numbers and
    names fade, an unread dot moves onto the icon), with Ctrl/⌘+B and a cookie
    (`portal_sidebar`) so the server renders the right width.
- v1.25 — **the dashboard as a grid of standard cards; a quieter, clearer sidebar selection**.
  - Sidebar: the selected page is a soft raised tile with its label and icon in the accent
    (brand green by day, citrus by night) and a short bar on the edge — no dark icon tile. Section
    titles are plain small caps captions (no hairline); on the rail their height closes.
  - Dashboard sizes: small = the four headline numbers; medium = a third of the row; large = two
    thirds. Tablets: half / full; phones: one column at natural height. Every row has one height
    (31 rem for the day's work — agenda, tasks — 25.5 rem otherwise); a card with more than fits
    scrolls inside itself under its sticky title (`.dash-card`).
  - Headline cards: the section's icon, the number, its change, and a small chart — a line for a
    running total, columns for a count per period (the current period in full colour).
  - Charts with a time filter at the top end of the card: clients (3 / 6 / 12 months, area),
    requests (4 / 8 / 12 weeks, columns), attendance (1 month / 3 months / 1 year, ring).
  - Rings: client mix by status and appointment attendance (came / no-show / cancelled) — parts
    drawn in turn with a surface gap, the total in the middle, a legend with names, counts and
    shares (never colour alone).
  - Small charts follow their card on every frame of a resize: the sparkline is stretched by the
    browser (viewBox + non-scaling stroke) and wipes in; nothing is measured or redrawn in JS.
- v1.26 — **tabs in the panel; section titles on the other product's transition**.
  - Tabs (desktop, `components/admin/tabs-bar.tsx`): a strip above the page in the sidebar's
    colour; the selected tab takes the page's colour with two concave corners, so it reads as
    part of the page. A tab is a URL: moving around changes the active tab, switching tabs goes
    back to where that tab was. "+" opens a tab on the overview and, on hover, offers every
    section ("Hızlı aç"); × / middle click / Delete close; right-click: close, close others,
    close after / before; "…": new tab, close all others. Tabs can be dragged into another
    order, are capped at 12 and kept in localStorage. Pages below a section are named by their
    heading (a client's name). The strip stays put through page cuts. Phones and tablets keep
    the dock.
  - Sidebar section titles: height, opacity, bottom margin and side padding close together over
    500 ms ease-in-out — value for value the other product's transition (the caption slides in
    from the edge as it opens).
  - Night theme: the filter pills take the panel's colours (they were left on the site's paper).
- v1.27 — **a quieter panel: smaller filters, charts that follow their card**.
  - Filters: the panel's pill strips are a step smaller (32 px tabs); search fields 36 px. The date
    filter is one small button that names the range and opens the six choices (it fills with the
    accent while a range other than "all time" is on) — it no longer takes a row of its own.
  - Dashboard hero: the same content in less height (smaller greeting, tighter rows, a smaller
    countdown ring).
  - Charts (`components/admin/fluid-chart.tsx`): every trend chart in the panel — dashboard and
    client profile — is laid out by the browser alone (a stretched SVG line with non-scaling
    strokes, CSS columns, labels and dots in percent). Nothing is measured or redrawn in JS, so a
    chart follows its card on every frame while the sidebar moves or the window is resized. Goal
    line, units, gaps in the data and the hover read-out are kept; the numbers stay available as
    a table.
- v1.28 — **one-row filters, a search that opens, glass menus**.
  - Search (`SearchPill`): at rest a 32 px round button with a magnifier, the same pill as the
    filters beside it; pressed or focused, the writing space grows out to the end side (300 ms,
    the sidebar's spring). It stays open while it holds text; Escape or its × clears it. Used on
    clients, payments and foods.
  - Clients filters on one row: search · status · date, and at the end the view as two icons
    (cards / table) and the archive as one switch with its count.
  - Menus (`.a-glass`: language, account, date range, tab menus, "quick open"): frosted glass —
    the page shows through, blurred and a touch richer, a bright rim on the top edge, a soft deep
    shadow; rows highlight as a translucent pill. Falls back to the plain surface where backdrop
    blur is not available.
- v1.29 — **search as a filter pill, stronger glass, plain figures**.
  - Search (`SearchPill`, replaces v1.28's round button): the filter strip's own selected pill —
    dark, a magnifier and "Ara" — sitting in the strip's track; pressed, the track grows out to the
    end side and is the writing space.
  - Glass (`.a-glass`): the sheen is in the panel itself (light caught at the top-left corner, a
    bright rim, a faint citrus refraction at the far corner), so it reads as glass over a plain
    page too. Also on the command palette, recipe suggestions and chart read-outs.
  - Figures in the panel: the text face with tabular figures and a plain zero; the mono face (a
    stroke through every 0) is no longer used for numbers there.
- v1.30 — **the panel in one face; a narrower sidebar; a tidier greeting**.
  - Type: the panel has no editorial serif — page titles, the greeting and the brand are the text
    face, bold. Figures everywhere (site, portal, panel) are the text face with tabular figures;
    the mono face is no longer used for numbers (its zero carries a stroke).
  - Sidebar: 214 px open (15 % narrower). The selected page is back to the dark icon tile in a
    soft rounded pill with the edge bar (v1.21), replacing v1.25's tinted tile. "Özet" is a house.
  - Greeting card: what is waiting (appointments, unread, attention) as icon + count, then the
    shortcuts as round icon buttons — one row; each shows its name on hover or focus.
  - Command palette: a slim rounded scrollbar set in from the edge, no track, no arrows.
- v1.31 — **following a client: files, messages, movement**.
  - Messages page: two panes — conversations (search, all / unread / with files, unread first)
    and the chosen thread with the client at a glance (last weight, next appointment), shortcuts
    to tracking / diary / labs / the client's file, and the files exchanged so far. Phones show
    one pane at a time. A new conversation starts from a client picker.
  - Threads (panel and portal): day dividers, a paperclip in the composer, a file shown in place
    — a picture as itself, a PDF as a card with name and size. PDF or photo, 10 MB.
  - The client's "Dosyalar" tab lists what was exchanged in messages, with a way to the labs tab.
  - Check-in: movement — minutes as quick picks, then what it was; in the panel under "Takip" as
    the week's minutes and a column per day.
  - Greeting card: names of the icon buttons are real tooltips (their own layer, under the
    control) — the card no longer clips them.
  - Dashboard cards: one header height; an empty card says so in its middle.
  - Money: Turkish lira is written "1.500 TL" (the ₺ sign fell back to a glyph that read as
    another currency).
  - (revised) Greeting card: the icon row stays; its names are the cream label again (the dark
    one read worse), shown UNDER the control as a real tooltip, so the card cannot clip it.
  - Client sign-in page: a signed-in dietitian who opens it sees it, with a note and a way back,
    instead of being sent to the panel.
- v1.32 — **the client's Today page, alive; the dietitian within reach**.
  - Opener: the greeting on a dark card with the day's ring — how much of today's record is
    filled in (water, energy, habits, movement, planned meals; only what can be done today
    counts, `dayScore` in `lib/portal/logic.ts`, unit-tested) — each part as a bar that fills, the
    streak as a chip, and four doors (add a meal, ask a question, my plan, my progress).
  - Dietitian card: who they are, what they last said, an answer typed right there, a lab report
    or file sent in one tap, "send my week" (the last seven days as a note: days recorded, average
    water, movement, weight — `weekDigest`), and the next meeting with "add to calendar" (an .ics
    file made in the browser).
  - Last 7 days: a column per day — a glass that fills with the day's water, the date filled when
    the day was recorded, minutes of movement; each opens its diary.
  - The dietitian's programme note is shown on Today when there is one.
  - Rail: today's ring and streak under the navigation (the same number as the page), the next
    meeting above the account; both fade to icons on the collapsed rail.
  - Phone / tablet / laptop: one column, then two from 1024 px; no sideways scroll (tested at
    390, 820 and 1366 px).
  - Figures (everywhere): proportional lining figures. The text face's tabular feature also
    widened the punctuation between figures ("10 : 00", "1 . 800").
- v1.33 — **the portal fills the screen; what the dietitian shares reaches the client**.
  - Width: portal pages use the screen (up to 1680 px; text pages 56 rem). Today is one column on
    phones, two from 1024 px, three from 1536 px.
  - Sidebar: the dietitian panel's primitive in the portal's colours — 214 ↔ 60 px, the same
    spring, fading labels, closing section titles ("Takip", "İletişim"), the chevron toggle and
    the row under the logo. Today's ring sits under the navigation.
  - Tasks: a task the dietitian shares ("Danışan da görsün") shows on Today with a tick the client
    draws; the dietitian's list says "Danışan görüyor" / "Danışan tamamladı".
  - "Randevu ve ödemeler" (`/panel/care`): the next appointment as a green card with a date
    block and "Takvime ekle", the rest as rows; past ones with their outcome; the package with a
    session track, price / paid / left; the payments.
  - Welcome: a citrus card for the first days — what the portal is for and three steps — closed
    for good with its button.
  - Tools: the site's calculators, recipes, shopping list and guides, in the client's language.
  - Messages: one-tap openers above an empty composer ("Bir sorum var:", …).
  - Panel, "Takip": "Programa uyum (7 gün)" — planned meals that were logged.
- v1.34 — **the day's record redrawn; a guide in both panels**.
  - Check-in: five tiles (water, habits, energy with weight beside it, movement) in a container
    grid — one column when the card is narrow, two from 42 rem. A row of marks under the title
    fills in as tiles are done. After each save the page's own figures (ring, week, rail) refresh.
  - Water: the row of eight glasses is gone. A tank that fills on a spring with light moving
    through it, the litres in large figures, what is left to the goal, and two buttons —
    "Bardak 250 ml" and "Şişe 500 ml" — plus one to take a glass back. A cell of the tank sets
    the level directly.
  - Habits are rows with a tick that draws; energy is five steps with a mark that slides; movement
    has a ±5 min stepper beside the quick picks; weight has ±0.1 kg and shows the last entry.
  - "Programında bugün" is a line through the day: eaten meals filled, the next one picked out
    with the filled button, a bar with n/total on top. The week strip has a legend.
  - Guide (`/panel/help`, `/admin/help`; components/guide): a topic per page; each a schematic of
    the screen (blocks, not screenshots — they hold in four languages and both themes) with
    numbered pins and the same numbers as steps. The step being read lights its pin; left alone
    the steps walk. Always in the menu (and the panel's command palette and tab menu); portal
    pages carry "Bu sayfa nasıl kullanılır?" which opens their own topic; the welcome card links
    to it, so closing the card loses nothing.
- v1.35 — **the portal in the panel's shape; a guide made of real pictures**.
  - Type: the portal has no Didone any more — headings are the text face, bold (as decided for the
    dietitian panel). Arabic keeps its own faces. The sign-in pages are unchanged.
  - Cards: one card (`.p-card`, `PortalCard`): a thin outline, 18 px radius, a surface a shade
    lighter than the page, a 54 px title row with the action at its end, a hairline, the body.
    The day's record, the dietitian, tasks and tools all use it.
  - Today grid, three sizes as in the panel: large (8/12), medium (6/12), small (4/12) from
    1280 px; two columns on tablets with the large ones across both; one column on phones. Row 1:
    the day's record (large) beside the dietitian with "today's food" under them (small). Row 2:
    the plan (large) and the week (small). Then tools (large), tasks and the note (small).
  - Greeting: the panel's ink card — the greeting rising word by word, one row of small controls
    (streak, unread, open tasks with counts; then diary, plan, progress, guide as icons) each
    naming itself under the control, and the day's ring with its parts at the end.
  - Sidebar: Takip gains "Haftalık özet"; İletişim gains "Dosyalarım"; a new group Araçlar:
    "Alışveriş listesi" and the site's calculators and recipes in the client's language.
  - New pages: `/panel/week` (six figures for the last seven days, the strip, a day-by-day
    table), `/panel/files` (files sent and received, out of the conversation), `/panel/shopping`
    (the programme's foods once each, by chosen days, with ticks kept in the browser).
  - Guide: every topic now shows a real picture of the page (`scripts/guide-shots.mjs`, from the
    local demo data) in the reader's language — and theme, in the panel — with the step numbers
    pinned on the controls they are about; positions are measured on the page at capture. On
    phones the picture pans to the step being read. The schematic remains only as a fallback.
  - First visit: a small card in the corner offers the guide once (both panels); it does not
    cover or block the page.
- v1.36 — **the panel gets depth; the dashboard opens on one card** (Core 2 denemesi).
  - Planes: three of them, as tokens — the page, a card that floats on it (`.a-card`: a hairline
    ring plus a layered shadow instead of a border, 22 px radius), and a well recessed into the
    card (`.a-well`) holding the things you switch between, with the chosen one lifted out of it
    (`.a-raised`). Night has its own shadows and a faint top light on the ring.
  - Every dashboard card takes the same plane, whatever drew it (`.dash-card > section`), so the
    hero, the headline numbers and the panels read as one set of objects.
  - Opening row: "Genel bakış" (`dashboard/overview.tsx`) — active clients and this week's
    appointments as two big tiles in a well; picking one slides the mark, lifts the tile and
    swaps the chart under it, each tile keeping its own range (3/6/12 months, 4/8/12 weeks).
    Beside it the four headline numbers, 2×2 from laptops, one row of two on phones.
  - Direction is coloured only here, where a rise is unambiguously good (clients, appointments);
    the small cards keep the neutral pill, because more requests is not "green".
  - Phones: the two tiles stay side by side but stack label / number / change inside themselves.
  - The plane spreads to the rest of the panel: every page-level card — the shared `Panel`, the
    chart card, the lists and tables (clients, leads, recipes, foods, appointments), the client
    profile's sections, the programme builder's panes, the message panes, the stat and money
    figures — is now `.a-card`. What sits inside a card sinks instead of floating again: the
    clinical tiles on the client overview and the blocks in a lead's details are `.a-well`.
  - Cards that used to answer the pointer by changing their border now lift instead (a small rise
    and a deeper shadow, fine pointers only).
- v1.37 — **the portal takes the same planes; nothing clips a ring or a shadow**.
  - Portal: `.p-card` is now the floating plane (ring + layered shadow, 22 px), `.p-well` the
    recessed one (the five tiles of the day's record, a package inside its card), `.p-lift` the
    hover. Diary, progress and care pages use them.
  - Clipping: a box that scrolls or hides overflow cuts whatever leaves it. The explorer's rail of
    initials and the sliding card / week wrappers carry their own room (padding taken back with a
    negative margin); tabs draw their focus ring just inside the control.
- v1.38 — **one colour for both panels; the portal earns its place**.
  - Portal page and sidebar take the dietitian panel's colours (#f3eee4 page, #fbf8f1 sidebar and
    cards), flat — the grain stays on the public site. Every portal page uses the screen width.
  - Sidebar (both panels): the selected page keeps its pill and bar; the dark tile behind its icon
    is gone.
  - Programme: an opener for today — the next meal with a countdown, the day's meals as a line
    that fills as they are logged, the day against its targets, the programme's days as columns.
    Without a programme: what happens next, in three steps.
  - Progress: the way to the goal (start / now / goal, a marker that travels, recent pace and the
    date that pace arrives at — a direction, labelled as such) and eight milestones read from the
    entries (`lib/portal/insights.ts`, unit-tested).
  - Care: a rolling countdown to the next meeting and a preparation list kept in the browser.
  - Messages: beside the thread on wide screens — who it is with, the next meeting, the latest
    files, what one can write about.
- v1.39 — **night in the portal; one cut everywhere; the last round of checks**.
  - Portal night theme: the dietitian panel's night colours. The portal is written in the site's
    ink / paper tokens, so the theme swaps what those tokens mean (`html[data-surface=portal]
[data-theme=dark]`); blocks dark by design (`.on-dark`) and the bright accent fills get the
    day values back inside. The switch is in the sidebar and on the account page; the choice is
    a cookie (`portal_theme`) read by the layout, so there is no flash.
  - Page changes in the portal: a skeleton while the next page loads (`app/panel/(app)/
loading.tsx`) and the panel's knife cut when the path changes, the sidebar and the phone
    bars staying put.
  - Sign-in pages: the panel's text face and flat page; the links to them play the cut by hand in
    two halves across the page load (`components/ui/plain-link.tsx`, the `cut` cookie).
  - Sheets keep mounted so their closing animation plays; the "new conversation" list is the
    panel's frosted-glass menu.
  - A view transition is never requested while the tab is hidden (the browser refuses it).
- v1.40 — **the theme circle always opens from the sun / moon**.
  - One rule for every theme control in the portal (`glyphCentre` in components/portal/theme.tsx):
    the circle opens from the middle of the sun / moon drawn inside the control that was pressed
    — never from the pointer, so it is the same spot wherever the press lands, and with the
    keyboard. The account page's two choices used the pointer; that was the "sometimes".
  - The switch is also where it is seen: the greeting card's icon row, every page header, and
    the top bar on phones — besides the sidebar row and the account page.
  - The old screen is no longer dimmed (it left a grey corner as the circle closed) and nothing
    eases between the two palettes while the theme changes.
  - A box that hides its overflow can still be scrolled by the browser when a control inside it
    is focused; its contents then sit displaced. The dark cards that cut off oversized
    decoration (greeting cards in both panels, the programme's "next meal", the sign-in panel,
    the spotlight cards) now use `overflow: clip`, which cuts the same way and cannot scroll.
  - `e2e/admin/portal-theme.spec.ts` presses each control off-centre and with the keyboard and
    compares the circle's centre with the sun / moon at the moment of the press.
  - A hydration error on the theme drawing (the server's HTML without `data-theme-glyph`) was
    not in the code: the dev server had restored an older compilation from its disk cache. The
    dev cache is off now (next.config.ts) and `e2e/admin/portal-theme.spec.ts` loads every
    portal page in both themes and fails on any console error.
