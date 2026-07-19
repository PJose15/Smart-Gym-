# NEXTERA — Master Design Specification for Google Stitch

> **One file. Everything Stitch needs to design NEXTERA.**
> Visual direction: **Red-Luxury** (near-black + crimson energy, high-contrast serif wordmark).
> Product source of truth: the 47-doc NEXERA_BUILD library. This file translates that functional spec into a buildable design brief + ready-to-paste Stitch prompts.

---

## 0. HOW TO USE THIS FILE WITH GOOGLE STITCH

Google Stitch turns natural-language prompts (+ optional reference images) into UI designs. Work in this order:

1. **Paste §2 "GLOBAL THEME PROMPT"** into Stitch first as the project/theme so every screen inherits the look.
2. **Attach 2–3 reference renders** from this folder (e.g. `3B011945…PNG`, `03EBB453…PNG`, `47A238C1…PNG`) as style anchors — they ARE the target aesthetic.
3. For each screen, **paste its prompt from §12 "STITCH PROMPT LIBRARY"**, which already embeds the theme, layout, components, copy, and states.
4. Generate **mobile screens at 390×844 (iPhone)** and **web/admin screens at 1440×1024 (desktop)** — noted per screen.
5. Keep every screen on the tokens in §3. Never let Stitch introduce a light theme, new accent hue, or off-grid spacing.

**Two platforms, one system:**
- **Member app** = mobile-first PWA (portrait). Bottom tab bar. The whole 90-second scan→log loop lives here.
- **Trainer / Owner / Super-Admin** = responsive web dashboards (desktop-first, sidebar nav). Same tokens, denser layouts, data tables.

**The north star that overrides aesthetics:** *from first QR scan to first set logged, under 90 seconds.* No animation, font, or visual flourish may threaten it. Skeletons render before data; celebrations never block; fonts use `display: swap`.

---

## 1. BRAND FOUNDATION

| Attribute | Value |
|---|---|
| **Product name (UI/legal)** | **Nexera** (one capital N). The marketing/hero wordmark is styled **NEXTERA** in serif. Body UI uses "Nexera". Never "NEXERA" all-caps in running text, never "Nexera AI", never "SmartGym". |
| **What it is** | The AI fitness platform that lives in your gym. Scan a machine → log a set → AI builds your program, tracks recovery, scores readiness, celebrates PRs. **Free for members; the gym pays.** |
| **Hero tagline** | **PERFORM · EVOLVE · ASCEND** |
| **Secondary lines** | "TRAIN DIFFERENTLY" · "THE NEXT ERA OF HUMAN PERFORMANCE" · "Built for gyms. Empowering trainers. Elevating members." |
| **In-app greeting voice** | "Let's elevate today." / "Recover smarter. Stay ready." / "After the workout, the AI keeps working." |
| **Co-brand lockup** | `{Gym Name}` · `on Nexera` — gym primary, Nexera subordinate, thin middot separator. e.g. **Iron Forge · on Nexera**. |
| **Personality** | Premium, cinematic, disciplined, confident. Luxury performance brand, not a consumer fitness toy. Restrained — red is energy, used as accent and glow, never wallpaper. |

### Brand voice rules (copy)
- Short, direct, second person. "You", "your". Encouraging, never shaming. A missed week is "Welcome back — let's ease in," never "You failed."
- Celebrate specifics: "New PR — 225 lb on Leg Press. Up 10 from your last best."
- AI is a quiet coach: failures are silent (fallback to "Built from your floor"), never an error banner.
- Numbers are heroes — render them big, in mono, in accent or white.

---

## 2. GLOBAL THEME PROMPT (paste into Stitch first)

```
Design a premium, cinematic dark mobile/web app called NEXTERA — an AI fitness
platform that lives in the gym. Visual direction: RED-LUXURY.

THEME:
- Near-black canvas (#0A0A0C). Surfaces step up by lightness, never by drop shadow.
- Single signature accent: crimson red (#E0142F), with a brighter glow red (#FF2740)
  and deep oxblood (#8A0D1E) for gradients. Red is energy — used for the primary CTA,
  active states, rings, progress, and soft radial "energy ribbon" glows behind heroes.
- Text is white (#FFFFFF) on near-black; secondary text warm gray (#B5B2B8).
- Accents of warm gold (#E8B339) for rank #1, champion, and legendary moments.
- Cards are very dark (#16161A) with a 1px hairline border (rgba(255,255,255,0.07))
  and occasionally a thin top crimson gradient line.
- Thin crimson rim-light / lens-flare streaks may arc behind hero sections (subtle,
  cinematic, like the reference images). Never busy.

TYPOGRAPHY:
- Wordmark + big editorial hero headlines: a high-contrast elegant SERIF
  (Cormorant Garamond / Playfair Display style), wide letter-spacing, uppercase
  for "NEXTERA" with small-caps "FITNESS" beneath.
- All app UI text (labels, body, buttons): Inter (clean geometric sans).
- All numbers/stats/timers: a monospace (JetBrains Mono) so digits stay fixed-width.

MOOD: disciplined, luxurious, high-performance. Red rim-lit, glassy dark surfaces,
generous spacing, large mono numbers, restrained motion. Think a luxury car dashboard
meets an elite training facility. Always dark. WCAG AA contrast.
```

---

## 3. DESIGN TOKENS (the system Stitch must obey)

> Built on the rigor of the documented system, re-skinned to red-luxury. Every color is a token; every space is on an 8px grid (4px is the only sub-step). Never hardcode a hex in a component.

### 3.1 Color — backgrounds
| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0A0A0C` | Page background — deepest |
| `--bg-elevated` | `#121214` | Nav bars, sidebars, sheets |
| `--bg-card` | `#16161A` | Standard card |
| `--bg-card-hover` | `#1C1C22` | Hover / raised panel |
| `--bg-input` | `#16161A` | Input field |
| `--bg-input-focus` | `#1C1C22` | Input focused |
| `--bg-overlay` | `rgba(8,8,10,0.82)` | Modal / sheet backdrop |
| `--bg-skeleton` | `#1C1C22` | Skeleton base |
| `--bg-skeleton-shine` | `#26262E` | Skeleton shimmer |

### 3.2 Color — text
| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#FFFFFF` | Headings, key labels |
| `--text-secondary` | `#B5B2B8` | Descriptions, metadata |
| `--text-tertiary` | `#6E6B72` | Timestamps, hints, placeholders (≥17px only) |
| `--text-disabled` | `#3A3A42` | Disabled |
| `--text-on-accent` | `#FFFFFF` | Text on crimson |

### 3.3 Color — brand accent (crimson)
| Token | Hex | Usage |
|---|---|---|
| `--accent` | `#E0142F` | Primary CTA, active state, brand red |
| `--accent-bright` | `#FF2740` | Glow, peak readiness, hot highlight |
| `--accent-deep` | `#8A0D1E` | Oxblood, gradient base |
| `--accent-hover` | `#FF3B52` | Hover |
| `--accent-pressed` | `#B30F26` | Pressed |
| `--accent-subtle` | `rgba(224,20,47,0.10)` | 10% fill (selected rows, chips) |
| `--accent-glow` | `rgba(224,20,47,0.28)` | Glows / shadows |
| `--accent-ribbon` | `linear-gradient(135deg,#FF2740,#8A0D1E)` | Hero energy streak, top-of-card line |

### 3.4 Color — intent / status
| Token | Hex | Usage |
|---|---|---|
| `--success` | `#2ED39A` | PR positive, "done", on-track |
| `--success-subtle` | `rgba(46,211,154,0.10)` | success fill |
| `--warning` | `#F5A623` | At-risk, moderate readiness |
| `--warning-subtle` | `rgba(245,166,35,0.10)` | warning fill |
| `--danger` | `#FF4D4D` | Destructive / error (always paired with ⚠ icon to distinguish from brand crimson) |
| `--danger-subtle` | `rgba(255,77,77,0.10)` | error fill |
| `--info` | `#5B8DEF` | AI tips, coach notes |
| `--info-subtle` | `rgba(91,141,239,0.10)` | info fill |

