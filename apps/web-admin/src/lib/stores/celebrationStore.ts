import { create } from 'zustand';

interface AchievementItem {
  type: 'achievement';
  code: string;
  title: string;
  points: number;
}

interface LevelUpItem {
  type: 'level-up';
  level: number;
  name: string;
  color: string;
}

type CelebrationItem = AchievementItem | LevelUpItem;

interface CelebrationState {
  queue: CelebrationItem[];
  current: CelebrationItem | null;

  addAchievement: (code: string, title: string, points: number) => void;
  addLevelUp: (level: number, name: string, color: string) => void;
  dismiss: () => void;
}

export const useCelebrationStore = create<CelebrationState>((set, get) => ({
  queue: [],
  current: null,

  addAchievement: (code, title, points) => {
    const item: AchievementItem = { type: 'achievement', code, title, points };
    const state = get();
    if (!state.current) {
      set({ current: item });
    } else {
      set({ queue: [...state.queue, item] });
    }
  },

  addLevelUp: (level, name, color) => {
    const item: LevelUpItem = { type: 'level-up', level, name, color };
    const state = get();
    // Level-up gets priority — insert at front of queue
    if (!state.current) {
      set({ current: item });
    } else if (state.current.type === 'achievement') {
      // Swap: move current to queue, show level-up now
      set({ current: item, queue: [state.current, ...state.queue] });
    } else {
      set({ queue: [item, ...state.queue] });
    }
  },

  dismiss: () => {
    const state = get();
    const [next, ...rest] = state.queue;
    if (next) {
      set({ current: next, queue: rest });
    } else {
      set({ current: null, queue: [] });
    }
  },
}));
