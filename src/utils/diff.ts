/**
 * Chinese text normalization and LCS character/segment diff utilities for composition comparison.
 */

export interface DiffSegment {
  type: 'equal' | 'add' | 'remove';
  text: string;
}

/**
 * Normalize Chinese sentence for equivalence checking:
 * removes whitespace and standard punctuation, converts full-width ASCII.
 */
export function normalizeChineseAnswer(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，,。．.！!？?、；;：:""“”''‘’（）()「」『』]/g, '');
}

/**
 * Check if user composition matches model answer or any acceptable answer.
 * Never marks unmatched creative sentences as objectively "wrong" — returns boolean match only.
 */
export function matchesAcceptableChinese(
  userInput: string,
  modelAnswer: string,
  acceptableAnswers: string[] = []
): boolean {
  const normUser = normalizeChineseAnswer(userInput);
  if (!normUser) return false;
  const candidates = [modelAnswer, ...acceptableAnswers].map(normalizeChineseAnswer);
  return candidates.includes(normUser);
}

/**
 * Character-level LCS diff between userInput and modelAnswer.
 */
export function computeCharDiff(userInput: string, modelAnswer: string): DiffSegment[] {
  const a = [...userInput.trim()];
  const b = [...modelAnswer.trim()];
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ type: 'equal', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'remove', text: a[i] });
      i++;
    } else {
      raw.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) {
    raw.push({ type: 'remove', text: a[i++] });
  }
  while (j < n) {
    raw.push({ type: 'add', text: b[j++] });
  }

  // Merge consecutive segments of same type
  const merged: DiffSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}
