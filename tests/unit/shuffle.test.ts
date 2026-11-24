import { describe, expect, it } from 'vitest';
import { createShuffleSeed, shuffleWithSeed } from '../../src/utils/shuffle';

describe('shuffleWithSeed', () => {
  it('preserves all elements without mutating original array', () => {
    const orig = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const snapshot = [...orig];
    const shuffled = shuffleWithSeed(orig, 12345);

    expect(orig).toEqual(snapshot);
    expect(shuffled).toHaveLength(orig.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(orig);
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const run1 = shuffleWithSeed(items, 42);
    const run2 = shuffleWithSeed(items, 42);
    const run3 = shuffleWithSeed(items, 99);

    expect(run1).toEqual(run2);
    expect(run1).not.toEqual(run3);
  });

  it('generates positive integer seeds', () => {
    const seed = createShuffleSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThan(0);
  });
});
