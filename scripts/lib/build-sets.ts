import { DOMAINS, DOMAIN_QUOTA, SET_COUNT } from '../../src/data/constants';
import type { Difficulty, Domain, Question, QuestionMeta, SetsFile } from '../../src/data/types';
import { mulberry32, shuffle } from '../../src/engine/rng';

export interface BuildSetsOptions {
  seed: number;
  setCount: number;
  quota: Record<Domain, number>;
}

export const DEFAULT_BUILD: BuildSetsOptions = { seed: 20260924, setCount: SET_COUNT, quota: DOMAIN_QUOTA };

const DIFFICULTIES: Difficulty[] = [1, 2, 3];

export function findDuplicatePairs(questions: Question[]): [number, number][] {
  const pairs: [number, number][] = [];
  const seen = new Set<number>();

  for (let i = 0; i < questions.length; i++) {
    if (seen.has(questions[i].id)) continue;
    const q1 = questions[i];
    const q1Text = q1.options.map((o) => o.text.trim()).join('|');

    for (let j = i + 1; j < questions.length; j++) {
      const q2 = questions[j];
      if (q1.stem.trim() === q2.stem.trim() && q1.prompt.trim() === q2.prompt.trim()) {
        const q2Text = q2.options.map((o) => o.text.trim()).join('|');
        if (q1Text === q2Text) {
          const pair: [number, number] = q1.id < q2.id ? [q1.id, q2.id] : [q2.id, q1.id];
          pairs.push(pair);
          seen.add(q2.id);
          break;
        }
      }
    }
  }

  return pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function allocate(groupSizes: number[], need: number): number[] {
  const total = groupSizes.reduce((a, b) => a + b, 0);
  if (total <= need) return groupSizes.slice();
  const exact = groupSizes.map((n) => (n * need) / total);
  const base = exact.map(Math.floor);
  let left = need - base.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - base[i] })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left === 0) break;
    if (base[i] < groupSizes[i]) {
      base[i]++;
      left--;
    }
  }
  return base;
}

