---
name: Verifikasi Pemain
description: A focused yellow-and-paper system for explicit, visible player verification.
colors:
  charcoal-ink: "#211b08"
  muted-ink: "#6d6758"
  warm-line: "#ded9ca"
  paper: "#fffef9"
  canvas: "#f4f1e7"
  signal-yellow: "#f5b700"
  consent-yellow: "#fff2bc"
  success-green: "#16784b"
  error-red: "#b42318"
  field-white: "#ffffff"
typography:
  display:
    fontFamily: "Archivo Black, Impact, sans-serif"
    fontSize: "clamp(42px, 6vw, 74px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 750
    lineHeight: 1.55
rounded:
  status: "11px"
  control: "12px"
  inset: "14px"
  surface: "18px"
  pill: "999px"
  circle: "50%"
spacing:
  compact: "12px"
  field: "18px"
  section: "28px"
  panel: "30px"
components:
  button-primary:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  text-input:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.control}"
    padding: "13px 14px"
  form-surface:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.surface}"
    padding: "28px 30px 30px"
  disclosure:
    backgroundColor: "{colors.consent-yellow}"
    textColor: "{colors.charcoal-ink}"
    rounded: "{rounded.inset}"
    padding: "15px 16px"
---

# Design System: Verifikasi Pemain

## Overview

**Creative North Star: "The Visible Verification Desk"**

The system feels like a clear, staffed verification desk translated to a phone: warm paper surfaces, charcoal type, a single yellow signal color, and every permission-sensitive state kept plainly visible. It is practical and reassuring rather than decorative, with the display face providing confidence while compact system typography handles instructions and status detail.

The interface stays focused on one consent-led task. Rounded controls and restrained ambient depth soften the process, while the step rail, live camera bay, and semantic feedback make progress observable from identity entry through delivery result.

**Key Characteristics:**

- Warm paper and canvas neutrals anchored by charcoal ink.
- Signal yellow reserved for identity, consent, and primary progress.
- Heavy, tightly set Archivo Black display type paired with compact system text.
- One continuous verification rail with explicit live, error, and success states.
- Responsive two-column composition that becomes a single mobile stack.

## Colors

The palette is warm, high-contrast, and deliberately narrow; yellow directs attention while green and red communicate completion or recovery.

### Primary

- **Signal Yellow** (`{colors.signal-yellow}`): Marks the brand tile, active progress, checkbox accent, and primary action.
- **Consent Wash** (`{colors.consent-yellow}`): Holds the collection disclosure without competing with the main action.

### Neutral

- **Charcoal Ink** (`{colors.charcoal-ink}`): Carries headings, controls, and primary reading text.
- **Muted Olive Gray** (`{colors.muted-ink}`): Carries explanations, privacy notes, and secondary status copy.
- **Warm Line** (`{colors.warm-line}`): Separates fields, panels, and inactive progress.
- **Paper White** (`{colors.paper}`): Defines elevated verification surfaces and step markers.
- **Oat Canvas** (`{colors.canvas}`): Grounds the page behind the verification task.
- **Field White** (`{colors.field-white}`): Keeps editable fields visibly distinct from the paper surface.

### Semantic

- **Verified Green** (`{colors.success-green}`): Marks completed steps and successful delivery.
- **Recovery Red** (`{colors.error-red}`): Marks invalid fields and actionable submission failures.

### Named Rules

**The One Signal Rule.** Yellow is the sole attention color for identity, consent, active progress, and primary action; it is not general decoration.

**The Visible State Rule.** Permission, capture, error, and completion states must be explicit in both color and text.

## Typography

**Display Font:** Archivo Black (with Impact and sans-serif fallbacks)  
**Body Font:** System sans serif (Apple system, Segoe UI, then sans-serif)

**Character:** The display face is blunt, compact, and confident. System text stays neutral and readable so instructions, consent language, and recovery messages never feel branded past the point of clarity.

### Hierarchy

- **Display** (`{typography.display}`): One short page thesis, tightly tracked and constrained to a narrow measure.
- **Headline** (`{typography.headline}`): Form and result headings that establish the current task state.
- **Body** (`{typography.body}`): Introductory guidance; the primary reading measure stays near 30rem.
- **Label** (`{typography.label}`): Field labels, step details, badges, disclosures, and status copy; weight supplies hierarchy at compact sizes.

### Named Rules

**The One Display Moment Rule.** Archivo Black belongs to the page thesis only; operational copy remains in the system face.

## Layout

The desktop shell is centered at a maximum width of 1080px with 32px total horizontal breathing room. Its first viewport uses an asymmetric two-column grid: the task context occupies the narrower 0.85fr column, the verification surface occupies the wider 1.15fr column with a 420px minimum, and a 72px gap keeps explanation separate from action. The context column remains sticky 28px from the top while the form continues vertically.

At 820px and below, the shell narrows to a maximum of 560px with 24px total horizontal breathing room. The columns stack with a 26px gap; the progress rail rotates from a vertical sequence into three equal horizontal steps, hides supporting step descriptions, and the form's side padding contracts from 30px to 20px. Display type scales down with the viewport while retaining its compact measure.

