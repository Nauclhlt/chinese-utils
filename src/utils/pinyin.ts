/**
 * Pinyin normalization, tone extraction, tone-sandhi rules, and comparison utilities.
 */

export interface PinyinSyllable {
  raw: string;
  base: string; // e.g. "ni", "lv"
  tone: 1 | 2 | 3 | 4 | 5; // 5 = neutral tone
  marked: string; // e.g. "nǐ", "lǜ"
  numbered: string; // e.g. "ni3", "lv4"
}

const TONE_MAP: Record<string, [string, 1 | 2 | 3 | 4]> = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
};

const REVERSE_TONE: Record<string, [string, string, string, string, string]> = {
  'a': ['ā', 'á', 'ǎ', 'à', 'a'],
  'e': ['ē', 'é', 'ě', 'è', 'e'],
  'i': ['ī', 'í', 'ǐ', 'ì', 'i'],
  'o': ['ō', 'ó', 'ǒ', 'ò', 'o'],
  'u': ['ū', 'ú', 'ǔ', 'ù', 'u'],
  'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

const PINYIN_CHAR_RE = /[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+[0-5]?/g;

// Ordered longest-first for greedy syllable matching on plain (tone-stripped) letters
const VALID_INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
];

const VALID_FINALS = [
  'iang', 'iong', 'uang', 'ueng',
  'ang', 'eng', 'ing', 'ong',
  'ian', 'iao', 'uan', 'uai', 'üan',
  'ai', 'ei', 'ao', 'ou', 'ia', 'ie', 'iu', 'ua', 'uo', 'ui', 'üe', 'ue',
  'an', 'en', 'in', 'un', 'ün', 'er',
  'a', 'o', 'e', 'i', 'u', 'ü',
];

/**
 * Normalize ü / v / u: variants and Unicode NFC, strip punctuation/apostrophes, lowercase.
 */
export function normalizePinyinRaw(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/[’']/g, ' ')
    .replace(/u:/g, 'ü')
    .replace(/v/g, 'ü')
    .replace(/[,，。.?？!！;；:：""“”（）()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Apply tone mark to a plain syllable (with ü normalized).
 */
export function applyToneMark(baseInput: string, tone: 1 | 2 | 3 | 4 | 5): string {
  const base = baseInput.replace(/v/g, 'ü').replace(/u:/g, 'ü');
  if (tone === 5) return base;

  const idx = tone - 1;
  if (base.includes('a')) {
    return base.replace('a', REVERSE_TONE['a'][idx]);
  }
  if (base.includes('e')) {
    return base.replace('e', REVERSE_TONE['e'][idx]);
  }
  if (base.includes('ou')) {
    return base.replace('o', REVERSE_TONE['o'][idx]);
  }
  for (let i = base.length - 1; i >= 0; i--) {
    const ch = base[i];
    if (REVERSE_TONE[ch]) {
      return base.slice(0, i) + REVERSE_TONE[ch][idx] + base.slice(i + 1);
    }
  }
  return base;
}

/**
 * Parse a single syllable (either tone-marked like "nǐ", "lǜ", or numbered like "ni3", "lv4", "ma5", "ma0", "ma").
 */
export function parseSyllable(rawToken: string): PinyinSyllable {
  const token = normalizePinyinRaw(rawToken);
  if (!token) {
    return { raw: rawToken, base: '', tone: 5, marked: '', numbered: '' };
  }

  let tone: 1 | 2 | 3 | 4 | 5 = 5;
  let working = token;

  const digitMatch = working.match(/^([a-zü]+)([0-5])$/);
  if (digitMatch) {
    working = digitMatch[1];
    const d = Number(digitMatch[2]);
    tone = d === 0 || d === 5 ? 5 : (d as 1 | 2 | 3 | 4);
  } else {
    let plain = '';
    for (const ch of working) {
      if (TONE_MAP[ch]) {
        plain += TONE_MAP[ch][0];
        tone = TONE_MAP[ch][1];
      } else {
        plain += ch;
      }
    }
    working = plain;
  }

  const orthoBase = working.replace(/^([jqxy])ü/, '$1u');
  const marked = applyToneMark(orthoBase, tone);
  const numbered = tone === 5 ? `${orthoBase}5` : `${orthoBase}${tone}`;

  return {
    raw: rawToken,
    base: orthoBase,
    tone,
    marked,
    numbered,
  };
}

function stripToneChar(ch: string): string {
  return TONE_MAP[ch] ? TONE_MAP[ch][0] : ch;
}

function isSingleSyllable(plain: string): boolean {
  if (!plain) return false;
  if (plain === 'r' || plain === 'er') return true;
  let rest = plain;
  const init = VALID_INITIALS.find((i) => rest.startsWith(i));
  if (init) {
    rest = rest.slice(init.length);
  }
  return VALID_FINALS.includes(rest);
}

/**
 * Segment an unspaced pinyin word (e.g. "māma", "lǚxíng", "xǐhuan") into syllables.
 */
function segmentPinyinWord(word: string): string[] {
  const chars = [...word];
  const plainChars = chars.map(stripToneChar);
  const plainWord = plainChars.join('');

  // Fast path: already a single valid syllable
  if (isSingleSyllable(plainWord)) {
    return [word];
  }

  const memo = new Map<number, string[] | null>();

  function dfs(pos: number): string[] | null {
    if (pos === chars.length) return [];
    if (memo.has(pos)) return memo.get(pos)!;

    // Try matching initial + final greedily (longest valid syllable that leaves a valid remainder)
    const restPlain = plainChars.slice(pos).join('');
    const possibleInits = [''];
    for (const init of VALID_INITIALS) {
      if (restPlain.startsWith(init)) {
        possibleInits.unshift(init);
      }
    }

    for (const init of possibleInits) {
      const afterInit = restPlain.slice(init.length);
      for (const fin of VALID_FINALS) {
        if (afterInit.startsWith(fin)) {
          const len = init.length + fin.length;
          const chunk = chars.slice(pos, pos + len).join('');
          // Ensure a single syllable doesn't contain 2 tone marks
          const toneMarks = [...chunk].filter((c) => Boolean(TONE_MAP[c])).length;
          if (toneMarks > 1) continue;
          const sub = dfs(pos + len);
          if (sub !== null) {
            const res = [chunk, ...sub];
            memo.set(pos, res);
            return res;
          }
        }
      }
    }

    memo.set(pos, null);
    return null;
  }

  const res = dfs(0);
  return res ?? [word];
}

/**
 * Split a continuous or spaced pinyin string into syllables.
 * Supports spaced ("ni3 hao3", "nǐ hǎo"), numbered concatenated ("ni3hao3"), and unspaced marked ("lǚxíng", "māma").
 */
export function splitPinyinSyllables(input: string): string[] {
  const norm = normalizePinyinRaw(input);
  if (!norm) return [];

  const spaceTokens = norm.split(' ').filter(Boolean);
  const result: string[] = [];

  for (const tok of spaceTokens) {
    const parts = tok.match(PINYIN_CHAR_RE);
    if (!parts) continue;
    for (const part of parts) {
      if (/[0-5]$/.test(part)) {
        result.push(part);
      } else {
        result.push(...segmentPinyinWord(part));
      }
    }
  }

  return result;
}

/**
 * Convert any pinyin string to canonical marked form ("nǐ hǎo") and numbered form ("ni3 hao3").
 */
export function toMarkedPinyin(input: string): string {
  const parts = splitPinyinSyllables(input).map(parseSyllable);
  return parts.map((p) => p.marked).join(' ');
}

export function toNumberedPinyin(input: string): string {
  const parts = splitPinyinSyllables(input).map(parseSyllable);
  return parts.map((p) => p.numbered).join(' ');
}

/**
 * Canonical key for equivalence comparison:
 * - "nǐ hǎo" === "ni3 hao3" === "ni3hao3"
 * - "lǜ" === "lv4" === "lu:4"
 * - "ma" === "ma5" === "ma0" (neutral tone)
 */
export function canonicalPinyinKey(input: string, ignoreSpacing = true): string {
  const parts = splitPinyinSyllables(input).map(parseSyllable);
  const sep = ignoreSpacing ? '' : ' ';
  return parts
    .map((p) => `${p.base}${p.tone}`)
    .join(sep);
}

/**
 * Compare user pinyin input against expected pinyin.
 * Handles diacritics vs numbers, ü/v/u:, NFC, spaces, neutral tone (5/0/unmarked).
 */
export function isPinyinEquivalent(userInput: string, expected: string): boolean {
  if (!userInput.trim() || !expected.trim()) return false;
  const userKey = canonicalPinyinKey(userInput, true);
  const expKey = canonicalPinyinKey(expected, true);
  if (userKey === expKey) return true;

  const userSpaced = canonicalPinyinKey(userInput, false);
  const expSpaced = canonicalPinyinKey(expected, false);
  return userSpaced === expSpaced;
}

/**
 * Extract tones array from a pinyin string (e.g. "nǐ hǎo" -> [3, 3]).
 */
export function extractTones(input: string): (1 | 2 | 3 | 4 | 5)[] {
  return splitPinyinSyllables(input).map((s) => parseSyllable(s).tone);
}

/**
 * Compute spoken tones considering 3rd tone sandhi and 一/不 sandhi for educational explanation,
 * while never overwriting lexical (original) tones.
 */
export function describeToneSandhi(hanzi: string, lexicalPinyin: string): string | null {
  const syllables = splitPinyinSyllables(lexicalPinyin).map(parseSyllable);
  const notes: string[] = [];

  for (let i = 0; i < syllables.length - 1; i++) {
    if (syllables[i].tone === 3 && syllables[i + 1].tone === 3) {
      notes.push(`第3声の連続（${syllables[i].marked} + ${syllables[i + 1].marked}）：前の第3声は発音上、第2声のように発音されます（声調変調）。`);
      break;
    }
  }

  if (hanzi.includes('不') && syllables.some((s) => s.base === 'bu')) {
    const idx = syllables.findIndex((s) => s.base === 'bu');
    if (idx >= 0 && idx + 1 < syllables.length && syllables[idx + 1].tone === 4) {
      notes.push('「不」の変調：後ろに第4声が続くため、発音上「bú」と第2声になります（本来の声調は第4声 bù）。');
    }
  }

  if (hanzi.includes('一') && syllables.some((s) => s.base === 'yi')) {
    const idx = syllables.findIndex((s) => s.base === 'yi');
    if (idx >= 0 && idx + 1 < syllables.length) {
      const nextTone = syllables[idx + 1].tone;
      if (nextTone === 4) {
        notes.push('「一」の変調：後ろが第4声のため、発音上は第2声（yí）になります（本来の声調は第1声 yī）。');
      } else if (nextTone === 1 || nextTone === 2 || nextTone === 3) {
        notes.push('「一」の変調：後ろが第1・2・3声のため、発音上は第4声（yì）になります（本来の声調は第1声 yī）。');
      }
    }
  }

  return notes.length > 0 ? notes.join(' ') : null;
}

export function toneLabel(tone: number): string {
  switch (tone) {
    case 1: return '第1声 (ˉ)';
    case 2: return '第2声 (ˊ)';
    case 3: return '第3声 (ˇ)';
    case 4: return '第4声 (ˋ)';
    default: return '軽声';
  }
}
