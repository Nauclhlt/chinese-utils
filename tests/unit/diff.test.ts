import { describe, expect, it } from 'vitest';
import { computeCharDiff, matchesAcceptableChinese, normalizeChineseAnswer } from '../../src/utils/diff';

describe('composition diff and acceptable answer matching', () => {
  it('ignores whitespace and Chinese/ASCII punctuation in equivalence check', () => {
    expect(normalizeChineseAnswer('我昨天买了一本书。')).toBe('我昨天买了一本书');
    expect(matchesAcceptableChinese('我昨天买了一本书', '我昨天买了一本书。')).toBe(true);
    expect(
      matchesAcceptableChinese('昨天我买了一本书', '我昨天买了一本书。', ['昨天我买了一本书。'])
    ).toBe(true);
    expect(matchesAcceptableChinese('我去买了书', '我昨天买了一本书。')).toBe(false);
  });

  it('computes character-level diff accurately', () => {
    const segs = computeCharDiff('我去书店', '我昨天去书店');
    expect(segs.some((s) => s.type === 'equal' && s.text === '我')).toBe(true);
    expect(segs.some((s) => s.type === 'add' && s.text === '昨天')).toBe(true);
    expect(segs.some((s) => s.type === 'equal' && s.text === '去书店')).toBe(true);
  });
});