### 3.5 Color — gamification
| Token | Hex | Usage |
|---|---|---|
| `--gold` | `#E8B339` | Rank 1, champion, legendary |
| `--gold-glow` | `rgba(232,179,57,0.28)` | gold halo |
| `--silver` | `#C9CAD1` | Rank 2 |
| `--bronze` | `#C58A4E` | Rank 3 |
| `--xp` | `#E0142F` | XP (matches accent) |
| `--streak-cold` | `#6E6B72` | 0 days |
| `--streak-warm` | `#F5A623` | 1–6 |
| `--streak-hot` | `#FF7A1A` | 7–20 |
| `--streak-fire` | `#FF3D00` | 21–49 |
| `--streak-inferno` | `#FF1744` | 50–99 |
| `--streak-legend` | `#FFE08A` (white-hot/gold) | 100+ |

### 3.6 Color — borders
| Token | Value | Usage |
|---|---|---|
| `--border-subtle` | `rgba(255,255,255,0.05)` | Hairline divider |
| `--border-default` | `rgba(255,255,255,0.07)` | Standard card border |
| `--border-strong` | `rgba(255,255,255,0.16)` | Emphasized |
| `--border-accent` | `rgba(224,20,47,0.40)` | Accent-tinted (selected, today) |

### 3.7 Domain color scales (readiness / muscle / DNA)
Red is "energy/heat." Higher readiness = hotter red; higher fatigue = hotter red. Both read as intensity, on-brand.

| Scale | Token → value | Meaning |
|---|---|---|
| **Readiness** | `--readiness-peak` `#FF2740` (85–100, glowing) · `--readiness-ready` `#E0142F` (60–84) · `--readiness-moderate` `#F5A623` (30–59) · `--readiness-rest` `#6E6B72` (0–29, dim) · `--readiness-calibrating` dashed `#3A3A42` | training readiness ring |
| **Muscle recovery** | `--muscle-fresh` `#C9CAD1` (≥0.95, cool/ready) · `--muscle-ready` `#E8B339` (0.80–0.94) · `--muscle-recovering` `#F5A623` (0.50–0.79) · `--muscle-fatigued` `#FF2740` (<0.50, hot) · `--muscle-worked` `#FF3D00` glow (just trained) | muscle heatmap |
| **Performance DNA** | pentagon stroke `--accent` `#E0142F`, fill `rgba(224,20,47,0.18)`, glow `--accent-glow`; growth-ghost at 7% opacity | 5-dimension radar |

