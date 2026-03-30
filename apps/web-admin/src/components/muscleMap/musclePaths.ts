import type { MuscleGroupKey, BodySide } from '@nexera/types';

/**
 * Simplified geometric SVG paths for each muscle group.
 * Coordinates for a 200x400 viewBox body silhouette.
 */

export interface MusclePath {
  key: MuscleGroupKey;
  side: BodySide;
  d: string;
  cx: number;
  cy: number;
}

// ── Front Body Paths (200×400 viewBox) ──────────────────

export const FRONT_PATHS: MusclePath[] = [
  // Chest — two pec shapes
  { key: 'chest', side: 'front', d: 'M70,95 Q80,85 100,88 Q120,85 130,95 Q130,110 100,115 Q70,110 70,95Z', cx: 100, cy: 100 },
  // Front Delts — shoulder caps
  { key: 'front_delts', side: 'front', d: 'M58,80 Q55,70 65,65 Q75,65 78,80 Q70,88 58,80Z M122,80 Q125,70 135,65 Q145,65 142,80 Q130,88 122,80Z', cx: 100, cy: 72 },
  // Side Delts — outer shoulder
  { key: 'side_delts', side: 'front', d: 'M50,75 Q48,65 55,60 Q60,58 65,65 L58,80Z M150,75 Q152,65 145,60 Q140,58 135,65 L142,80Z', cx: 100, cy: 68 },
  // Biceps — upper arm front
  { key: 'biceps', side: 'front', d: 'M55,95 Q52,105 52,125 Q55,135 62,130 Q65,115 62,95Z M138,95 Q148,105 148,125 Q145,135 138,130 Q135,115 138,95Z', cx: 100, cy: 115 },
  // Forearms
  { key: 'forearms', side: 'front', d: 'M52,135 Q50,150 48,170 Q52,175 56,170 Q58,150 55,135Z M148,135 Q150,150 152,170 Q148,175 144,170 Q142,150 145,135Z', cx: 100, cy: 155 },
  // Abs — six-pack area
  { key: 'abs', side: 'front', d: 'M88,120 L112,120 L112,175 L88,175Z', cx: 100, cy: 148 },
  // Obliques — sides of torso
  { key: 'obliques', side: 'front', d: 'M72,120 L88,120 L85,175 L72,170Z M112,120 L128,120 L128,170 L115,175Z', cx: 100, cy: 148 },
  // Quads — front thighs
  { key: 'quads', side: 'front', d: 'M75,195 Q72,230 73,270 Q80,280 90,275 Q92,240 88,195Z M125,195 Q128,230 127,270 Q120,280 110,275 Q108,240 112,195Z', cx: 100, cy: 235 },
  // Hip Flexors — upper inner thigh
  { key: 'hip_flexors', side: 'front', d: 'M88,185 L100,185 L100,210 L92,215 L88,210Z M100,185 L112,185 L112,210 L108,215 L100,210Z', cx: 100, cy: 200 },
];

// ── Back Body Paths (200×400 viewBox) ──────────────────

export const BACK_PATHS: MusclePath[] = [
  // Rear Delts
  { key: 'rear_delts', side: 'back', d: 'M58,80 Q55,70 65,65 Q75,65 78,80 Q70,88 58,80Z M122,80 Q125,70 135,65 Q145,65 142,80 Q130,88 122,80Z', cx: 100, cy: 72 },
  // Triceps — back of upper arm
  { key: 'triceps', side: 'back', d: 'M55,95 Q52,105 52,130 Q55,138 62,133 Q65,115 62,95Z M138,95 Q148,105 148,130 Q145,138 138,133 Q135,115 138,95Z', cx: 100, cy: 115 },
  // Upper Back — traps/rhomboids area
  { key: 'upper_back', side: 'back', d: 'M75,75 L125,75 L125,110 L75,110Z', cx: 100, cy: 92 },
  // Lats — V-shape
  { key: 'lats', side: 'back', d: 'M68,110 L88,110 L82,160 L68,155Z M132,110 L112,110 L118,160 L132,155Z', cx: 100, cy: 135 },
  // Lower Back — erector spinae
  { key: 'lower_back', side: 'back', d: 'M88,140 L112,140 L112,180 L88,180Z', cx: 100, cy: 160 },
  // Glutes
  { key: 'glutes', side: 'back', d: 'M75,185 Q72,200 80,215 Q90,220 100,215 Q100,200 95,185Z M125,185 Q128,200 120,215 Q110,220 100,215 Q100,200 105,185Z', cx: 100, cy: 200 },
  // Hamstrings — back of thighs
  { key: 'hamstrings', side: 'back', d: 'M78,220 Q75,255 76,285 Q83,290 90,285 Q92,255 90,220Z M122,220 Q125,255 124,285 Q117,290 110,285 Q108,255 110,220Z', cx: 100, cy: 255 },
  // Calves — back of lower legs
  { key: 'calves', side: 'back', d: 'M80,295 Q78,320 79,350 Q84,355 90,350 Q91,320 89,295Z M120,295 Q122,320 121,350 Q116,355 110,350 Q109,320 111,295Z', cx: 100, cy: 325 },
];

export const ALL_MUSCLE_PATHS = [...FRONT_PATHS, ...BACK_PATHS];

// Body silhouette outline for the front/back views
export const BODY_OUTLINE_FRONT = 'M100,20 Q80,20 70,35 Q60,50 55,60 Q48,65 45,75 Q42,85 45,100 Q42,115 45,135 Q44,155 42,175 L48,178 Q52,140 55,135 Q58,140 62,95 Q70,88 78,80 Q90,78 100,80 Q110,78 122,80 Q130,88 138,95 Q142,140 145,135 Q148,140 152,175 L158,178 Q155,155 155,135 Q158,115 155,100 Q158,85 155,75 Q152,65 145,60 Q140,50 130,35 Q120,20 100,20Z M62,175 Q55,195 50,230 Q52,250 55,260 Q50,280 45,310 Q44,340 48,370 Q55,380 62,370 Q70,350 75,310 Q82,290 88,195 L88,185 Q82,180 75,180Z M138,175 Q145,195 150,230 Q148,250 145,260 Q150,280 155,310 Q156,340 152,370 Q145,380 138,370 Q130,350 125,310 Q118,290 112,195 L112,185 Q118,180 125,180Z';
export const BODY_OUTLINE_BACK = BODY_OUTLINE_FRONT;
