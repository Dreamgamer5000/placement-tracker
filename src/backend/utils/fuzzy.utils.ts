// Jaro-Winkler fuzzy string matching algorithms for student name search

/** Jaro similarity between two lowercased strings */
export function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const l1 = s1.length, l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0;
  const md = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const m1 = new Uint8Array(l1), m2 = new Uint8Array(l2);
  let hits = 0, trans = 0;
  for (let i = 0; i < l1; i++) {
    const lo = Math.max(0, i - md), hi = Math.min(i + md + 1, l2);
    for (let j = lo; j < hi; j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = m2[j] = 1; hits++; break;
    }
  }
  if (!hits) return 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) trans++;
    k++;
  }
  return (hits / l1 + hits / l2 + (hits - trans / 2) / hits) / 3;
}

/** Jaro-Winkler — boosts common-prefix matches */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j < 0.7) return j;
  let p = 0;
  for (let i = 0; i < Math.min(a.length, b.length, 4); i++) {
    if (a[i] === b[i]) p++; else break;
  }
  return j + p * 0.1 * (1 - j);
}

/** Best score between query and any word-span / individual word in candidate */
export function fuzzyScore(query: string, candidate: string): number {
  const qw = query.split(/\s+/), cw = candidate.split(/\s+/);
  let best = jaroWinkler(query, candidate);
  for (let s = 0; s <= cw.length - qw.length; s++) {
    const span = cw.slice(s, s + qw.length).join(' ');
    const sc = jaroWinkler(query, span);
    if (sc > best) best = sc;
  }
  for (const word of cw) {
    const sc = jaroWinkler(query, word);
    if (sc > best) best = sc;
  }
  return best;
}

export const FUZZY_THRESHOLD = 0.75;
