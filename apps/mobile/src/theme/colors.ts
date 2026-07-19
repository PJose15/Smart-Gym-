// Nexera color tokens — source of truth: design/stitch (NEXTERA Red-Luxury design system)
// Canvas hierarchy per design.md: L0 base #0A0A0C, L1 elevated #121214, L2 card #16161A.
// Chromatic color is reserved for energy/action — crimson #E0142F, glow #FF2740, gold #E8B339.
export const colors = {
  // Backgrounds (tonal layers, no physical shadows)
  background:      '#0A0A0C',
  surface:         '#121214',
  surfaceElevated: '#16161A',
  surfaceHighest:  '#201F21',
  overlay:         'rgba(10, 10, 12, 0.8)',
  bgInput:         '#16161A',
  bgInputFocus:    '#201F21',
  bgSuccessSubtle: '#0D2818',
  bgWarningSubtle: '#261D0A',
  bgErrorSubtle:   '#260D0D',
  bgSkeleton:      '#1C1B1D',
  bgSkeletonShine: '#252528',

  // Text
  text:            '#FFFFFF',
  textSecondary:   '#B5B2B8',
  textMuted:       '#6B6870',
  textDisabled:    '#3A383E',
  textInverse:     '#0A0A0C',
  textOnAccent:    '#FFFFFF',

  // Borders (hairline 1px per design system)
  border:          'rgba(255, 255, 255, 0.07)',
  borderSubtle:    'rgba(255, 255, 255, 0.04)',
  borderStrong:    'rgba(255, 255, 255, 0.16)',
  borderAccent:    'rgba(224, 20, 47, 0.35)',

  // Primary — Crimson Signature (#E0142F), glow variant for interactive peaks
  primary:         '#E0142F',
  primaryDark:     '#8A0D1E',
  primaryLight:    '#FF2740',
  primarySubtle:   'rgba(224, 20, 47, 0.10)',
  accentGlow:      'rgba(224, 20, 47, 0.28)',

  // Gold (gamification — top rank, PRs, champion)
  gold:            '#E8B339',
  goldLight:       '#F2C75C',
  goldDark:        '#C4922A',
  goldSubtle:      'rgba(232, 179, 57, 0.10)',
  goldGlow:        'rgba(232, 179, 57, 0.25)',
  silver:          '#C0C0C0',
  bronze:          '#CD7F32',

  // Amber (streak fire family — maps to streak-hot)
  amber:           '#FF6B35',
  amberLight:      '#FF8F66',
  amberDark:       '#E5501F',
  amberSubtle:     'rgba(255, 107, 53, 0.10)',

  // Green (Success — desaturated status tint, red keeps brand dominance)
  success:         '#00C896',
  successLight:    '#00E0A8',
  successDark:     '#00A87E',
  successSubtle:   'rgba(0, 200, 150, 0.10)',

  // Accent alias (legacy purple names — now crimson)
  purple:          '#E0142F',
  purpleLight:     '#FF2740',
  purpleDark:      '#8A0D1E',
  purpleSubtle:    'rgba(224, 20, 47, 0.10)',

  // Red (Error — kept distinct from brand crimson)
  error:           '#FF4D6A',
  errorLight:      '#FF7A90',
  errorSubtle:     'rgba(255, 77, 106, 0.10)',

  // Semantic aliases
  warning:         '#FFB020',
  warningSubtle:   'rgba(255, 176, 32, 0.10)',
  info:            '#3B82F6',
  infoSubtle:      'rgba(59, 130, 246, 0.10)',
  streak:          '#FF6B35',
  level:           '#E0142F',
  pr:              '#E8B339',
  xp:              '#E0142F',

  // Streak tiers
  streakCold:      '#6B6870',
  streakWarm:      '#FFB020',
  streakHot:       '#FF6B35',
  streakFire:      '#FF3D00',
  streakInferno:   '#FF1744',
  streakLegend:    '#D500F9',

  // Readiness zones (ready = brand crimson, rest = softer error red)
  readinessPeak:     '#00C896',
  readinessReady:    '#E0142F',
  readinessModerate: '#FFB020',
  readinessRest:     '#FF7A90',

  // DNA dimensions
  dnaPower:        '#FF2740',
  dnaConsistency:  '#00C896',
  dnaProgression:  '#E0142F',
  dnaBalance:      '#3B82F6',
  dnaMindset:      '#FFB020',

  // Muscle recovery states
  muscleFresh:      '#00C896',
  musclePrimed:     '#E0142F',
  muscleTrained:    '#3B82F6',
  muscleFatigued:   '#FFB020',
  muscleRecovering: '#FF7A90',

  // Utility
  white:           '#FFFFFF',
  black:           '#000000',
  dark:            '#0A0A0C',
  transparent:     'transparent',
} as const;
