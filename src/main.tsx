import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider, type AppDeps } from './app/context';
import { AppRoutes } from './app/routes';
import { createAiMode } from './ai/ai-mode';
import { createNotesStore } from './notes/store';
import { createCooldown } from './ai/cooldown';
import { createLocalAiClient } from './ai/local';
import { buildAiDeps } from './ai/deps';
import { createGeminiClient } from './ai/gemini';
import { bank } from './data/load';
import { randomSeed } from './engine/rng';
import { createStore, getBrowserStorage } from './storage/storage';
import { readFirebaseConfig, readLocalAiConfig } from './sync/config';
import { createSyncController } from './sync/controller';
import { createFirebaseClients } from './sync/firebase';
import type { SyncController } from './sync/types';
import './styles.css';

const config = readFirebaseConfig(import.meta.env);
const clients = config ? createFirebaseClients(config) : null;
// Đồng hồ hiệu chỉnh theo server khi có phiên đăng nhập; khách (không phiên) dùng Date.now().
// `sync` gán sau vì controller cần store, còn store cần now.
let sync: SyncController | undefined;
const now = () => Date.now() + (sync?.serverOffset() ?? 0);
const store = createStore(getBrowserStorage(), { now, watch: true });
sync = clients ? createSyncController({ store, auth: clients.auth, remote: clients.remote }) : undefined;

const aiDeps = buildAiDeps(config, clients, createGeminiClient, { config: readLocalAiConfig(import.meta.env), create: createLocalAiClient });

const deps: AppDeps = {
  bank,
  store,
  now,
  newSeed: randomSeed,
  newId: () => crypto.randomUUID(),
  notes: createNotesStore(getBrowserStorage()),
  sync,
  ...aiDeps,
  aiCooldown: createCooldown(getBrowserStorage()),
  aiMode: aiDeps.localAi ? createAiMode(getBrowserStorage()) : undefined,
  support: clients?.support,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider deps={deps}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  </StrictMode>,
);