export function buildSets(
  metas: QuestionMeta[],
  opts: BuildSetsOptions = DEFAULT_BUILD,
  duplicates: [number, number][] = [],
): { file: SetsFile; warnings: string[] } {
  const rng = mulberry32(opts.seed);
  const warnings: string[] = [];
  const sets: number[][] = Array.from({ length: opts.setCount }, () => []);
  const reserveByDomain = new Map<Domain, QuestionMeta[]>();
  const sorted = [...metas].sort((a, b) => a.id - b.id);

  for (const d of DOMAINS) {
    const need = opts.quota[d] * opts.setCount;
    const groups = DIFFICULTIES.map((diff) =>
      shuffle(
        sorted.filter((m) => m.domain === d && m.difficulty === diff),
        rng,
      ),
    );
    const take = allocate(
      groups.map((g) => g.length),
      need,
    );
    const picked = groups.flatMap((g, i) => g.slice(0, take[i]));
    reserveByDomain.set(
      d,
      groups.flatMap((g, i) => g.slice(take[i])),
    );
    // `picked` đã xếp từ dễ đến khó: chia thành từng khúc liên tiếp để đề 1 dễ nhất, đề cuối khó nhất.
    // Domain thiếu câu thì khúc nhỏ lại đều nhau, để chỗ thiếu không dồn hết vào đề cuối.
    picked.forEach((m, i) => sets[Math.floor((i * opts.setCount) / picked.length)].push(m.id));
    if (picked.length < need) warnings.push(`Domain ${d} chỉ có ${picked.length}/${need} câu cho ${opts.setCount} đề`);
  }

  // Handle duplicate pairs FIRST: swap larger-id twin out if both are in same set
  const pairIds = new Set<number>(duplicates.flat());
  const unswappedTwins = new Set<number>(); // Twins that couldn't find swaps

  for (const [smaller, larger] of duplicates) {
    let setIdx = -1;
    let largerIdx = -1;

    // Find which set contains both
    for (let i = 0; i < sets.length; i++) {
      const hasSmaller = sets[i].includes(smaller);
      const hasLarger = sets[i].includes(larger);
      if (hasSmaller && hasLarger) {
        setIdx = i;
        largerIdx = sets[i].indexOf(larger);
        break;
      }
    }

    if (setIdx >= 0) {
      // Both twins in same set, swap larger for reserve or cross-set question
      const largerMeta = metas.find((m) => m.id === larger)!;
      const domain = largerMeta.domain;
      const difficulty = largerMeta.difficulty;

      // Find best candidate in reserve: same domain, prefer same difficulty, not a pair member
      const reserve = reserveByDomain.get(domain) || [];
      let bestIdx = -1;

      // First try: same domain, same difficulty, not in pairIds
      for (let i = 0; i < reserve.length; i++) {
        if (reserve[i].difficulty === difficulty && !pairIds.has(reserve[i].id)) {
          bestIdx = i;
          break;
        }
      }

      // Second try: same domain, any difficulty, not in pairIds
      if (bestIdx < 0) {
        for (let i = 0; i < reserve.length; i++) {
          if (!pairIds.has(reserve[i].id)) {
            bestIdx = i;
            break;
          }
        }
      }

      if (bestIdx >= 0) {
        const replacement = reserve[bestIdx];
        sets[setIdx][largerIdx] = replacement.id;
        reserve.splice(bestIdx, 1);
        reserve.push(largerMeta);
      } else {
        // Try cross-set swap: find question in another set
        let crossSetSwapped = false;

        // Iterate other sets by ascending set ID
        for (let otherSetIdx = 0; otherSetIdx < sets.length && !crossSetSwapped; otherSetIdx++) {
          if (otherSetIdx === setIdx) continue;

          const otherSet = sets[otherSetIdx];
          // Destination set must not contain the other twin (smaller)
          if (otherSet.includes(smaller)) continue;

          // Find candidates in other set: same domain, prefer same difficulty, not in pairIds
          const candidates: QuestionMeta[] = [];

          // First collect same-difficulty candidates
          for (const qId of otherSet) {
            const qMeta = metas.find((m) => m.id === qId);
            if (qMeta && qMeta.domain === domain && qMeta.difficulty === difficulty && !pairIds.has(qId)) {
              candidates.push(qMeta);
            }
          }

          // If no same-difficulty candidates, collect any-difficulty candidates
          if (candidates.length === 0) {
            for (const qId of otherSet) {
              const qMeta = metas.find((m) => m.id === qId);
              if (qMeta && qMeta.domain === domain && !pairIds.has(qId)) {
                candidates.push(qMeta);
              }
            }
          }

          if (candidates.length > 0) {
            // Pick lowest ID candidate (deterministic)
            candidates.sort((a, b) => a.id - b.id);
            const swapCandidate = candidates[0];

            // Perform cross-set swap: exchange larger twin with candidate
            // Both remain in sets, just different sets
            sets[setIdx][largerIdx] = swapCandidate.id;
            const swapIdx = otherSet.indexOf(swapCandidate.id);
            otherSet[swapIdx] = larger;

            crossSetSwapped = true;
          }
        }

        if (!crossSetSwapped) {
          warnings.push(`Không tìm được câu dự phòng để thay thế câu ${larger} (trùng với ${smaller})`);
          unswappedTwins.add(larger);
        }
      }
    }
  }

  // Then handle domain shortages - avoid taking from unswapped twins
  const setSize = DOMAINS.reduce((s, d) => s + opts.quota[d], 0);
  const difficultyOf = new Map(metas.map((m) => [m.id, m.difficulty]));
  sets.forEach((ids, i) => {
    // Câu bù phải hợp với mức khó của đề: chọn câu có độ khó gần với trung bình của đề nhất.
    const target = ids.reduce((a, id) => a + difficultyOf.get(id)!, 0) / Math.max(ids.length, 1);
    while (ids.length < setSize) {
      // Ưu tiên độ khó gần nhất; hòa thì lấy domain còn nhiều câu dự phòng nhất (giữ kho cân đối).
      let donor: [Domain, QuestionMeta[]] | null = null;
      let mIdx = -1;
      let best: [number, number] | null = null;
      for (const [d, reserve] of reserveByDomain.entries()) {
        const available = reserve.filter((m) => !unswappedTwins.has(m.id)).length;
        for (let j = 0; j < reserve.length; j++) {
          if (unswappedTwins.has(reserve[j].id)) continue;
          const score: [number, number] = [Math.abs(reserve[j].difficulty - target), -available];
          if (!best || score[0] < best[0] || (score[0] === best[0] && score[1] < best[1])) {
            best = score;
            donor = [d, reserve];
            mIdx = j;
          }
        }
      }

      if (donor && mIdx >= 0) {
        const m = donor[1][mIdx];
        donor[1].splice(mIdx, 1);
        ids.push(m.id);
        warnings.push(`Đề ${i + 1}: bù câu ${m.id} (domain ${donor[0]}) vì thiếu câu`);
      } else {
        warnings.push(`Đề ${i + 1}: không đủ câu, chỉ có ${ids.length}/${setSize}`);
        break;
      }
    }
  });

  const reserve = [...reserveByDomain.values()]
    .flat()
    .map((m) => m.id)
    .sort((a, b) => a - b);

  const file: SetsFile = {
    version: 1,
    sets: sets.map((ids, i) => ({ id: i + 1, questionIds: [...ids].sort((a, b) => a - b) })),
    reserve,
  };

  if (duplicates.length > 0) {
    file.duplicates = duplicates;
  }

  return {
    file,
    warnings,
  };
}
