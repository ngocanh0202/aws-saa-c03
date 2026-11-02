export type Domain = 1 | 2 | 3 | 4;
export type Difficulty = 1 | 2 | 3;

export interface Option {
  key: string;
  text: string;
}

export interface Question {
  id: number;
  stem: string;
  prompt: string;
  options: Option[];
  answer: string[];
  choose: number;
  explanationOrig: string;
}

export interface QuestionMeta {
  id: number;
  domain: Domain;
  difficulty: Difficulty;
  services: string[];
}

export interface ViOption {
  key: string;
  textVi: string;
  reason: string;
}

export interface QuestionVi {
  id: number;
  stemVi: string;
  promptVi: string;
  options: ViOption[];
  explanationVi: string;
  keyHint: string;
  review?: { reason: string };
}

export interface ServiceRef {
  id: string;
  name: string;
  category: string;
}

export interface ServiceNote extends ServiceRef {
  tier: 'core' | 'minor';
  overview: string;
  concepts?: { term: string; desc: string }[];
  howItWorks?: string;
  useCases?: string[];
  pricing?: string;
  examSignals: string[];
  compareWith: { service: string; diff: string }[];
  facts?: string[];
  practice?: { steps: string[]; freeTier: string; cleanup: string[] };
}

export interface ExamSet {
  id: number;
  questionIds: number[];
}

export interface SetsFile {
  version: number;
  sets: ExamSet[];
  reserve: number[];
  duplicates?: [number, number][];
}

/** Bộ câu hỏi dựng từ một file HTML trong `external/` (sinh bởi `npm run external`). */
export interface ExternalSet {
  slug: string;
  file: string;
  title: string;
  questions: Question[];
}
