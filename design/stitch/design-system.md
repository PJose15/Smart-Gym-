---
name: NEXTERA
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#e7bdba'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#ad8885'
  outline-variant: '#5d3f3e'
  surface-tint: '#ffb3af'
  primary: '#ffb3af'
  on-primary: '#68000e'
  primary-container: '#e0142f'
  on-primary-container: '#fff5f4'
  inverse-primary: '#bf0023'
  secondary: '#ffb3b0'
  on-secondary: '#680010'
  secondary-container: '#e40430'
  on-secondary-container: '#fff6f5'
  tertiary: '#ffb3b1'
  on-tertiary: '#680011'
  tertiary-container: '#ca4046'
  on-tertiary-container: '#fff6f5'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad7'
  primary-fixed-dim: '#ffb3af'
  on-primary-fixed: '#410006'
  on-primary-fixed-variant: '#930018'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b0'
  on-secondary-fixed: '#410006'
  on-secondary-fixed-variant: '#93001b'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b1'
  on-tertiary-fixed: '#410007'
  on-tertiary-fixed-variant: '#8e1120'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
  bg-card: '#16161A'
  bg-elevated: '#121214'
  text-secondary: '#B5B2B8'
  gold: '#E8B339'
  energy-ribbon: 'linear-gradient(135deg, #FF2740, #8A0D1E)'
typography:
  wordmark:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.12em
  hero-lg:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: 0.02em
  headline-h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  stat-display:
    fontFamily: JetBrains Mono
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: -0.03em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  sub: 4px
  gutter-mobile: 16px
  gutter-desktop: 24px
  section-gap: 32px
  hero-margin: 64px
---

## Brand & Style

The design system embodies a **Cinematic Red-Luxury** aesthetic, positioning itself as a high-performance telemetry tool rather than a conventional fitness app. It evokes the atmosphere of a premium, darkened gym floor lit by the emissive glow of advanced machinery.

The brand personality is disciplined, elite, and scientific. It targets serious athletes who demand precision and a "Flow State" environment. The visual style is a fusion of **Minimalism** and **Glassmorphism**, using extreme dark mode contrasts and additive light (glows) to simulate a futuristic dashboard.

**Key Visual Principles:**
- **The 90-Second Loop:** Design for speed; interactions must be rapid to allow athletes to return to their set.
- **Emissive UI:** Light is treated as energy. Elements don't just sit on the screen; they hum with readiness.
- **Editorial Sophistication:** Use high-contrast serif typography to signal a "Premium/Luxury" tier, differentiating from "Standard/Corporate" competitors.

## Colors

The palette is built on a "Near-Black Canvas" hierarchy. Chromatic color is strictly reserved for "Energy" and "Action," never for background fillers.

- **Canvas:** The primary background is `#0A0A0C`, providing a void-like depth that allows red accents to "pop" with cinematic intensity.
- **Crimson Signature:** The primary brand color is a deep crimson (`#E0142F`). For interactive peaks or critical data, use the "Glow" variant (`#FF2740`).
- **Gradients:** Use the "Energy Ribbon" gradient for hero states and decorative card accents, blending the bright glow into the deep oxblood base.
- **Status Tints:** Success, Warning, and Info colors are present but desaturated compared to the primary Red to maintain brand dominance.

## Typography

This system employs a strategic tri-font hierarchy to balance luxury with technical utility.

1.  **Editorial Serif (Playfair Display):** Reserved for brand moments, large headlines, and marketing "hooks." It adds an air of prestige and timelessness.
2.  **Geometric Sans (Inter):** The workhorse for UI. It ensures legibility in high-stress environments (the gym floor) and maintains a modern, clean interface.
3.  **Technical Mono (JetBrains Mono):** Used exclusively for quantitative data—weights, reps, timers, and timestamps. The fixed-width nature prevents layout shifting during rolling number animations.

**Scaling Note:** On mobile, Editorial Hero sizes should drop to 32px to ensure wordmark integrity. Body text remains at 15px for optimal density.

## Layout & Spacing

The system follows a strict **8px grid** with a **4px sub-step** for fine-grained internal component spacing.

**Layout Model:**
- **Mobile:** Single column fluid with 16px side margins. Use 16px vertical padding within cards.
- **Desktop/Tablet:** 12-column fixed grid (max-width 1440px). Use 24px gutters.
- **Density:** High density is preferred for data screens (Workout logs), while low density with heavy whitespace is used for "Achievement" and "Hero" screens to emphasize the premium feel.

**Reflow Rules:**
Cards in the dashboard should stack vertically on mobile but can form 2 or 3-column masonry layouts on desktop depending on the metric importance.

## Elevation & Depth

This design system avoids traditional physical shadows in favor of **Tonal Layers** and **Emissive Glows**. Depth is an additive process of light on a dark canvas.

- **Surface Tiers:**
    - **L0 (Base):** `#0A0A0C` (Primary background)
    - **L1 (Elevated):** `#121214` (Nav bars, sidebars)
    - **L2 (Card):** `#16161A` (Standard interactive surfaces)
- **The "Nextera Glow":** Instead of a drop shadow, use a soft radial glow (`rgba(224,20,47,0.28)`) behind active primary elements to simulate a screen's backlight.
- **Hairline Outlines:** Use 1px borders at `rgba(255,255,255,0.07)` to define card boundaries without introducing heavy visual weight.

## Shapes

The shape language is sophisticated and modern, utilizing generous corner radii to offset the "hard" industrial nature of gym equipment.

- **Cards:** Primary cards use a **22px radius** for a luxurious, modern feel.
- **Interactive Elements:** Buttons and input fields use a **12px radius** for consistency.
- **Micro-elements:** Chips and progress indicators use a **4px radius** or are fully **Pill-shaped** to denote distinct, tappable capsules.
- **Borders:** All borders are hairline (1px). Never use thick borders unless highlighting a "Selected" state, where the border color shifts to the brand crimson.

## Components

### Buttons
- **Primary:** Solid Crimson (`#E0142F`) fill with White text. Apply a subtle outer glow on hover.
- **Secondary:** Ghost style with a Crimson hairline border and semi-transparent Crimson fill (`10% opacity`).
- **Tactile:** In-app logging buttons should have an active "Pressed" state that slightly scales down (98%) to provide haptic-like visual feedback.

### Cards
- Standard background is `#16161A`. 
- Every card must feature a 1px hairline border.
- Featured cards (e.g., "Join Challenge") should use the "Energy Ribbon" gradient as a 2px top-border accent.

### Inputs & Selectors
- Inputs use the card-base color with a subtle inner-glow on focus.
- Monospace font is required for any numeric input fields to ensure alignment.

### Chips & Badges
- **Status Chips:** Use dark backgrounds with a high-saturation text label (e.g., "PR" in bright red).
- **Achievement Badges:** Hexagonal or Shield shapes with metallic gradients (Gold, Silver, Bronze) and associated glows.

### Specialized: The Performance DNA
- A pentagon radar chart using 1.5px stroke lines and a central Crimson glow to visualize athlete stats (Power, Endurance, etc.).
