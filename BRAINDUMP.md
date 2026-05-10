braindump.md

Scroll Down MLB — Phase: Broadcast Machine / Spatial Cohesion Pass

We crossed the “prototype” threshold.

The system now:

* reconstructs games correctly
* preserves leverage and emotional beats
* has a coherent field grammar
* has motion persistence
* has trajectory language
* has pacing logic
* has regression coverage against real games

The next phase is NOT “more features.”

The next phase is:

cohesion, readability, emotional framing, and broadcast identity.

Right now the app still feels like:

* a beautiful rendering engine sitting inside a developer tool
    instead of:
* a finished sports viewing product.

The visual primitives are strong.
The product layer around them is still underdeveloped.

This phase should focus on:

1. spatial hierarchy
2. cinematic readability
3. emotional framing
4. scoreboard clarity
5. reducing “debug UI energy”
6. making the experience feel intentional and premium

⸻

Core Problem Statement

The field itself is now compelling.

But:

* the surrounding UI still feels temporary
* too many things compete visually
* cards don’t breathe enough
* the field sometimes feels “boxed in”
* information hierarchy is inconsistent
* some motion paths still feel synthetic instead of baseball-native
* the app lacks a strong “broadcast identity layer”

The current experience is:
“cool technical demo”

The target is:
“minimalist late-night baseball reconstruction machine”

⸻

PRIMARY PHASE GOALS

Goal 1 — The field becomes the unquestioned focal point

Currently:

* the field sits inside a bordered panel
* surrounded by equal-weight UI blocks
* making everything feel flat

The field should dominate attention.

Changes

Remove “panel thinking”

Stop treating:

* scoreboard
* field
* captions
    as equal cards.

Instead think:

* FIELD = stage
* score/header = instrumentation
* captions = narration layer

The field is the emotional core.

⸻

Goal 2 — Build a stronger broadcast composition

Current layout:

* feels centered
* but not composed

Need:

vertical emotional rhythm.

Target composition:

* thin instrumentation header
* dominant field stage
* restrained narration layer
* large surrounding darkness

Think:

* radar screen
* broadcast truck monitor
* MLB Tonight telestrator
* late-night replay package

NOT:

* dashboard
* sports app
* analytics panel

⸻

FIELD SYSTEM PASS

1. Canonicalize ALL line geometry

The user already identified this:

there are still two different foul-line angles.

This is a major issue.

The field must become:

mathematically canonical.

No hand-tuned geometry anywhere.

Requirements

Single source of truth:

* foul line angle
* base spacing
* mound offset
* outfield arc
* runner path curves
* trajectory launch anchors

No duplicated geometry constants.

Everything derives from:

FIELD_GEOMETRY

Every rendered primitive:

* basepaths
* arcs
* trails
* trajectories
* runner dots
    must resolve from this.

No exceptions.

⸻

2. Make the field feel more analog and less vector-perfect

Current issue:
the field is still slightly:

* too clean
* too mathematically sharp
* too “SVG app”

Need:

analog instability.

Subtle only.

Add:

* micro phosphor wobble
* slight line bloom inconsistency
* tiny brightness variance
* subtle edge breathing
* mild raster softness

NOT:

* fake CRT overlays
* scanline gimmicks
* VHS filters

Goal:
“expensive broadcast monitor”
NOT:
“retro filter pack”

⸻

3. Reduce geometric stiffness in trajectories

Some ball arcs still feel:

* too symmetric
* too idealized
* too software-generated

Baseball trajectories should feel:

* directional
* imperfect
* physically implied

Rules

Fly balls

* asymmetrical apex
* launch bias from contact side
* subtle drift

Ground balls

* flatter
* harsher
* lower glow
* faster collapse

Line drives

* violent
* low arc
* high velocity
* minimal persistence

Right now many trajectories share too much visual DNA.

Need:

pitch-class-level personality.

⸻

RUNNER / BALL SYSTEM PASS

1. Ball must become the protagonist

You already identified this correctly earlier.

The ball should be:

* brightest object
* fastest object
* intentional object

Right now the field occasionally dominates the ball.

That’s backwards.

Requirements

The ball should:

* overexpose slightly
* carry stronger bloom
* lead the eye
* imply force

Every play should visually answer:

“where is the ball?”

within:

* 200-300ms

⸻

2. Runner dots need emotional weighting

Right now:

* all runner dots feel too equal.

Need hierarchy.

Examples

Runner scoring

Should:

* bloom longer
* linger
* leave stronger persistence
* feel climactic

Routine advance

Should:

* be restrained
* quieter
* lower persistence

Double play

Should:

* feel mechanical
* sharp
* chained
* surgical

