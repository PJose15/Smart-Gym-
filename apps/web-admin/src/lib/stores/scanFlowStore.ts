import { create } from 'zustand';
import type { WeightUnit } from '@/lib/weight';

// ── Flow Steps ─────────────────────────────────────────────
export type FlowStep =
  | 'landing'
  | 'auth_phone'
  | 'auth_otp'
  | 'onboard_goal'
  | 'onboard_experience'
  | 'welcome'
  | 'logging'
  | 'complete';

// ── Machine Data (from API) ────────────────────────────────
export interface MachineData {
  id: string;
  gym_id: string;
  name: string;
  qr_slug: string;
  category: string;
  muscle_groups: string[];
  instructions: string | null;
  demo_image_url: string | null;
  location_in_gym: string | null;
  is_active: boolean;
  gym: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };
}

// ── Member Data (after auth) ───────────────────────────────
export interface MemberData {
  id: string;
  user_id: string | null;
  display_name: string;
  first_name: string | null;
  phone: string | null;
  primary_goal: string | null;
  experience_level: string | null;
  onboarding_status: string;
  gym_id: string;
  /**
   * Member display preference for weight values. Sourced from
   * `member_settings.weight_unit`; defaults to 'lbs'. Storage format is
   * always lbs — this only affects UI rendering in the scan flow.
   */
  weight_unit: WeightUnit;
}

// ── Program Context (from active AI program) ────────────────
export interface ProgramContext {
  program_id: string;
  title: string;
  week_number: number;
  day_number: number;
  sessions_completed: number;
  sessions_total: number;
  today_plan: { day_name: string; exercise_count: number } | null;
  machine_in_plan: boolean;
  target_exercise: {
    exercise_name: string;
    default_sets: number;
    default_reps: number;
  } | null;
}

// ── Auth Path ──────────────────────────────────────────────
export type AuthPath = 'cold' | 'preloaded' | 'returning';

// ── Store State ────────────────────────────────────────────
interface ScanFlowState {
  // Flow
  step: FlowStep;
  previousStep: FlowStep | null;

  // Machine
  machine: MachineData | null;

  // Auth
  authPath: AuthPath | null;
  phone: string | null;

  // Member
  member: MemberData | null;

  // Session
  sessionId: string | null;

  // Scan analytics
  scanTimestamp: number | null;
  scanEventId: string | null;

  // Onboarding selections
  selectedGoal: string | null;
  selectedExperience: string | null;

  // Program context
  programContext: ProgramContext | null;

  // Actions
  setMachine: (machine: MachineData) => void;
  goTo: (step: FlowStep) => void;
  setAuthPath: (path: AuthPath) => void;
  setPhone: (phone: string) => void;
  setMember: (member: MemberData) => void;
  setSessionId: (id: string) => void;
  setScanTimestamp: (ts: number) => void;
  setScanEventId: (id: string) => void;
  setSelectedGoal: (goal: string) => void;
  setSelectedExperience: (experience: string) => void;
  setProgramContext: (ctx: ProgramContext | null) => void;
  reset: () => void;
}

const initialState = {
  step: 'landing' as FlowStep,
  previousStep: null as FlowStep | null,
  machine: null as MachineData | null,
  authPath: null as AuthPath | null,
  phone: null as string | null,
  member: null as MemberData | null,
  sessionId: null as string | null,
  scanTimestamp: null as number | null,
  scanEventId: null as string | null,
  selectedGoal: null as string | null,
  selectedExperience: null as string | null,
  programContext: null as ProgramContext | null,
};

export const useScanFlowStore = create<ScanFlowState>((set) => ({
  ...initialState,

  setMachine: (machine) => set({ machine }),

  goTo: (step) =>
    set((state) => ({
      step,
      previousStep: state.step,
    })),

  setAuthPath: (authPath) => set({ authPath }),
  setPhone: (phone) => set({ phone }),
  setMember: (member) => set({ member }),
  setSessionId: (sessionId) => set({ sessionId }),
  setScanTimestamp: (scanTimestamp) => set({ scanTimestamp }),
  setScanEventId: (scanEventId) => set({ scanEventId }),
  setSelectedGoal: (selectedGoal) => set({ selectedGoal }),
  setSelectedExperience: (selectedExperience) => set({ selectedExperience }),
  setProgramContext: (programContext) => set({ programContext }),

  reset: () => set(initialState),
}));