Spacing follows the extracted compact, field, section, and panel rhythm in frontmatter. Form groups use 18px separation, major internal sections cluster around 28px, and the card's side insets use 30px on desktop.

## Elevation & Depth

Depth is restrained and structural. The paper verification surface receives one broad warm ambient shadow, while the yellow brand tile gets a tighter local lift. Inputs use narrow color-tinted focus rings for state rather than decorative elevation; other surfaces remain flat and are separated by tone or a warm one-pixel border.

### Shadow Vocabulary

- **Surface Ambient** (`0 24px 70px rgba(45, 36, 8, 0.12)`): Lifts the complete verification surface from the oat canvas.
- **Brand Tile Lift** (`0 8px 20px rgba(45, 36, 8, 0.16)`): Gives the compact yellow identity mark a localized tactile presence.
- **Yellow Focus Ring** (`0 0 0 3px rgba(245, 183, 0, 0.2)`): Makes active identity fields visible without shifting layout.
- **Red Error Ring** (`0 0 0 3px rgba(180, 35, 24, 0.1)`): Reinforces invalid fields alongside error text.

### Named Rules

**The Structural Shadow Rule.** Shadow belongs only to the principal task surface, the identity mark, and active field state; use borders and tonal fills everywhere else.

## Shapes

The form language uses precise, medium-radius rectangles with circular state markers. Inputs and buttons share the control radius (`{rounded.control}`); disclosures and the camera bay use the larger inset radius (`{rounded.inset}`); the outer task surface uses the surface radius (`{rounded.surface}`). Status strips use the slightly tighter status radius (`{rounded.status}`), camera badges use the pill radius (`{rounded.pill}`), and progress or success markers use the circle token (`{rounded.circle}`). Borders are thin and warm, never heavy or ornamental.

## Components

### Buttons

- **Shape:** Full-width, compact rounded controls using `{rounded.control}`.
- **Primary:** Signal yellow with charcoal text, 14px by 16px padding, and weight 800.
- **Hover / Focus / Active:** Hover slightly darkens through brightness, active compresses to 98.5%, and keyboard focus receives a three-pixel charcoal outline with offset. Reduced-motion preferences remove transitions.
- **Disabled:** Keeps the same structure at 45% opacity with a not-allowed cursor.
- **Secondary:** Transparent with a warm one-pixel border and weight 700; used for the post-success reset action.

### Cards / Containers

- **Corner Style:** The main paper surface uses `{rounded.surface}` and clips its header/body boundary.
- **Background:** Paper white over the oat canvas.
- **Shadow Strategy:** One broad Surface Ambient shadow only.
- **Border:** The form header is separated by one Warm Line divider.
- **Internal Padding:** 28px to 30px on desktop, with 20px horizontal padding on mobile.

### Inputs / Fields

- **Style:** Field White fill, Warm Line border, charcoal text, `{rounded.control}`, and 13px by 14px padding.
- **Focus:** A darker yellow border and the Yellow Focus Ring.
- **Error:** Recovery Red border and ring plus an 11px written recovery message; color never carries the error alone.

### Verification Steps

The three-stage rail connects circular markers with a one-pixel Warm Line. Active markers fill with Signal Yellow; completed markers fill with Verified Green and replace their numeral with a check. The rail is vertical with supporting copy on desktop and becomes an equal three-column sequence on mobile.

### Disclosure & Consent

The disclosure is a soft yellow inset panel with compact, high-legibility copy. The consent checkbox sits immediately after it, uses the same yellow accent, and precedes any camera activation control.

### Camera Bay

The live media area is a dark, clipped 4:3 bay. Video and frozen canvas fill the same geometry and mirror horizontally. A pill badge overlays the upper-left corner with a pulsing red live dot; when capture is complete the dot turns green and stops moving.

### Status Messages

Status strips use compact rounded geometry and explicit written feedback. Neutral status uses a warm gray fill, errors use a pale red fill with Recovery Red text, and success uses a pale green fill with Verified Green text.

## Do's and Don'ts

### Do:

- **Do** keep the verification task on one continuous visible rail from consent through identity, live capture, and result.
- **Do** use Signal Yellow for the active or permission-relevant action and Verified Green only after completion.
- **Do** keep the camera preview and capture count visible while photos are being collected.
- **Do** preserve written state labels and recovery messages alongside semantic color.
- **Do** stack the context, progress, and form into one focused mobile column at the established breakpoint.

### Don't:

- **Don't** introduce administrator receipt controls or unrelated tooling into the player visual system.
- **Don't** activate or imply camera capture before the disclosure and consent control are visible.
- **Don't** distribute Archivo Black across labels, instructions, or status messages.
- **Don't** add multicolor or high-contrast gradients, extra accent colors, or ornamental shadows that overpower the existing soft yellow canvas wash.
- **Don't** hide capture state, submission state, or failure recovery behind color alone.