⸻

3. Add chained memory trails

This is the next major “feel engineering” win.

Especially for:

* double plays
* rundowns
* scoring sequences
* relay throws

The field should temporarily remember motion.

Not just:

* one moving object

But:

* the ghost of what just happened.

This is where the app starts feeling:

emotionally physical.

⸻

SCOREBOARD / INFORMATION PASS

Current issue

The top instrumentation block:

* still feels like UI
    instead of:
* broadcast instrumentation.

Need:

information compression.

⸻

1. Simplify scoreboard hierarchy

Reduce:

* borders
* chip noise
* equal-weight containers

Increase:

* spacing precision
* alignment consistency
* intentional typography rhythm

The scoreboard should feel:

* machine-readable
* calm
* authoritative

NOT:

* component library UI

⸻

2. Rework baserunner indicators

The current:

LOCKRIDGE 1B
RENGIFO 2B
VAUGHN 3B

reads too literally.

Need:

broadcast shorthand.

Potential direction:

* tighter chips
* more compressed labeling
* optional jersey-number style tags
* stronger relationship to field state

The field already shows occupancy.
The text layer should support, not duplicate.

⸻

3. Outs / inning instrumentation refinement

Current:

* visually readable
* emotionally weak

Need:

* stronger inning identity
* better leverage feeling
* more dramatic late innings

Example:
7th+ innings should subtly feel:

* denser
* hotter
* more consequential

without changing layout.

⸻

NARRATION LAYER PASS

Current issue

The narration area still feels:

* placeholder-ish
* under-integrated

Sometimes empty black rectangles appear too long.

Need:

narrative cadence.

⸻

Requirements

Empty states

Should:

* collapse more aggressively
    OR
* show subtle system-state messaging

Never:

* dead empty black box energy.

⸻

Narration typography

Need:

* calmer rhythm
* tighter line-height
* more cinematic pacing

Think:

* MLB recap subtitle card
    NOT:
* app feed item

⸻

Event labeling

Current:

SINGLE
RUN SCORES

is close, but still slightly generic.

Need:

* more hierarchy
* better pacing
* stronger event personality

Example:
A late-game RBI single should feel different from:

* 2nd inning routine single.

Not through color explosions.
Through:

* timing
* persistence
* staging
* typography weight
* reveal pacing

⸻

SPATIAL / LAYOUT PASS

Current issue

The experience is too narrow and boxed.

The black negative space is GOOD.
But the content container feels:

* constrained
* web-app-ish

Need:

stage composition.

⸻

Explore:

* slightly larger field
* thinner chrome
* less card framing
* more atmospheric spacing

The field should feel suspended in darkness.

⸻

HOME SCREEN PASS

The home screen is currently:

far behind the catch-up experience.

Right now it feels:

* default
* temporary
* plain web app

while the game viewer feels:

* stylized
* cinematic

Huge mismatch.

⸻

Requirements

Home should feel like:

* a replay deck
* a hidden-score archive
* a quiet control room

NOT:

* a sports scores page.

⸻

Remove generic list energy

Current:

* stacked white cards
* standard spacing
* standard buttons

Need:

* darker composition
* stronger hierarchy
* game cards with emotional weight
* hidden-score tension

The home screen should immediately communicate:

“this app reconstructs games.”

⸻

FIXTURE LAB / INTERNAL TOOLING

This now becomes critical infrastructure.

Build:

/admin/catchup-lab

Capabilities:

* fixture selector
* autoplay
* pacing speed
* toggle rhythm cards
* toggle trails
* debug overlay
* planner report
* selected vs omitted plays
* emotional pacing review

This is now required for:

feel engineering.

⸻

IMPORTANT PRODUCT DIRECTION

Do NOT:

* add betting
* add stat overload
* add social feeds
* add endless overlays
* add ticker clutter

The strength of this product is:

restraint.

The app is becoming:

* atmospheric
* cinematic
* spoiler-safe
* emotionally paced

Protect that.

⸻

Phase Success Criteria

This phase succeeds when:

Visual

* field geometry feels canonical
* trajectories feel baseball-native
* the ball visually leads the eye
* the field feels analog instead of vector-clean

Product

* home screen matches the emotional identity
* scoreboard feels broadcast-grade
* narration feels integrated
* empty states never feel dead

Emotional

* late innings feel tense
* scoring plays feel climactic
* boring games still feel intentional
* the app feels like a reconstruction machine, not a feed reader

Experiential

A user should be able to:

* open the app late at night
* watch a random game silently
* understand emotional momentum
* never see the final score
* feel like they “experienced” the game instead of reading it

That is the product.