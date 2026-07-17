/**
 * Skeleton loader system — DOC_03 Section 14.
 *
 * Base `Skeleton` + the 8 canonical page layouts. Three layouts already
 * existed as route-level components (built to match real content
 * dimensions), so they are re-exported here under their spec names rather
 * than duplicated. All blocks share the single `.skeleton` shimmer
 * animation defined in styles/animations.css.
 */
export { Skeleton } from './Skeleton';

// New layouts
export { MachineSkeleton } from './MachineSkeleton';
export { WorkoutSkeleton } from './WorkoutSkeleton';
export { FeedSkeleton } from './FeedSkeleton';
export { LeaderboardSkeleton } from './LeaderboardSkeleton';
export { TrainerMemberSkeleton } from './TrainerMemberSkeleton';

// Pre-existing route-level layouts, re-exported under DOC_03 §14 names
export { HomeScreenSkeleton as HomePageSkeleton } from '@/app/(member)/home/components/HomeScreenSkeleton';
export { ProfilePageSkeleton as ProfileSkeleton } from '@/app/(member)/profile/components/ProfilePageSkeleton';
export { ProgressPageSkeleton as ProgressSkeleton } from '@/app/(member)/progress/components/ProgressPageSkeleton';
