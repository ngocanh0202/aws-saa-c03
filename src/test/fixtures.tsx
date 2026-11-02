import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider, type AppDeps } from '../app/context';
import { AppRoutes } from '../app/routes';
import { buildBank, type Bank } from '../data/bank';
import type { Difficulty, Domain, Question, QuestionMeta } from '../data/types';
import { createStore } from '../storage/storage';

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function makeQuestion(id: number, keys = ['A', 'B', 'C', 'D'], answer = ['A']): Question {
  return {
    id,
    stem: `Stem ${id}`,
    prompt: `Prompt ${id}?`,
    options: keys.map((key) => ({ key, text: `Option ${key} of ${id}` })),
    answer,
    choose: answer.length,
    explanationOrig: `Giải thích gốc ${id}`,
  };
}

function domainOf(id: number): Domain {
  if (id <= 65) return id <= 20 ? 1 : id <= 37 ? 2 : id <= 52 ? 3 : 4;
  return ([1, 1, 1, 2, 2, 2, 3, 3, 4, 4] as Domain[])[id - 66];
}

/** Đề main giả (id 101): 3 câu HTML 10101–10103; câu 10101 có ghi chú review. */
export const MAIN_IDS = [10101, 10102, 10103];

function makeMainQuestion(id: number): Question {
  return {
    id,
    stem: `<p>Main stem <strong>${id}</strong></p>`,
    prompt: '',
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `<p>Main opt ${key} of ${id}</p>` })),
    answer: ['B'],
    choose: 1,
    explanationOrig: `<p>Main explanation <em>${id}</em></p>`,
    html: true,
  };
}

export function makeBank({ main = false }: { main?: boolean } = {}): Bank {
  const ids = range(1, 75);
  const questions = ids.map((id) => (id === 2 ? makeQuestion(2, ['A', 'B', 'C', 'D', 'E'], ['A', 'C']) : makeQuestion(id)));
  const metas: QuestionMeta[] = ids.map((id) => ({
    id,
    domain: domainOf(id),
    difficulty: ((id % 3) + 1) as Difficulty,
    services: id === 1 ? ['s3'] : [],
  }));
  if (main) {
    questions.push(...MAIN_IDS.map(makeMainQuestion));
    metas.push(...MAIN_IDS.map((id) => ({ id, domain: 2 as const, difficulty: 2 as const, services: [], ...(id === 10101 ? { note: 'Đáp án đáng ngờ' } : {}) })));
  }
  return buildBank({
    questions,
    metas,
    mainSets: main ? [{ id: 101, file: 'pt1_1.json', title: 'Main 1', questionIds: MAIN_IDS }] : [],
    vis: [
      {
        id: 1,
        stemVi: 'Đề bài câu 1 bằng tiếng Việt',
        promptVi: 'Câu hỏi 1 bằng tiếng Việt?',
        options: ['A', 'B', 'C', 'D'].map((key) => ({ key, textVi: `Lựa chọn ${key} tiếng Việt`, reason: `Lý do ${key}` })),
        explanationVi: 'Giải thích tiếng Việt câu 1',
        keyHint: 'Dấu hiệu nhận biết câu 1',
      },
    ],
    registry: [{ id: 's3', name: 'Amazon S3', category: 'Storage' }],
    sets: { version: 1, sets: [{ id: 1, questionIds: range(1, 65) }], reserve: range(66, 75) },
    externals: [
      {
        slug: 'quiz',
        file: 'quiz.html',
        title: 'Quiz ngoài',
        questions: [1, 2, 3].map((id) => ({ ...makeQuestion(id), stem: `Ext stem ${id}`, prompt: `Ext prompt ${id}?` })),
      },
    ],
    externalVis: {
      quiz: [
        {
          id: 1,
          stemVi: 'Đề ngoài 1',
          promptVi: 'Câu hỏi ngoài 1?',
          options: ['A', 'B', 'C', 'D'].map((key) => ({ key, textVi: `Ngoài ${key}`, reason: `Lý do ngoài ${key}` })),
          explanationVi: 'Giải thích ngoài câu 1',
          keyHint: 'Dấu hiệu ngoài câu 1',
        },
      ],
    },
  });
}

export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

export function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  let n = 0;
  return {
    bank: makeBank(),
    store: createStore(memoryStorage()),
    now: () => 1_000_000,
    newSeed: () => 42,
    newId: () => `att-${++n}`,
    ...overrides,
  };
}

export function renderApp(path: string, deps: AppDeps) {
  return render(
    <AppProvider deps={deps}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProvider>,
  );
}
