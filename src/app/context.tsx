import { createContext, useContext, type ReactNode } from 'react';
import type { Cooldown } from '../ai/cooldown';
import type { AiClient, ChatHistoryStore } from '../ai/types';
import type { Bank } from '../data/bank';
import type { AttemptStore } from '../storage/storage';
import type { SyncController } from '../sync/types';

export interface AppDeps {
  bank: Bank;
  store: AttemptStore;
  now: () => number;
  newSeed: () => number;
  newId: () => string;
  /** Không có khi chưa cấu hình Firebase. */
  sync?: SyncController;
  /** Chỉ có khi cấu hình Firebase. */
  ai?: AiClient;
  /** Chỉ có khi cấu hình Firebase. */
  chats?: ChatHistoryStore;
  /** Khóa Gemini sau lỗi hết lượt (lưu localStorage); không có thì dùng bản trong bộ nhớ. */
  aiCooldown?: Cooldown;
}

const AppContext = createContext<AppDeps | null>(null);

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  return <AppContext.Provider value={deps}>{children}</AppContext.Provider>;
}

export function useApp(): AppDeps {
  const deps = useContext(AppContext);
  if (!deps) throw new Error('useApp phải nằm trong AppProvider');
  return deps;
}
