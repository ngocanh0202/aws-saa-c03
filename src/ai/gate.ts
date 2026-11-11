export type AiJobTarget = | { page: 'attempt'; attemptId: string; qid: number; highlightId?: string } | { page: 'notes'; qid: number; highlightId: string };
