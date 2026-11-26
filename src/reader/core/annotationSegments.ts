import type { AnnotationKind, InlineAnnotation } from '../types/work';

export interface TextSegment {
  start: number;
  end: number;
  text: string;
  annotations: InlineAnnotation[];
  kinds: AnnotationKind[];
}

export interface AnnotationVisibilityOptions {
  showVocab: boolean;
  showGrammar: boolean;
  showExpression: boolean;
  showBackground: boolean;
  currentChapterIndex: number;
  maxReachedChapterIndex: number;
  allowSpoilers: boolean;
}

export function isAnnotationVisible(ann: InlineAnnotation, opts: AnnotationVisibilityOptions): boolean {
  if (ann.kind === 'vocab' && !opts.showVocab) return false;
  if (ann.kind === 'grammar' && !opts.showGrammar) return false;
  if (ann.kind === 'expression' && !opts.showExpression) return false;
  if (ann.kind === 'background' && !opts.showBackground) return false;

  if (
    !opts.allowSpoilers &&
    ann.revealFromChapterIndex !== undefined &&
    ann.revealFromChapterIndex > opts.maxReachedChapterIndex
  ) {
    return false;
  }
  return true;
}

/**
 * Splits a sentence into atomic, non-overlapping UTF-16 visual segments.
 * Any overlapping annotations (e.g. a 2-char vocab word inside a 10-char grammar span)
 * are stacked into each covered segment's `annotations` array so React never drops
 * or corrupts overlapping ranges and DOM underline height stays uniform.
 */
export function buildTextSegments(
  text: string,
  annotations: InlineAnnotation[],
  opts: AnnotationVisibilityOptions
): TextSegment[] {
  if (!text) return [];
  const active = annotations.filter(
    (ann) => ann.start >= 0 && ann.end > ann.start && ann.end <= text.length && isAnnotationVisible(ann, opts)
  );
  if (active.length === 0) {
    return [{ start: 0, end: text.length, text, annotations: [], kinds: [] }];
  }

  const boundarySet = new Set<number>([0, text.length]);
  for (const ann of active) {
    boundarySet.add(ann.start);
    boundarySet.add(ann.end);
  }
  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

  const kindOrder: AnnotationKind[] = ['vocab', 'expression', 'grammar', 'background'];
  const segments: TextSegment[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (end <= start) continue;

    const covering = active
      .filter((ann) => ann.start <= start && ann.end >= end)
      // Shorter (more specific) spans first, then vocab -> expression -> grammar -> background
      .sort((a, b) => {
        const lenDiff = a.end - a.start - (b.end - b.start);
        if (lenDiff !== 0) return lenDiff;
        return kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
      });

    const kinds = Array.from(new Set(covering.map((a) => a.kind)));
    segments.push({
      start,
      end,
      text: text.slice(start, end),
      annotations: covering,
      kinds,
    });
  }

  return segments;
}
