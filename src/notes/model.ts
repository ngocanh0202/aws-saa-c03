export type HighlightPart = 'stem' | 'prompt';

export interface Highlight {
  id: string;
  part: HighlightPart;
  start: number;
  end: number;
  text: string;
  note: string;
  updatedAt: number;
}

export interface QuestionNotes {
  /** Canonical id. */
  qid: number;
  highlights: Highlight[];
  updatedAt: number;
}

export const NOTE_MAX = 2000;

const clip = (s: string) => s.slice(0, NOTE_MAX);

export function addHighlight(
  notes: QuestionNotes,
  h: { part: HighlightPart; start: number; end: number; text: string },
  partText: string,
  id: string,
  now: number,
): { notes: QuestionNotes; id: string } {
  let start = h.start;
  let end = h.end;
  const merged: Highlight[] = [];
  const rest: Highlight[] = [];
  for (const o of notes.highlights) {
    if (o.part === h.part && o.start <= h.end && o.end >= h.start) {
      merged.push(o);
      start = Math.min(start, o.start);
      end = Math.max(end, o.end);
    } else rest.push(o);
  }
  const resultId = merged[0]?.id ?? id;
  const note = clip(merged.map((o) => o.note).filter((n) => n !== '').join('\n\n'));
  const result: Highlight = { id: resultId, part: h.part, start, end, text: partText.slice(start, end), note, updatedAt: now };
  return { notes: { ...notes, highlights: [...rest, result], updatedAt: now }, id: resultId };
}

export function setNote(notes: QuestionNotes, id: string, note: string, now: number): QuestionNotes {
  return {
    ...notes,
    highlights: notes.highlights.map((h) => (h.id === id ? { ...h, note: clip(note), updatedAt: now } : h)),
    updatedAt: now,
  };
}

export function removeHighlight(notes: QuestionNotes, id: string, now: number): QuestionNotes {
  return { ...notes, highlights: notes.highlights.filter((h) => h.id !== id), updatedAt: now };
}

export function locate(h: Highlight, partText: string): { start: number; end: number } | null {
  if (partText.slice(h.start, h.end) === h.text) return { start: h.start, end: h.end };
  if (h.text === '') return null;
  let best = -1;
  for (let i = partText.indexOf(h.text); i !== -1; i = partText.indexOf(h.text, i + 1)) {
    if (best === -1 || Math.abs(i - h.start) < Math.abs(best - h.start)) best = i;
  }
  return best === -1 ? null : { start: best, end: best + h.text.length };
}

export function mergeNotes(
  local: QuestionNotes | undefined,
  remote: QuestionNotes | undefined,
): 'local' | 'remote' | 'same' {
  if (!local && !remote) return 'same';
  if (!local) return 'remote';
  if (!remote) return 'local';
  if (local.updatedAt > remote.updatedAt) return 'local';
  if (local.updatedAt < remote.updatedAt) return 'remote';
  return JSON.stringify(local) === JSON.stringify(remote) ? 'same' : 'remote';
}
