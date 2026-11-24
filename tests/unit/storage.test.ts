import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createDefaultUserState,
  exportVocabToAnkiTsv,
  exportVocabToCsv,
  loadUserState,
  saveUserState,
  validateImportedUserState,
} from '../../src/utils/storage';

describe('storage persistence, validation, and export', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and restores user state cleanly', () => {
    const st = createDefaultUserState();
    st.scope = { mode: 'upTo', upToLesson: 10, selectedLessons: ['L01'] };
    st.completedLessons = ['L01', 'L02'];
    st.favoritesVocab = ['V01-001'];
    saveUserState(st);

    const loaded = loadUserState();
    expect(loaded.corrupted).toBe(false);
    expect(loaded.state.scope.upToLesson).toBe(10);
    expect(loaded.state.completedLessons).toEqual(['L01', 'L02']);
    expect(loaded.state.favoritesVocab).toEqual(['V01-001']);
  });

  it('recovers safely when localStorage contains corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{broken json');
    const loaded = loadUserState();
    expect(loaded.corrupted).toBe(true);
    expect(loaded.state.version).toBe(1);
  });

  it('rejects invalid imported JSON structures', () => {
    expect(validateImportedUserState(null).valid).toBe(false);
    expect(validateImportedUserState({ version: 'bad' }).valid).toBe(false);
    expect(
      validateImportedUserState({
        version: 1,
        scope: { mode: 'upTo', upToLesson: 99, selectedLessons: [] },
      }).valid
    ).toBe(false);
  });

  it('exports CSV and Anki TSV correctly', () => {
    const sample = [
      {
        id: 'V01-001',
        hanzi: '你',
        pinyin: 'nǐ',
        tones: [3],
        meaningJa: 'あなた',
        pos: '代詞',
        usage: '二人称単数',
        example: { hanzi: '你好！', pinyin: 'Nǐ hǎo!', ja: 'こんにちは！' },
        lessonId: 'L01',
        minLesson: 1,
        source: 'textbook-scope' as const,
        grammarIds: ['G01-01'],
      },
    ];
    const csv = exportVocabToCsv(sample);
    expect(csv).toContain('V01-001');
    expect(csv).toContain('你');
    const tsv = exportVocabToAnkiTsv(sample);
    expect(tsv.split('\t')).toHaveLength(3);
  });
});
