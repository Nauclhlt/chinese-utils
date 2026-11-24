import { describe, expect, it } from 'vitest';
import {
  applyToneMark,
  canonicalPinyinKey,
  describeToneSandhi,
  extractTones,
  isPinyinEquivalent,
  parseSyllable,
  splitPinyinSyllables,
  toMarkedPinyin,
  toNumberedPinyin,
} from '../../src/utils/pinyin';

describe('pinyin normalization and equivalence', () => {
  it('treats tone-marked and numbered pinyin identically', () => {
    expect(isPinyinEquivalent('nǐ hǎo', 'ni3 hao3')).toBe(true);
    expect(isPinyinEquivalent('ni3 hao3', 'nǐ hǎo')).toBe(true);
    expect(isPinyinEquivalent('ni3hao3', 'nǐ hǎo')).toBe(true);
    expect(isPinyinEquivalent('Wǒ xǐhuan Hànyǔ', 'wo3 xi3 huan5 han4 yu3')).toBe(true);
  });

  it('handles ü, v, u: variants and NFC normalization', () => {
    expect(isPinyinEquivalent('lǜ', 'lv4')).toBe(true);
    expect(isPinyinEquivalent('lǜ', 'lu:4')).toBe(true);
    expect(isPinyinEquivalent('lǚxíng', 'lv3 xing2')).toBe(true);
    expect(isPinyinEquivalent('nü3'.normalize('NFD'), 'nv3')).toBe(true);
    expect(isPinyinEquivalent('qù', 'qu4')).toBe(true);
  });

  it('handles neutral tone as 5, 0, or unmarked', () => {
    expect(isPinyinEquivalent('māma', 'ma1 ma5')).toBe(true);
    expect(isPinyinEquivalent('māma', 'ma1 ma0')).toBe(true);
    expect(isPinyinEquivalent('māma', 'ma1 ma')).toBe(true);
    expect(parseSyllable('ma').tone).toBe(5);
    expect(parseSyllable('ma5').tone).toBe(5);
    expect(parseSyllable('ma0').tone).toBe(5);
  });

  it('rejects different tones or wrong syllables', () => {
    expect(isPinyinEquivalent('mǎi', 'mai4')).toBe(false);
    expect(isPinyinEquivalent('shí', 'si4')).toBe(false);
    expect(isPinyinEquivalent('', 'ni3')).toBe(false);
  });

  it('places tone marks on the correct vowel according to standard rules', () => {
    expect(applyToneMark('hao', 3)).toBe('hǎo');
    expect(applyToneMark('xue', 2)).toBe('xué');
    expect(applyToneMark('gui', 4)).toBe('guì');
    expect(applyToneMark('liu', 2)).toBe('liú');
    expect(applyToneMark('dou', 1)).toBe('dōu');
    expect(applyToneMark('lv', 4)).toBe('lǜ');
  });

  it('converts between marked and numbered forms and extracts tones', () => {
    expect(toMarkedPinyin('ni3 hao3')).toBe('nǐ hǎo');
    expect(toNumberedPinyin('nǐ hǎo')).toBe('ni3 hao3');
    expect(extractTones('nǐ hǎo')).toEqual([3, 3]);
    expect(extractTones('māma')).toEqual([1, 5]);
    expect(canonicalPinyinKey('  Nǐ   hǎo!  ')).toBe('ni3hao3');
    expect(splitPinyinSyllables('ni3hao3')).toEqual(['ni3', 'hao3']);
  });

  it('explains tone sandhi without confusing original lexical tone', () => {
    const sandhi3 = describeToneSandhi('你好', 'nǐ hǎo');
    expect(sandhi3).toContain('第3声の連続');
    const sandhiBu = describeToneSandhi('不是', 'bù shì');
    expect(sandhiBu).toContain('bú');
    const noSandhiBu = describeToneSandhi('不好', 'bù hǎo');
    expect(noSandhiBu).toBeNull();
    const sandhiYi = describeToneSandhi('一起', 'yī qǐ');
    expect(sandhiYi).toContain('yì');
  });
});
