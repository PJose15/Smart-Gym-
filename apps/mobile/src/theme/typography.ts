// Nexera typography tokens — source of truth: DOC_03_Design_System.md (Sections 3, 17)
// Font family names must match the keys registered via useFonts in app/_layout.tsx.
export const typography = {
  // Sizes (RN points — mirror the web px scale)
  displaySize: 48,
  h1Size:      32,
  h2Size:      24,
  h3Size:      20,
  h4Size:      17,
  bodyLgSize:  16,
  bodySize:    15,
  smallSize:   13,
  tinySize:    11,
  labelSize:   12,

  // Line heights (multipliers per DOC_03 §3)
  displayLeading: 1.1,
  h1Leading:      1.2,
  h2Leading:      1.3,
  h3Leading:      1.4,
  h4Leading:      1.4,
  bodyLeading:    1.6,
  smallLeading:   1.5,
  tinyLeading:    1.4,
  labelLeading:   1.0,
  statLeading:    1.0,

  // Font family names (registered in app/_layout.tsx)
  fontRegular:   'Inter-Regular',
  fontMedium:    'Inter-Medium',
  fontSemiBold:  'Inter-SemiBold',
  fontBold:      'Inter-Bold',
  fontExtraBold: 'Inter-ExtraBold',
  fontMono:      'Mono-Regular',
  fontMonoBold:  'Mono-Bold',
  // Editorial serif (Playfair Display) — brand moments, hero headlines only
  fontSerif:     'Serif-SemiBold',
  fontSerifBold: 'Serif-Bold',
} as const;
