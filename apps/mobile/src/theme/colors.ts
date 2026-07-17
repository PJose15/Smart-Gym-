// Nexera color tokens — source of truth: DOC_03_Design_System.md (Sections 2, 17)
export const colors = {
  // Backgrounds (base / elevated / card / card-hover per DOC_03)
  background:      '#0D0D0F',
  surface:         '#141416',
  surfaceElevated: '#1A1A1F',
  surfaceHighest:  '#1F1F26',
  overlay:         'rgba(13, 13, 15, 0.8)',
  bgInput:         '#1A1A1F',
  bgInputFocus:    '#1F1F26',
  bgSuccessSubtle: '#0D2818',
  bgWarningSubtle: '#261D0A',
  bgErrorSubtle:   '#260D0D',
  bgSkeleton:      '#1F1F26',
  bgSkeletonShine: '#252530',

  // Text
  text:            '#FFFFFF',
  textSecondary:   '#A0A0B0',
  textMuted:       '#606070',
  textDisabled:    '#3A3A45',
  textInverse:     '#0D0D0F',
  textOnAccent:    '#FFFFFF',

  // Borders
  border:          'rgba(255, 255, 255, 0.10)',
  borderSubtle:    'rgba(255, 255, 255, 0.05)',
  borderStrong:    'rgba(255, 255, 255, 0.20)',
  borderAccent:    'rgba(124, 92, 255, 0.25)',

  // Primary — Nexera Purple accent
  primary:         '#7C5CFF',
  primaryDark:     '#6040E0',
  primaryLight:    '#9070FF',
  primarySubtle:   'rgba(124, 92, 255, 0.10)',
  accentGlow:      'rgba(124, 92, 255, 0.25)',

  // Gold (gamification — top rank, PRs, champion)
  gold:            '#FFD700',
  goldLight:       '#FFE566',
  goldDark:        '#D4B300',
  goldSubtle:      'rgba(255, 215, 0, 0.10)',
  goldGlow:        'rgba(255, 215, 0, 0.25)',
  silver:          '#C0C0C0',
  bronze:          '#CD7F32',

  // Amber (streak fire family — maps to streak-hot)
  amber:           '#FF6B35',
  amberLight:      '#FF8F66',
  amberDark:       '#E5501F',
  amberSubtle:     'rgba(255, 107, 53, 0.10)',

  // Green (Success)
  success:         '#00C896',
  successLight:    '#00E0A8',
  successDark:     '#00A87E',
  successSubtle:   'rgba(0, 200, 150, 0.10)',

  // Purple (matches accent)
  purple:          '#7C5CFF',
  purpleLight:     '#9070FF',
  purpleDark:      '#6040E0',
  purpleSubtle:    'rgba(124, 92, 255, 0.10)',

  // Red (Error)
  error:           '#FF4D6A',
  errorLight:      '#FF7A90',
  errorSubtle:     'rgba(255, 77, 106, 0.10)',

  // Semantic aliases
  warning:         '#FFB020',
  warningSubtle:   'rgba(255, 176, 32, 0.10)',
  info:            '#3B82F6',
  infoSubtle:      'rgba(59, 130, 246, 0.10)',
  streak:          '#FF6B35',
  level:           '#7C5CFF',
  pr:              '#FFD700',
  xp:              '#7C5CFF',

  // Streak tiers
  streakCold:      '#606070',
  streakWarm:      '#FFB020',
  streakHot:       '#FF6B35',
  streakFire:      '#FF3D00',
  streakInferno:   '#FF1744',
  streakLegend:    '#D500F9',

  // Readiness zones
  readinessPeak:     '#00C896',
  readinessReady:    '#7C5CFF',
  readinessModerate: '#FFB020',
  readinessRest:     '#FF4D6A',

  // DNA dimensions
  dnaPower:        '#FF4D6A',
  dnaConsistency:  '#00C896',
  dnaProgression:  '#7C5CFF',
  dnaBalance:      '#3B82F6',
  dnaMindset:      '#FFB020',

  // Muscle recovery states
  muscleFresh:      '#00C896',
  musclePrimed:     '#7C5CFF',
  muscleTrained:    '#3B82F6',
  muscleFatigued:   '#FFB020',
  muscleRecovering: '#FF4D6A',

  // Utility
  white:           '#FFFFFF',
  black:           '#000000',
  dark:            '#0D0D0F',
  transparent:     'transparent',
} as const;