### 3.8 Spacing (8px grid)
`--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 (mobile card pad) · `--space-5` 20 (desktop card pad) · `--space-6` 24 · `--space-8` 32 · `--space-10` 40 · `--space-12` 48 · `--space-16` 64.

### 3.9 Radius
`--radius-sm` 4 (chips) · `--radius-md` 8 (buttons, inputs) · `--radius-lg` 12 (cards) · `--radius-xl` 16 (large cards) · `--radius-2xl` 22 (hero, featured, badges) · `--radius-full` 9999 (pills, avatars, rings).
> The reference renders use generously rounded cards (18–22px). Default cards to `--radius-xl`/`2xl`.

### 3.10 Typography scale
| Role | Font | Size / weight / tracking | Use |
|---|---|---|---|
| **Wordmark** | Serif (Cormorant/Playfair) | 40–64px, 600, +0.12em, UPPERCASE | "NEXTERA" lockup |
| **Editorial hero** | Serif | 32–48px, 600, +0.02em | Marketing/onboarding headlines ("OWN YOUR WEEK.") |
| Display | Inter | 48 / 800 / −0.02em | Big stat takeovers |
| H1 | Inter | 32 / 700 / −0.01em | Screen titles |
| H2 | Inter | 24 / 700 | Section titles |
| H3 | Inter | 20 / 600 | Card titles |
| H4 | Inter | 17 / 600 | Row titles |
| Body | Inter | 15 / 400 / 1.6 lh | Paragraphs |
| Body-md | Inter | 15 / 500 | Emphasis / buttons |
| Small | Inter | 13 / 400 | Metadata |
| Tiny | Inter | 11 / 500 | Smallest legible |
| Label | Inter | 12 / 600 / +0.05em / UPPERCASE | Kickers (e.g. "READINESS", "TODAY") |
| **Stat** | Mono (JetBrains) | 40 / 800 / −0.03em | Readiness score, weights, volume |

**Rules:** serif ONLY for the wordmark + big editorial headlines; everything functional is Inter; every changing/aligning number is mono. Uppercase only via the Label style. Smallest shipped size 11px.

### 3.11 Elevation & glow
Depth = surface lightness, not shadow. The only sanctioned shadows are glows:
- `--glow-accent: 0 4px 28px var(--accent-glow)` — CTA hover, readiness ring
- `--glow-gold: 0 0 32px var(--gold-glow)` — gold achievement
- `--glow-success: 0 0 24px rgba(46,211,154,0.5)` — PR number
- `--shadow-sheet: 0 -8px 32px rgba(0,0,0,0.6)` — bottom sheet lift

Z-index ladder: base 0 · ambient glow 1 · sticky 100 · nav 200 · dropdown 300 · overlay 390 · sheet 400 · toast 500 · celebration 600.

### 3.12 Motion
Three tiers only:
- **Quick** 120ms `ease-out` — button press, toggle, tab indicator.
- **Standard** 300ms `cubic-bezier(0.4,0,0.2,1)` — page/sheet transitions, rolling numbers, list stagger (50ms, cap 8), skeleton→content.
- **Leisurely** 600ms `cubic-bezier(0.34,1.56,0.64,1)` (spring) — celebrations, readiness ring fill, DNA draw-in, streak tier burst.

Hard don'ts: only animate `transform`/`opacity`; never linear (except spinners); never >800ms; never chain >4. Every animation has a `prefers-reduced-motion` path that shows the final state instantly.

### 3.13 Haptics (PWA Web Vibration, via one wrapper, respects reduced-motion + setting)
selection 8ms (tab/toggle) · light 12ms (button/chip) · medium 20ms (set logged, sheet open, QR recognized) · heavy 35ms (PR, level-up, streak tier) · success `[0,20,40,30]` (PR confirmed) · warning `[0,30,60,30]` · error `[0,50,30,50]`. Celebration haptics fire at the payoff frame (number/badge reveal), not when the overlay opens.

### 3.14 Iconography
Line icons, 1.5–2px stroke, rounded caps. Active state = filled + accent. Emoji are used as expressive glyphs in content (🏆 PR, 🔥 streak, 🧬 DNA, ⚡ readiness, 🪶 deload, 📍 machine) but UI chrome icons are line-style. QR scan uses a red laser-line reticle (see renders).

---

## 4. CORE COMPONENT LIBRARY

Every interactive component ships ALL states: **default · hover (web) · pressed · disabled · loading · empty** (data views). A missing state = broken.

| Component | Spec |
|---|---|
| **Button** | Variants: `primary` (crimson fill, white text, hover lifts -1px + `--glow-accent`, pressed `--accent-pressed` scale .97), `secondary` (transparent, 1px border, hover → accent border + `--accent-subtle`), `destructive` (`--danger`), `success`. Sizes sm h36 / md h44 (default, = touch floor) / lg h52. Loading = spinner replaces label, `aria-busy`. |
| **Card** | `--bg-card`, 1px `--border-default`, radius xl. Interactive: hover `--bg-card-hover` + `--border-strong`, lift -2px, pressed scale .99. Selected: `--border-accent` + `--accent-subtle`. Featured: radius 2xl, pad 24, optional top crimson gradient line. |
| **Pill / chip** | `--radius-full`, h28, tiny uppercase. Intents: neutral, accent, success, warning, danger — each = subtle bg + tinted border + colored text + icon. |
| **Stat tile** | Mono number (h2/display) + uppercase label below + optional trend chip (↑ green / ↓ red). Used in stat grids and dashboards. |
| **Bottom sheet / modal** | Sheet anchors bottom, radius-top xl, grab handle, `--shadow-sheet`, backdrop `--bg-overlay`. Traps focus, Esc + backdrop close. Modal = centered, scale-in. |
| **Input** | h44, `--bg-input`, 1px border → focus accent border + 3px `--accent-subtle` ring (never browser outline). Error = `--danger` border + `--danger-subtle` bg + message below. |
| **Tabs / segmented** | Underline indicator slides (standard tier) for tabs; pill-style for segmented toggles, active = `--accent-subtle` bg + accent text. |
| **Bottom nav** (member) | Fixed, `--bg-elevated` 95% + blur, top hairline. 5 items. Center **Scan** = elevated crimson circle (the 90-second gateway, always one tap away). Active = accent + filled icon + 3px top indicator. |
| **Toast** | Top-center, `--bg-elevated` + tinted border + icon. info/success auto-dismiss 3s; warning persists; error stays with retry; critical → full-screen error. `aria-live`. |
| **Progress ring** | SVG arc, track `--border-default`, fill colored by domain scale, mono number centered, fill animates on reveal (leisurely spring). Used for readiness, recovery, challenge gauge. |
| **Progress dots / bar** | Dots for steppers/onboarding (active = wide accent, done = success, todo = strong). Bars for week/program/level/challenge (track + accent or gradient fill). |
| **Leaderboard row** | rank numeral (gold/silver/bronze for 1/2/3), avatar, name, mono value. "You" row = `--accent-subtle` + 3px left accent border. |
| **Achievement badge** | 120px rounded-2xl tile, tier-colored 3px border + glow (common gray / rare info / epic accent / legendary gold-shimmer). Locked = grayscale .4 + 🔒 + progress bar. |
| **Avatar** | Circle, gradient fill fallback with initials, optional level ring. |

---

## 5. GLOBAL PATTERNS (apply to every screen)

- **Loading:** dimension-matched shimmer skeleton (8 named layouts: Home, Profile, Progress, Machine, Workout, Feed, Leaderboard, TrainerMember). Never a blank flash or layout shift.
- **Empty state:** 48px icon (tertiary), H4 title (secondary), optional body + CTA. e.g. feed → "Your gym is warming up."
- **Error:** Toast (transient) · inline ErrorCard ("Couldn't load this." + Retry) · full-screen ErrorDisplay ("Something went sideways. That's on us, not you. Try again — your logged sets are safe." → Try again / Go home + ref code).
- **Offline:** render cache + offline banner; queue set logs via service worker, still celebrate, sync on reconnect.
- **Accessibility (gate, not polish):** WCAG AA contrast; 44×44 touch targets; visible focus ring (`ring-2 ring-accent`); `prefers-reduced-motion` paths; status never by color alone (always icon+text); ARIA roles on sheets/tabs/toasts/rings.

---

## 6. INFORMATION ARCHITECTURE & NAVIGATION

### 6.1 Member app — bottom tab bar (5 tabs)
`HOME · PROGRAM · SCAN (center, elevated crimson) · FEED · PROFILE`
- **Feed** carries an unread badge; under Feed sits a segmented toggle **[Feed | Leaderboard]**.
- Messages and Challenges are NOT tabs (cap is 5): reached via Home widgets, Profile, Feed cards, and push deep-links.
- Scan is the always-present floating gateway to the 90-second loop.

> Note: the home render shows tabs as Home/Program/Progress/Gym/Profile. Canonical IA is Home/Program/Scan/Feed/Profile with Scan centered. Use the canonical 5 with the centered Scan button.

### 6.2 Trainer portal (web) — left sidebar
`Roster · Check-ins (n) · Messages (n) · Challenges · Voice/Settings`

### 6.3 Owner console (web) — left sidebar `/admin`
`Members · Floor Health · Churn Risk · Engagement · Branding · Partner Kit · Billing · Settings`

### 6.4 Super-admin (web) — left sidebar `/super`
`Overview · Gyms · Health · AI Costs · Flags · Rollouts · Audit · Errors · Platform Defaults`

### 6.5 Public web
`/g/[slug]` public gym profile · `/onboard?gym=` onboarding.

---

# 7. SCREEN SPECS — MEMBER APP (mobile, 390×844)

> Each screen: purpose · layout (top→bottom) · key components · states · verbatim copy. Stitch prompts for all of these are in §12.

## 7.1 ONBOARDING (north star: scan→first set < 90s)

**Flow:** Scan → resolve gym → auth (OTP) → provision → either **machine-QR fast lane** (log set now → deferred questions) or **onboarding-QR lane** (6 questions → build program → install nudge → guided first set → home "Nexera is learning").

### S0 — Scan Landing / Gym Splash
- Gym logo, editorial serif headline **"Welcome to {{gym.name}} on Nexera."**, body **"Your AI coach is free — {{gym.name}} covers it. Log your sets, and Nexera builds your program around the machines on this floor."**, primary **"Get started →"**, secondary **"Already set up? Log in"**.
- Machine-QR variant: machine illustration + **"Leg Press — {{gym.name}}"**, **"Log your set in seconds. We'll set up the rest after."**, primary **"Log this set →"**.
- 90-second timer starts on first paint. Invalid gym → friendly GymNotFound.

### S1 — Auth: Identifier
- Title **"One quick step"**, segmented **[Text | Email]**, phone/email input, hint **"We'll text you a 6-digit code. No password, ever."**, primary **"Send code"**, legal footnote.

### S2 — Auth: Code
- Title **"Enter your code"**, 6-box auto-advance OTP (numeric, auto-submit on 6th), hint **"Sent to •••• 4821."**, **"Resend in {n}s"**, **"Wrong number?"**. Errors: **"That code didn't match."** / **"That code expired — we sent a new one."** / **"Too many tries. Wait a minute."**

### S4–S9 — Questionnaire (6 full-screen cards)
Shared: 6 ProgressDots, serif title, one decision per card, big tap targets, persistent **"Skip for now"**, haptic on pick.
- **Q1 Goal** "What are you here to do?" → 🔥 Lose weight/lean out · 💪 Build muscle · ⚡ Improve overall fitness · 🏆 Train for a sport · 🌱 General health.
- **Q2 Experience** "How long have you been training?" → New to this · Some experience · Experienced.
- **Q3 Limitations** "Anything we should train around?" multi-select chips (Lower back, Knees, Shoulders, Hips, Wrists/elbows, Neck, Recovering from injury, Pregnancy/postpartum, None) + Other.
- **Q4 Days & length** "Which days will you usually train?" Mon–Sun toggles + "How long per session?" 30/45/60/75+ (default 45).
- **Q5 Equipment** "Which of these are you comfortable using?" chips from the gym's real machines.
- **Q6 Basics (optional)** "A couple of basics — these sharpen your readiness & DNA." Sex / Birth year / Height.

### S10 — Building Your Starter Program
- Animated crimson pulse, **"Building your starter program…"**, **"Around the machines at {{gym.name}}."**, checklist ✓ goal focus / ✓ {days}/week / ✓ working around {limitations}, footer **"Your AI coach unlocks after 10 sessions."**

### S11 — PWA Install Nudge
- Android: **"Add Nexera to your phone"** / **"Tap below to install. One tap, no app store."** → **"Add to home screen"** / **"Maybe later"**.
- iOS: **"Add Nexera to your Home Screen"** + 3 illustrated steps (Share → Add to Home Screen → Add), animated arrow to Safari share. Never blocks first set.

### S12 — Guided First Set (<90s)
- Machine header, coachmark **"First one's on us — just confirm and tap Log."**, big Weight stepper, big Reps stepper, primary **"Log set"**, text **"Not now"**. Success haptic.

### S13 — First-Set Celebration
- **"Session 1 of 10 logged. Keep going — every set teaches Nexera your style."** Plants the 10-session learning expectation.

---

## 7.2 HOME (the hub)

**Purpose:** make the next session obvious, the last session rewarded. Single scroll, pull-to-refresh, hero-first streaming.

**Layout top→bottom:**
1. **Top bar:** gym logo + "{Gym} · Nexera" (left), notification bell + avatar with level ring (right).
2. **HERO** — one of 8 variants (priority chain below).
3. **2-up:** Readiness Ring (left) + Streak (right).
4. **Readiness Trend** sparkline (7 pts).
5. **── TODAY ──** Today's Plan widget (program day, week progress bar, exercise preview, **"Start Session →"**).
6. **Next Machine** widget (glyph, name, reason, bay, **"Scan to start →"**).
7. **── RECENT WINS ──** Recent PRs (up to 3).
8. **Challenge** progress widget.
9. **── FROM YOUR GYM ──** Feed teaser (2–3 rows).

**Hero variant system (first match wins):**
| # | Variant | Trigger | Kicker / Title | CTA | Treatment |
|---|---|---|---|---|---|
| 1 | learning | sessions < 10 | "WELCOME, {NAME}" / "Nexera is learning how you train" | "Scan a machine →" | 10 session-ticks, unlock checklist (🧬 DNA, 🤖 program, 📈 readiness), {n}/10 ring |
| 2 | comeback | absence ≥10d | tiered "Welcome back…" | tiered | light/reset/rebuild tiers; "…and you left on a PR — nice" |
| 3 | trainer_note | unread note surfaced | "NOTE FROM {TRAINER}" + avatar | "Read & reply →" | info/coach tone |
| 4 | pr | un-acked PR (48h) | "NEW PERSONAL RECORD" / "🏆 {exercise} +{delta}{unit}" | "View PR" + "Share to feed" | confetti, success glow |
| 5 | challenge | within milestone window | "2 sessions from the milestone" | "Open challenge" | — |
| 6 | rest_day | readiness ≤29 or scheduled | "Today's a recovery day" + most-fatigued muscle | "View recovery" | — |
| 7 | active_program | training day | "Day 5 is ready for you" | "Start today's session" | — |
| 8 | default | none | time-of-day greeting | "Scan a machine" | — |

> The HTML render's hero ("Week 3. Day 2 in progress." + readiness pill "84 · Peak readiness" + 12 day-streak + Last PR badge) is the **active_program** variant — use it as the layout reference, restyled red-luxury.

---

## 7.3 THE SCAN→LOG LOOP (signature, the heart of the product)

### Scan Screen
- Full-bleed live camera, centered **red laser-line QR reticle** (see renders). On decode: vibration + checkmark flash.
- States: scanning · invalid QR ("That's not a Nexera machine") · not found (manual search) · offline (freestyle quick-log) · wrong gym ("Log at {Gym}?").
- Copy from render: **"SCAN MACHINE"**, recognized card **"LEG PRESS · Station 07"**, **"AI instantly recognizes the machine, loads your workout, and personalizes your next set."**

### Machine Screen
- Machine name + default exercise + muscle groups. **Mode pill** at top (PROGRAM · Upper A / FREESTYLE / GUIDED — tappable). Program mode shows prescription (target 8–12, 4 sets, 90s rest), "Set 2 of 4", **"Next: Lat Pulldown →"**. Inline recovery note if muscle fatigued (never blocks). Sync chip: `⟳ 3 sets syncing…` / `✓ All sets saved` / `⚠ 1 set waiting · offline`.

### Set-Log Sheet (the single most important surface)
- Bottom sheet. Header: machine name · `Set 2 of 4` · ✕. Subline `Machine Chest Press · target 8–12`.
- **WEIGHT (lb)** stepper `[ −5 | 135 | +5 ]` and **REPS** stepper `[ −1 | 10 | +1 ]` — big, thumb-only, long-press repeat, tap value for numpad.
- Optional **RPE** pills `[6][7][8][9][10]`. Carry-forward hint `Last time: 130 lb × 10 @RPE 8`.
- Primary full-width **`LOG SET ✓`** (crimson). Secondary `+ Warm-up set` · `⚙ More`.
- Haptics: selection on stepper, success on log; optimistic advance; debounced.

### Rest Timer
- Countdown ring (crimson) with next set pre-staged. `+15s` · `−15s` · `Skip rest`. Background-safe. On finish: haptic + (if backgrounded) push "Rest's up — Set 3 of 4." Guided mode shows coaching cue + trainer avatar.

### Session Summary
- **"Session complete 🎉"**, stats `42 min · 18 sets · 12,400 lb volume`, PRs block (`🏆 2 PRs` + per-PR lines), readiness delta `72 → 64 (recovering)`, `Worked: Chest · Triceps · Front Delts`, `🔥 7-day streak`, **[Share to feed] [Done]**.

### PR Celebration (overlay)
- Full-screen crimson overlay, confetti (120, brand colors), hero number with success glow, **"New Weight PR!"** / exercise / delta `+15 lbs` / `+100 XP`, **Share to feed**. ~4s, tap to dismiss. Haptic heavy+success at the number reveal.

---

## 7.4 READINESS & RECOVERY (signature)

### Readiness Ring (home + detail)
- 0–100 arc colored by band (§3.7), big mono score center, band label, AI explanation (≤160 chars), "Estimated" chip when low-confidence. Tap → daily check-in (if due) or detail.
- **Bands:** Calibrating (dashed, "—", "Calibrating…") · Depleted 0–29 (dim, "Rest or recover") · Moderate 30–59 (amber, "Train light") · Ready 60–84 (crimson, "Good to train") · Primed 85–100 (bright red glow, "Peak — push it").
- Render reference: ring shows **87** with "READY-TO-TRAIN" — restyle in crimson glow.

### Daily Check-in Card (10-second, never blocking)
- Header **"Quick check-in ✕"**, four 1–5 emoji segmented rows: **"How did you sleep?"** 😴😐🙂😊🤩 · **"How sore are you today?"** 💪🙂😬😣🥵 · **"How's your energy?"** 🔋😐🙂⚡🚀 · **"Stress level?"** 😌🙂😐😖🤯. Button **"Update my readiness"**. Collapses to **"✓ Checked in"** after.

### Readiness Detail Sheet
- 5 component bars (Recovery .30 / Load balance .25 / Sleep .20 / Soreness .15 / Consistency .10), 7-day sparkline, explanation text.

### Muscle Map (signature)
- Front/back toggle (animated flip), inline SVG body silhouette with 17 tappable muscle regions colored by recovery state (§3.7 — cool=fresh, hot crimson=fatigued, orange glow+pulse = just worked). 4-swatch legend. Banded (default) or gradient mode.
- Tap region → detail sheet: group + state pill + recovery % + hours-to-ready + 72h decay sparkline + "Last hit" + CTA ("Train this →" if ready, "Recovers in ~Xh" if fatigued).
- Render reference: "PERFORMANCE SYSTEM" body map with per-muscle % (Power 92%, Endurance 87%, Focus 94%).

---

## 7.5 PERFORMANCE DNA (signature)

- **Pentagon radar**, 5 axes 72° apart: Strength (top), Endurance, Consistency, Progression, Balance. 4 grid rings, crimson stroke (2px + glow on full confidence), 18% crimson fill, growth-ghost prior-quarter polygon at 7%. Springs out from center on first paint.
- Below: "PERFORMANCE DNA" label + archetype name (accent) + one-line blurb.
- **12 archetypes:** Powerhouse, Engine, Metronome, Ascending, Architect, All-Rounder, Specialist, Grinder, Sprinter, Veteran, Rookie, Comeback (each with its blurb + accent variant).
- **States:** Forming (<5 sessions, faint pulsing pentagon, "Nexera is learning your shape…") · Low-confidence ("(forming)" tag) · Full (glow) · Archetype-change celebration card ("Your Performance DNA evolved: Grinder → Ascending").
- DNA card on profile: Forming / Provisional (blurred guess, "Leaning toward {archetype} — unlocks at session 10") / Computed (archetype + 5 mini-bars + confidence + "See full DNA →").

---

## 7.6 PROGRAM

- **Program Index:** stack header "My Program" + Switch ↕. Program hero (badge 🤖 AI PROGRAM / 🏋️ TRAINER PROGRAM, name, "{n} weeks · {n} days/week", progress "Week n of t · Day n of t" + %, bar). Week grid of day pills (completed ✓ green · today accent border + dot · upcoming · REST dashed). Today's day card pre-expanded with exercise rows + **"Start Today's Session →"**.
- **Day Detail:** day header, EXERCISES rows (sets×reps, machine, rest, "Last: {weight}"), NOTES, sticky **"Start Today's Session"**.
- **Accept Program:** "Your Trainer Sent a Program", trainer avatar + "{Trainer} assigned you a new program", program card + week-1 preview, **"Accept Program ✓"** / "Not right now →" / "Your trainer will be notified". Reject modal with optional reason.
- **Generate AI Program:** "Generate AI Program" + days-per-week chips (2/3/4/5), focus rows (💪 Full Body, 🏋️ Upper/Lower, 📊 PPL, 🎯 Strength, 🔥 Conditioning), length chips (4/6/8/12 wk), **"Generate My Program 🤖"** + "Takes about 10–20 seconds." Generating state: 🤖 pulse + "Building your program…".
- States: completion card ("Program Complete! 🏆"), no-program card.

---

## 7.7 PROFILE

- Header ← Profile + [Edit]. Avatar 84px, name, **"Level {n} · {XP} XP"**, **"Member since {Mon Year}"**, level progress bar + "{n} XP to Level {N+1}".
- Stats row (sessions · 🔥 weeks · PRs · vol) each with 30-day delta chip.
- **── PERFORMANCE DNA ──** card (see §7.5).
- **── ACHIEVEMENTS ──** badge grid (earned + locked silhouettes).
- **── GOAL & LEVEL ──** card.
- **── LIMITATIONS ──** card.
- Editors: core (name, weight unit), goals, limitations.

---

## 7.8 SOCIAL FEED & LEADERBOARD

### Feed
- Sticky header "{Gym} Feed" + Filter ▾. SurfaceToggle **[Feed | Leaderboard]**. Filter chips **All · PRs · Achievements · Streaks · Challenges**. Scrolling list of event cards.
- **Event card:** avatar + name + relative time, type content, divider, **reaction bar**, comment preview + "Add a comment…".
- **12+ event types** with icon + colored heading: Weight/Volume/Rep PR (🏋️ "NEW WEIGHT PR!", green number + delta), Achievement (rarity-bordered badge + "+XP"), Goal Reached (🎯), Streak (🔥 "{n}-Week Streak", flame-tier color), Level Up, Challenge Joined/Completed (🏆), Workout Share (📍 machine tag), Goal Set (📌), Archetype Change (🧬).
- **5 reactions:** 💪 Strength · 🔥 Fire · 🏆 Champion · 👊 Let's Go · 👏 Respect. Pills, active = `--accent-subtle` + accent. Can't react to own event.
- **Comments:** bottom sheet, rows, input + "Post". Empty "No comments yet. Be first!"
- **Share composer** (post-session): "Share with your gym?" + quick chips ("Training done 💪", "Session complete 🏋️", "Another one in the books", "Grind mode activated") + visibility row (Whole gym 🏋️ / Friends 🤝 / Only me 🔒).
- States: skeleton (5 cards), empty (warming up / quiet / filter-empty), error, pinned-milestone band, grouped runs.
- Render reference: home "Gym activity" feed rows ("Maria hit a new PR on Leg Press — 285 lbs 🏆", PR/Streak/Program badges, reaction glyph) + live "Iron Fitness is active · 3 online" indicator.

### Leaderboard
- SurfaceToggle, scope **[Gym | Friends]** (Friends @ L5), metric chips **[XP | Volume | Sessions | Streak]**, period selector. Ranked rows (🥇🥈🥉 top 3, "You" highlighted), my-context window (top 10 + … + my row), momentum **▲3 / ▼1 / ● / NEW**, "settling in" chip for provisional. Empty: "Log a session this week to get ranked."

---

## 7.9 CHALLENGES

- **List:** "Challenges", filter tabs [Active|Joined|Completed|All], challenge cards (type badge + status pill, name, "{n} participants · Ends {date}", progress bar if joined, 🏆 prize, "Join →" / "✓ Joined").
- **6 types** (icon · color · format): Volume 📊 · Sessions 🎯 · Explorer 🔍 · PR Hunter 💥 · Consistency 🔥 · Team 👥. Color-code per type but stay within the red-luxury palette (use accent + gold + amber variants).
- **Detail:** hero (type, name, "{participants} · {days} left · Rank #n"), type-specific progress viz (circular gauge / dot grid / machine tags / PR list / streak weekly grid), About + prize, leaderboard, sticky **Join / Leave**. Pace banner ("On pace — projected {n}" / "Behind pace").
- **Completion overlay:** confetti, "TARGET REACHED!", total + rank + prize, "Continue".
- Render reference: home "Active challenge" card ("🏆 Volume Challenge · 3 days left · November Volume War · You · Rank 3rd · 4,200 lbs from 2nd") + the renders' "CHALLENGES" leaderboard panel.

---

## 7.10 GAMIFICATION VISUALS

- **Levels 1–10** named ladder (Rookie → Legend) with XP bar on home hero + profile. Render shows "Level 6 · Serious · 1,840/2,200 pts" — restyle.
- **Level-up overlay:** full-screen, crimson burst ring, "LEVEL UP", big level number, level name, "Unlocked: …", confetti, manual dismiss.
- **Achievements:** 39 badges across 5 categories (Strength, Consistency, Milestones, Social, Exploration), 4 tiers (Bronze/Silver/Gold/Platinum). Grid of earned + locked.
- **Streak flame:** 6 tiers ramp warm→legend; tier-cross = spring burst + overlay ("7-Day Streak! 🔥") + heavy haptic.
- **PR celebration:** see §7.3.

---

## 7.11 MESSAGING & COACH NOTES

- **Messages list:** "Messages", trainer thread card (avatar, name, "Your Trainer", last message preview, unread badge), "─── Coach Notes ───" section (🤖 AI Coach notes).
- **Thread:** header trainer name + "Your Trainer" + ℹ️ Info; inverted message list, date separators; bubbles (sent = crimson right with tail, received = card left with avatar); read receipts (⏱ / ✓ Delivered / ✓✓ Read accent); typing indicator (3 bouncing dots); input "Message your trainer..." + round send button (active crimson). Quick-reply chips above composer.
- **Empty:** "No trainer assigned yet" / "Start a conversation with {trainer}" + "Say hello 👋".

---

## 7.12 WEEKLY CHECK-IN (member)

- Header "Your week in review · {date range} ✕". Prefilled rollup banner "You trained 3 of 4 days · 12 sets · 2 PRs 🔥". Q1 (req) "How did training go?" pills Rough/Okay/Good/Great. Q2 energy slider, Q3 soreness slider, Q4 days hit, Q5 body metrics (optional, private), Q6 progress photos (optional, private), Q7 goal feeling, Q8 free text "Anything you want your coach to know? 0/500". **"Submit check-in"** → "Thanks — your coach will see this."

## 7.13 SETTINGS (member)
Root list "Settings" grouped: Account (Profile, Units, Appearance, Sign Out) · Training (Goals, Limitations, Connected Gym) · Notifications · Privacy (Visibility, Data & Privacy). Rows with icon/title/subtitle/badge. Appearance shows "Dark (always on)" + Reduce motion + Haptics toggles. Optimistic toggles; sticky Save when dirty; destructive confirm.

## 7.14 NOTIFICATIONS (settings)
Push permission card → accordion categories (Workout, Achievements, Social, Challenges, Coaching, Trainer; Account & System locked-on) → quiet-hours picker (default 22:00–07:00). 24 notification types with verbatim copy (e.g. "🏆 New PR! {exercise} — {value}. That's a personal best.").

---

# 8. SCREEN SPECS — TRAINER PORTAL (web, 1440×1024)

- **Shell:** left sidebar (Nexera logo, Roster, Check-ins (n), Messages (n), Challenges, Voice), main content right. Dark, dense, mono numbers.
- **Roster:** filters (All · Needs attention · Check-in due · Dormant · No program) + search. Rows sorted needs-attention-first: avatar + name + "● Check-in due" + "💬 n unread"; "Readiness n · {n} days since last · 🔥 n wks"; "Program: {name}" + Open →.
- **Member Deep View:** tabs [Overview|Program|Readiness|Recovery|Check-ins|Notes|Messages]. Overview snapshot card (DNA archetype, readiness, recovery, streak, last session, churn risk, recent PRs, active program) + actions [Message][Add note][Edit program][Check-in].
- **Program Editor:** per-day exercise rows + "+ exercise", [Save draft][Assign to member].
- **Coaching Voice:** Tone (Motivational/Clinical/Friendly/Direct/Empathetic), Verbosity, Emphasize/Avoid/Signature chips, live Preview, Save.
- **Check-in Queue:** "Weekly Check-ins · Week of {date} (n)", tabs [Pending|Sent|Replied|Archived], rows with AI draft preview + Review. Review pane: stats header, editable draft textarea, [Regenerate ✨][Send].
- **Challenge Creation:** modal "New Challenge" (Name, Description, Type, Modifiers target/team, Target+Unit, Start/End, Prize, Grace window, [Save draft][Publish →]).
- **Messaging:** real-time 1:1 (mirror of member thread).

---

# 9. SCREEN SPECS — OWNER CONSOLE (web, 1440×1024)

- **Members:** roster data table (display name, status, engaged?, sessions, last active, trainer, churn risk). Empty (trial <10): "Your gym is just getting started / Floor health unlocks as members log workouts / Share install QR".
- **Floor Health:** big 0–100 score + 30-day sparkline + top contributing / detracting factor.
- **Churn Risk:** ranked list, risk bands Healthy 0–39 (green) / Watch 40–69 (amber) / At risk 70–100 (red) + reason + suggested action.
- **Engagement:** stat-tile grid (active this week, total sessions, current streaks, PRs, challenge participation).
- **Branding:** live member-home preview + editable rows (logo, accent — note: in product, gym accent is constrained; for NEXTERA brand demo keep crimson), display name. Trial progress "7 / 10 engaged members — billing starts when you hit 10". Upgrade prompt "You have 162 active members — Growth ($199) fits better than Starter. Upgrade?".
- **Partner Kit:** 4 groups (Print · Social · Launch · Links), 12 auto-co-branded downloadables (QR posters, front-desk card, signage, social templates, OG image, public QR, launch copy, etc.).
- **Billing:** tier card + usage meter, payment method, invoices, cancel danger zone. Pricing table (Starter $149 / Growth $199 / Pro $299 / Scale $599 / Members $0). Dunning banner states.
- **Public Profile editor + Settings groups** (Gym Profile, Staff, Member Defaults, Public Profile, Integrations).
- Render reference: the "KNOW WHAT'S WORKING. FIX WHAT ISN'T." machine/floor dashboard render (machine status board, utilization donuts, maintenance, AI recommendations) — owner analytics aesthetic in red-luxury.

---

# 10. SCREEN SPECS — SUPER-ADMIN (web, 1440×1024)

- **Overview `/super`:** business header stat tiles (MRR / ARR / Net-new MRR / Trials) + tier breakdown block + five-cell health strip (red dominates) + all-gyms table sorted sickest-first.
- **Gyms / Gym drill-down:** filterable table (gym, tier, status, active members, sessions 7d, health 0–100, MRR, trial progress, last active). Health bands Healthy 70–100 / Watch 40–69 / At risk 0–39.
- **Health:** five signals (error rate, 90s p95, push delivery, AI fallback, billing webhooks) with green/amber/red thresholds + alert ack.
- **AI Costs:** platform + per-gym spend vs budget caps, cost per model, 80%/100% guardrail.
- **Flags:** tri-state flag table (Off/On/Cohort), kill switches (typed confirm), required change reason.
- **Rollouts:** per-rollout card with ramp chart, % slider, health gate, pause/resume/rollback.
- **Audit:** immutable timeline with before→after JSON diff.
- **Errors:** filterable error_log table, resolve action.
- **Platform Defaults:** global form with "Affects all gyms" warnings.
- **OTP step-up `/super/verify`.** Impersonation = always-visible banner.

---

# 11. SCREEN SPECS — PUBLIC

### Public Gym Profile `/g/[slug]`
Hero (photo + scrim, gym logo, gym name H1, tagline) → identity strip "on Nexera · {city}" → momentum (3 anonymized stat cards) → vibe (top DNA archetype badge) → anonymized wins feed → single CTA **"Join {gym} on Nexera"** + "Free for members. Always." → footer "Powered by Nexera". Exactly one CTA, no prices, no member names.

### Marketing / Landing (matches your renders)
Editorial serif hero ("THE NEXT ERA OF HUMAN PERFORMANCE" / "TRAIN DIFFERENTLY"), phone mockups, "PERFORM · EVOLVE · ASCEND", three value pills (Built for gyms · Designed for members · Backed by science), CTA "Join the movement" + app badges.

---

# 12. STITCH PROMPT LIBRARY

> Each prompt assumes the §2 Global Theme is already applied. Paste one per screen. Format tuned for Stitch: platform + size, purpose, layout sections, components, copy, states, style note.

### 12.0 Master style reminder (prepend if a screen looks off-brand)
```
Apply the NEXTERA red-luxury theme: near-black #0A0A0C, crimson accent #E0142F with
#FF2740 glow, white text, warm-gray secondary, dark cards #16161A with hairline
borders and 18–22px radius, serif wordmark "NEXTERA", Inter UI text, mono numbers,
subtle crimson energy-ribbon glow behind heroes. Dark only.
```

### MEMBER — ONBOARDING

**Scan Landing (mobile 390×844)**
```
A premium dark fitness onboarding splash for NEXTERA. Centered gym logo at top, then a
large elegant serif headline "Welcome to Iron Forge on Nexera." Below, warm-gray body:
"Your AI coach is free — Iron Forge covers it. Log your sets, and Nexera builds your
program around the machines on this floor." A full-width crimson primary button
"Get started →" and a subtle text link "Already set up? Log in." Tiny legal footnote at
the bottom. Near-black background with a faint crimson energy-ribbon glow arcing behind
the logo. Lots of breathing room, cinematic.
```

**OTP Code Entry (mobile)**
```
Dark NEXTERA verification screen. Title "Enter your code" in Inter bold. A row of six
square OTP input boxes with one digit each, the active box outlined in crimson with a
soft glow. Warm-gray hint "Sent to •••• 4821." A text button "Resend in 28s" and a
smaller "Wrong number?" link. Near-black, minimal, generous spacing.
```

**Questionnaire — Goal (mobile)**
```
Dark NEXTERA onboarding question card. Six small progress dots at top (first filled in
crimson). Elegant serif title "What are you here to do?" Below, five large full-width
selectable rows, each with an emoji + label: "🔥 Lose weight / lean out", "💪 Build
muscle", "⚡ Improve overall fitness", "🏆 Train for a sport", "🌱 General health".
Rows are dark cards with hairline borders; the focused one has a crimson border + subtle
fill. A persistent "Skip for now" text link at the bottom. One decision per screen, big
tap targets.
```

**Building Program (mobile)**
```
Dark NEXTERA loading screen. A pulsing crimson ring/orb in the center. Serif title
"Building your starter program…" and warm-gray subtitle "Around the machines at Iron
Forge." A short checklist with crimson checkmarks: "✓ Build muscle focus", "✓ 4 days a
week", "✓ Working around: knees". Footer line in tertiary gray: "Your AI coach unlocks
after 10 sessions." Calm, premium, anticipatory.
```

**Guided First Set (mobile)**
```
Dark NEXTERA first-set logger. Header "Chest Press". A coachmark pill in crimson-subtle:
"First one's on us — just confirm and tap Log." Two big steppers stacked: WEIGHT (lb)
with − / 135 / + (mono number) and REPS with − / 10 / +. A full-width crimson button
"Log set" and a text link "Not now". Minimal, thumb-friendly, large numbers.
```

### MEMBER — HOME & LOOP

**Home (active program variant, mobile)**
```
Design the NEXTERA member home screen, dark red-luxury. Top bar: small gym logo + "Iron
Fitness · Nexera" left, a notification bell with red dot and a circular avatar with a
thin crimson level ring right. HERO card (rounded 22px, dark, faint crimson glow corner):
greeting "Tuesday morning, Pedro.", large headline "Week 3. Day 2 in progress.", subline
"2 of 4 machines done today", a small readiness pill "84 · Peak readiness" with a pulsing
crimson dot, and a bottom row showing a huge mono "12 day streak 🔥 Personal best" on the
left and a "Last PR — 185 lbs — Chest Press" badge on the right. Below the hero, a
2-column row: a circular Readiness ring (crimson, score 84 center) and a Streak card. Then
a "Today" section: an AI Program card "Week 3, Day 2 · Upper Body Strength" with a thin
crimson progress bar "2/4 done" and a list of machine rows (Chest Press ✓, Lat Pulldown ✓,
Shoulder Press "Up next" in crimson, Cable Row pending). Then a "This month" 2x2 stat grid
(Sessions 18, PRs 7, Lbs 47k, Best streak 12) each with an up-trend. Then an "Active
challenge" card with a gold→red gradient top line ("November Volume War · 3 days left · You
Rank 3rd"). Then a "Gym activity" live feed list. Fixed bottom tab bar: Home, Program,
Scan (center, elevated crimson circle), Feed, Profile. Large mono numbers, hairline
borders, cinematic dark.
```

**Scan Screen (mobile)**
```
NEXTERA QR scan screen. Full-bleed dark live-camera view. A centered square scanning
reticle with glowing crimson corner brackets and an animated red horizontal laser line
sweeping across. Top label "SCAN MACHINE". When recognized, a dark card slides up:
"LEG PRESS · Station 07" with a small machine icon and a crimson "Recognized ✓" chip, and
a hint "AI instantly recognizes the machine and loads your workout." Cinematic, red laser
glow.
```

**Set-Log Sheet (mobile)**
```
NEXTERA set-logging bottom sheet over a dark machine screen. Grab handle at top. Header
row: "Chest Press", a "Set 2 of 4" pill, and a ✕. Subline "Machine Chest Press · target
8–12". Two large steppers: WEIGHT (lb) [ − | 135 | + ] and REPS [ − | 10 | + ] with big
mono numbers and circular crimson +/− buttons. A row of small RPE pills 6–10. A carry-
forward hint "Last time: 130 lb × 10 @RPE 8". A full-width crimson "LOG SET ✓" button.
A secondary row "+ Warm-up set    ⚙ More". Thumb-optimized, generous touch targets, dark.
```

**Session Summary (mobile)**
```
NEXTERA session summary, dark. Big serif "Session complete 🎉". A stat line "42 min · 18
sets · 12,400 lb volume" in mono. A PRs block "🏆 2 PRs" with two rows (Chest Press 135 lb
× 10 (new top), Lat Pulldown e1RM 188 lb). A readiness delta "Readiness 72 → 64
(recovering)". A worked-muscles line "Worked: Chest · Triceps · Front Delts". A "🔥 7-day
streak" chip. Two buttons: "Share to feed" (secondary) and "Done" (crimson). Celebratory
but clean.
```

**PR Celebration overlay (mobile)**
```
NEXTERA personal-record celebration full-screen overlay on near-black with crimson radial
glow and red/gold confetti. A 64px 🏋️ emoji, serif "New Weight PR!", exercise name in
gray, then a giant mono number "225 lb" glowing, a crimson "+15 lbs" delta, and a "+100
XP" pop. A ghost "Share to feed" button slides up at the bottom. Cinematic, triumphant.
```

### MEMBER — READINESS / RECOVERY / DNA

**Readiness Detail (mobile)**
```
NEXTERA readiness detail, dark. A large circular readiness ring at top, crimson arc on a
dark track, big mono "84" centered with label "Peak — push it" and a short AI explanation
line. Below, five labeled horizontal bars: Recovery, Load balance, Sleep, Soreness,
Consistency (crimson fills, varying lengths). A 7-day readiness sparkline. Premium dark
data screen, mono numbers.
```

**Daily Check-in (mobile)**
```
NEXTERA daily check-in card, dark. Header "Quick check-in ✕". Four questions, each with a
label and a row of five emoji segmented options: "How did you sleep?" 😴😐🙂😊🤩, "How
sore are you today?" 💪🙂😬😣🥵, "How's your energy?" 🔋😐🙂⚡🚀, "Stress level?"
😌🙂😐😖🤯. The selected emoji is highlighted with a crimson ring. A full-width crimson
button "Update my readiness". Friendly, fast, never blocking.
```

**Muscle Map (mobile)**
```
NEXTERA muscle recovery map, dark. A front/back toggle at top. Center: an anatomical body
silhouette (front view) with individual muscle groups shaded by recovery heat — cool
platinum for fresh, amber for recovering, hot crimson glow for fatigued/just-worked. A
4-swatch legend (Fresh, Ready, Recovering, Fatigued). Tapping a muscle opens a sheet with
the muscle name, a recovery % , hours-to-ready, a small decay sparkline, and a "Train this
→" button. Looks like a luxury performance diagnostic.
```

**Performance DNA (mobile)**
```
NEXTERA Performance DNA screen, dark. A large pentagon radar chart with 5 axes labeled
Strength, Endurance, Consistency, Progression, Balance. Crimson polygon fill at ~18%
opacity with a glowing 2px crimson stroke, a faint "growth ghost" polygon behind it, and
concentric grid rings. Below the chart: label "PERFORMANCE DNA", archetype name "The
Powerhouse" in crimson, and a one-line blurb "You move serious weight. Strength is your
signature." A 5-row dimension breakdown with mini bars and a confidence row. Cinematic,
scientific, premium.
```

### MEMBER — PROGRAM / PROFILE / SOCIAL

**Program Index (mobile)**
```
NEXTERA full program screen, dark. Header "My Program" + a "Switch ↕" button. A program
hero: badge "🤖 AI PROGRAM", name "AI Muscle Builder", "8 weeks · 4 days/week", a progress
row "Week 3 of 8 · Day 2 of 4" with a crimson progress bar. A week grid of day pills
(completed ✓ green, today with crimson border + dot, upcoming dark, REST dashed). Today's
day card expanded showing exercise rows (name, machine, 4×8–12, last weight) and a crimson
"Start Today's Session →" button. Dark, structured, premium.
```

**Profile (mobile)**
```
NEXTERA member profile, dark. Header ← Profile + Edit. An 84px circular avatar, name
"Carlos R.", "Level 4 · 2,140 XP", "Member since Jan 2026", a level progress bar with
"460 XP to Level 5". A 4-stat row (Sessions, 🔥 weeks, PRs, Volume) each with a small green
up-delta. A "PERFORMANCE DNA" card with a small pentagon + archetype. An "ACHIEVEMENTS"
grid of badges (earned glowing, locked grayscale with 🔒). A "GOAL & LEVEL" card and a
"LIMITATIONS" card. Dark, premium, mono numbers.
```

**Social Feed (mobile)**
```
NEXTERA gym social feed, dark. Sticky header "Iron Fitness Feed" + "Filter ▾". A segmented
toggle [Feed | Leaderboard]. Filter chips: All, PRs, Achievements, Streaks, Challenges
(active chip in crimson-subtle). A scrolling list of event cards, each a dark rounded card:
avatar + name + time, content (e.g. a Weight PR card "NEW WEIGHT PR!" in green with a big
mono number and "+15 lb" delta), then a reaction bar of pill buttons (💪 🔥 🏆 👊 👏 with
counts), then "View all 4 comments" and an "Add a comment…" row. Bottom tab bar with
centered crimson Scan. Lively but premium.
```

**Leaderboard (mobile)**
```
NEXTERA leaderboard, dark. Segmented [Feed | Leaderboard], a [Gym | Friends] scope toggle,
metric chips [XP | Volume | Sessions | Streak], and a "This Week ▾" period selector.
Ranked rows: gold/silver/bronze numerals for top 3 with avatars, name, mono value. The
current user's row is highlighted with a crimson-subtle background and a crimson left
border and "(You)". A "···" separator then the user's pinned row if outside top 10. Each
row shows a momentum indicator ▲3 / ▼1 / ●. Dark, competitive, premium.
```

**Challenge Detail (mobile)**
```
NEXTERA challenge detail, dark. Hero with a left crimson border: "VOLUME CHALLENGE",
extrabold name "November Volume War", "248 participants · 3 days left · Rank #3". A circular
progress gauge (crimson) showing "47K / 75K lbs" with an "↑ On pace" green pill. An About
section + "🏆 Prize: Free month" row. A leaderboard list (medals, mono values, you
highlighted). A sticky bottom crimson "Join Challenge" button. Dark, motivating.
```

**Messaging Thread (mobile)**
```
NEXTERA trainer chat thread, dark. Header: trainer avatar + name "Marcus" + subtitle "Your
Trainer" + ℹ️. A date separator "Today". Message bubbles: received (left, dark card with
trainer avatar) and sent (right, crimson fill, white text, tail corner). Read receipt "✓✓
Read" in crimson under the last sent bubble. A typing indicator with three bouncing dots.
Bottom input bar "Message your trainer..." with a round crimson send button. Above the
input, a row of quick-reply suggestion chips. Clean, premium messenger.
```

### TRAINER (web 1440×1024)

**Trainer Roster**
```
NEXTERA trainer portal roster, dark desktop web. Left sidebar: NEXTERA serif logo, nav
items Roster (active), Check-ins (3), Messages (5), Challenges, Voice. Main area: title
"Roster" + filter pills (All, Needs attention, Check-in due, Dormant, No program) + search.
A list of member rows sorted needs-attention-first: avatar + name + a red "● Check-in due"
dot + "💬 2 unread"; second line "Readiness 38 ⚠ · 9 days since last · 🔥 4 wks"; "Program:
PPL" + an "Open →" button. Dense, dark, data-forward, mono numbers, crimson accents.
```

**Member Deep View (web)**
```
NEXTERA trainer member detail, dark web. Top: member name + "DNA: Powerhouse 🧬". A tab bar
[Overview | Program | Readiness | Recovery | Check-ins | Notes | Messages]. Overview shows
a snapshot card with stat tiles (Readiness 38 ⚠, Recovery Legs 62%, Streak 🔥 4 wks, Last
session 9 days ago, Churn ⚠ High), a "Recent PRs" line, an "Active program" line, and an
action row [Message] [Add note] [Edit program] [Check-in]. Dark, dense, mono numbers,
crimson accents.
```

**Check-in Review (web)**
```
NEXTERA trainer weekly check-in review, dark web. Header "Maria S. · Week Jun 2–8". A
rollup line "3/4 days · 12 sets · 2 PRs · readiness avg 71". A "WINS" line (green) and a
"RISKS" line (amber ⚠). An editable AI-draft textarea with [Regenerate ✨] and [Use as-is].
A private coach-note textarea. A "Program adjustments → Open program editor". A full-width
crimson "Send check-in to Maria" button. Dark, editorial, calm.
```

### OWNER (web 1440×1024)

**Owner Floor Health**
```
NEXTERA owner console, dark web. Left sidebar (Members, Floor Health active, Churn Risk,
Engagement, Branding, Partner Kit, Billing, Settings). Main: a big circular Floor Health
score "78 / 100" with a crimson arc, a 30-day sparkline beneath, and two callout cards: top
contributing factor (green) and top detracting factor (amber). Below, a stat-tile grid
(active members this week, total sessions, current streaks, PRs, challenge participation),
all mono numbers with trend arrows. Premium analytics dashboard, dark, crimson accents.
```

**Owner Machine/Floor Dashboard (web)** — matches the "KNOW WHAT'S WORKING" render
```
NEXTERA owner equipment dashboard, dark web. A KPI strip across the top (Total machines
124, Active now 14, Sessions today 172, Utilization 94%, Demand Low) in mono. A "Machine
status board" table with rows of machines and colored status pills (active green, idle
gray, maintenance amber). Two donut charts for utilization by machine type. A "Recent
activity" list and an "AI recommendations" panel with a crimson "AI" glyph. Dense, dark,
premium, crimson + amber accents on near-black.
```

**Owner Billing (web)**
```
NEXTERA owner billing, dark web. A current-tier card "Growth · $199/mo" with a usage meter
"162 / 300 active members" and a "Change tier" button. A payment-method row, an invoice
list, and a red-bordered "Danger zone" cancel card. A pricing reference table (Starter $149,
Growth $199, Pro $299, Scale $599, Members $0). An amber upgrade banner near the cap. Dark,
trustworthy, mono numbers.
```

### SUPER-ADMIN (web 1440×1024)

**Platform Overview**
```
NEXTERA super-admin platform overview, dark web. Left sidebar (Overview, Gyms, Health, AI
Costs, Flags, Rollouts, Audit, Errors, Platform Defaults). A business header row of stat
tiles: MRR $6,268, ARR $75,216, Net-new MRR, Trials 7 (mono). A five-cell system-health
strip (error rate, 90s p95, push delivery, AI fallback, billing webhooks) with green/amber/
red cells. An all-gyms table sorted sickest-first (gym, tier, status, active members,
sessions 7d, health 0–100 color-banded, MRR). Dense control-room aesthetic, dark, crimson
+ status colors.
```

### PUBLIC / MARKETING

**Public Gym Profile (web/mobile responsive)**
```
NEXTERA public gym page, dark. Hero: full-width gym photo with a dark scrim, gym logo, gym
name as a serif H1, tagline. An identity strip "on Nexera · Austin, TX". A momentum row of
three stat cards (Sessions/30d, PRs/30d, Streak days) with big mono crimson numbers. A
"vibe" line + a top Performance-DNA archetype badge. An anonymized wins feed ("A member hit
a new bench PR."). One big crimson CTA "Join Iron Forge on Nexera" + "Free for members.
Always." Footer "Powered by Nexera". Cinematic, premium, single clear action.
```

**Marketing Hero (web)** — matches your NEXTERA renders
```
A cinematic NEXTERA fitness brand hero, near-black with crimson energy-ribbon light streaks.
Huge high-contrast serif wordmark "NEXTERA" with small-caps "FITNESS" beneath and a tracked
tagline "PERFORM · EVOLVE · ASCEND". A dramatic rim-lit athlete photo on the right and a
floating dark app phone mockup on the left showing a crimson readiness ring. Big serif
statement "THE NEXT ERA OF HUMAN PERFORMANCE" and a line "TRAIN DIFFERENTLY". Three small
value pills (Built for gyms · Designed for members · Backed by science) and app-store
badges. Luxury, editorial, high-end.
```

---

## 13. CONFLICT NOTES & DECISIONS (for whoever maintains this)

- **Visual direction:** chosen = **Red-Luxury NEXTERA** (per owner, matching the marketing renders). This overrides the documented purple `#7C5CFF` system (DOC_18) on color only — the *structure* (token architecture, components, states, motion tiers, haptics, accessibility, 90s rule) is kept intact from the canon.
- **Product name in UI stays "Nexera"**; "NEXTERA" is the stylized serif wordmark treatment for hero/marketing moments.
- **Bottom-nav:** canonical 5 tabs with centered Scan (Home/Program/Scan/Feed/Profile). The home HTML render's "Gym/Progress" labels are superseded.
- **Readiness color logic:** red = intensity. Higher readiness = hotter red glow; rest = dimmed gray. This is intentional and on-brand (the renders show red rings at high scores).
- **Doc precedence (functional content):** UPDATE docs > original docs · DOC_20 (schema) > DOC_21 (logic) > DOC_34 (copy) > DOC_18 (design). All copy above is from the canon; verify final strings against DOC_34.
- **Source coverage:** this file synthesizes all 47 docs (onboarding, home/profile, workout modes, AI engine, readiness, muscle map, DNA, check-ins, social, challenges, gamification, messaging, social graph, backend/admin, super-admin, settings, notifications, brand/partner, error handling) + the HTML mockups + the marketing renders.

---

*NEXTERA — Master Design Specification · for Google Stitch · built from the NEXERA_BUILD library · Red-Luxury direction.*
