import type { LiteratureWork } from '../types/work';

export interface WorkValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    chapters: number;
    paragraphs: number;
    sentences: number;
    annotations: number;
    glossary: number;
    backgroundNotes: number;
    actualCharCount: number;
  };
}

const UNSAFE_URL_RE = /^(javascript:|data:text\/html|vbscript:)/i;
const SAFE_RELATIVE_OR_HTTP_RE = /^(https?:\/\/|\.\/|assets\/|\/assets\/|data:image\/(?:png|jpeg|jpg|webp|svg\+xml);base64,|data:audio\/)/i;
const DANGEROUS_TEXT_RE = /<\s*script\b|onerror\s*=|onload\s*=|<iframe\b/i;

export function countChineseChars(text: string): number {
  const matches = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g);
  return matches ? matches.length : 0;
}

export function isSafeAssetPath(raw?: string): boolean {
  if (!raw || typeof raw !== 'string') return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.includes('..') || trimmed.includes('\\')) return false;
  if (UNSAFE_URL_RE.test(trimmed)) return false;
  return SAFE_RELATIVE_OR_HTTP_RE.test(trimmed);
}

export function validateWork(input: unknown, rawByteSize?: number): WorkValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawByteSize !== undefined && rawByteSize > 10 * 1024 * 1024) {
    errors.push(`作品ファイルサイズが上限（10MB）を超えています (${Math.round(rawByteSize / 1024)}KB)。`);
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: [...errors, '作品データはJSONオブジェクトである必要があります。'],
      warnings,
      stats: { chapters: 0, paragraphs: 0, sentences: 0, annotations: 0, glossary: 0, backgroundNotes: 0, actualCharCount: 0 },
    };
  }

  const work = input as Partial<LiteratureWork>;
  if (work.schemaVersion !== '1.0.0') {
    errors.push(`schemaVersion は "1.0.0" である必要があります（検出値: ${String(work.schemaVersion)}）。`);
  }

  // Metadata checks
  const meta = work.metadata;
  if (!meta || typeof meta !== 'object') {
    errors.push('metadata オブジェクトが不足しています。');
  } else {
    if (!meta.id || !/^[a-z0-9][a-z0-9-_]{1,64}$/.test(meta.id)) {
      errors.push('metadata.id は英小文字・数字・ハイフン・アンダースコア（2〜65文字）で指定してください。');
    }
    for (const reqField of ['titleZh', 'titlePinyin', 'titleJa', 'author', 'synopsis', 'estimatedDifficulty', 'difficultyBasis'] as const) {
      if (!meta[reqField] || typeof meta[reqField] !== 'string' || !meta[reqField].trim()) {
        errors.push(`metadata.${reqField} が不足しています。`);
      }
    }
    if (meta.script !== 'zh-Hans' && meta.script !== 'zh-Hant') {
      errors.push('metadata.script は "zh-Hans" または "zh-Hant" を指定してください。');
    }
    if (!Array.isArray(meta.genres) || meta.genres.length === 0) {
      errors.push('metadata.genres には1つ以上のジャンルを指定してください。');
    }
    if (!isSafeAssetPath(meta.coverImage)) {
      errors.push(`metadata.coverImage に安全でないパスが含まれています: ${meta.coverImage}`);
    }
    if (!meta.rights || typeof meta.rights.notice !== 'string' || typeof meta.rights.redistributableInRepo !== 'boolean') {
      errors.push('metadata.rights（権利・公開設定）が不正です。');
    }
  }

  // Glossary checks
  const glossaryIds = new Set<string>();
  const glossary = Array.isArray(work.glossary) ? work.glossary : [];
  if (glossary.length === 0) {
    errors.push('glossary（作品単語帳）には1件以上のエントリが必要です。');
  }
  for (const g of glossary) {
    if (!g || !g.id || !g.headword || !g.pinyin || !g.generalMeaningJa) {
      errors.push(`glossary エントリに必須項目不足があります: ${JSON.stringify(g?.id ?? 'unknown')}`);
      continue;
    }
    if (glossaryIds.has(g.id)) {
      errors.push(`glossary ID が重複しています: ${g.id}`);
    }
    glossaryIds.add(g.id);
  }

  // Characters checks
  const characterIds = new Set<string>();
  const characters = Array.isArray(work.characters) ? work.characters : [];
  for (const ch of characters) {
    if (!ch?.id || !ch?.nameZh) {
      errors.push(`characters エントリが不正です: ${ch?.id ?? 'unknown'}`);
      continue;
    }
    if (characterIds.has(ch.id)) {
      errors.push(`characters ID が重複しています: ${ch.id}`);
    }
    characterIds.add(ch.id);
  }

  // Background notes checks
  const bgIds = new Set<string>();
  const backgroundNotes = Array.isArray(work.backgroundNotes) ? work.backgroundNotes : [];
  for (const bg of backgroundNotes) {
    if (!bg?.id || !bg?.title || !bg?.summary || !bg?.detail) {
      errors.push(`backgroundNotes エントリに必須項目不足があります: ${bg?.id ?? 'unknown'}`);
      continue;
    }
    if (bgIds.has(bg.id)) {
      errors.push(`backgroundNotes ID が重複しています: ${bg.id}`);
    }
    bgIds.add(bg.id);
    if (!Array.isArray(bg.sources) || (bg.factType !== 'fictional-setting' && bg.sources.length === 0)) {
      warnings.push(`背景知識 "${bg.id}" (${bg.title}) に出典 sources が記録されていません。`);
    }
    for (const s of bg.sources ?? []) {
      if (s?.url && UNSAFE_URL_RE.test(s.url)) {
        errors.push(`背景知識 "${bg.id}" に不正なURLが含まれています: ${s.url}`);
      }
    }
  }

  // Chapters / paragraphs / sentences / annotations checks
  const chapters = Array.isArray(work.chapters) ? work.chapters : [];
  if (chapters.length === 0) {
    errors.push('chapters には1章以上を含めてください。');
  }
  const chapterIds = new Set<string>();
  const paragraphIds = new Set<string>();
  const sentenceIds = new Set<string>();
  const annotationIds = new Set<string>();

  let totalParagraphs = 0;
  let totalSentences = 0;
  let totalAnnotations = 0;
  let actualCharCount = 0;

  chapters.forEach((ch, idx) => {
    if (!ch?.id || !ch?.titleZh || !Array.isArray(ch.paragraphs) || ch.paragraphs.length === 0) {
      errors.push(`chapter[${idx}] に必須項目不足があります。`);
      return;
    }
    if (chapterIds.has(ch.id)) errors.push(`章IDが重複しています: ${ch.id}`);
    chapterIds.add(ch.id);
    if (ch.index !== idx) {
      errors.push(`章 "${ch.id}" の index (${ch.index}) が配列位置 (${idx}) と一致しません。`);
    }

    for (const p of ch.paragraphs) {
      if (!p?.id || !Array.isArray(p.sentences) || p.sentences.length === 0) {
        errors.push(`段落 ID または sentences が不正です (章: ${ch.id}, 段落: ${p?.id ?? 'unknown'})。`);
        continue;
      }
      if (paragraphIds.has(p.id)) errors.push(`段落IDが重複しています: ${p.id}`);
      paragraphIds.add(p.id);
      totalParagraphs++;

      for (const s of p.sentences) {
        if (!s?.id || typeof s.text !== 'string' || typeof s.pinyin !== 'string' || typeof s.translationJa !== 'string') {
          errors.push(`文の必須フィールドが不足しています (段落: ${p.id}, 文: ${s?.id ?? 'unknown'})。`);
          continue;
        }
        if (sentenceIds.has(s.id)) errors.push(`文IDが重複しています: ${s.id}`);
        sentenceIds.add(s.id);
        totalSentences++;
        actualCharCount += countChineseChars(s.text);

        if (DANGEROUS_TEXT_RE.test(s.text) || DANGEROUS_TEXT_RE.test(s.translationJa)) {
          errors.push(`文 "${s.id}" に危険なHTML/スクリプト文字列が含まれています。`);
        }
        if (!isSafeAssetPath(s.audioUrl)) {
          errors.push(`文 "${s.id}" の audioUrl に安全でないパスが含まれています: ${s.audioUrl}`);
        }

        const annotations = Array.isArray(s.annotations) ? s.annotations : [];
        for (const ann of annotations) {
          if (!ann?.id || !ann.kind || typeof ann.start !== 'number' || typeof ann.end !== 'number' || typeof ann.surface !== 'string') {
            errors.push(`注釈の基本項目が不正です (文: ${s.id}, 注釈: ${ann?.id ?? 'unknown'})。`);
            continue;
          }
          if (annotationIds.has(ann.id)) errors.push(`注釈IDが重複しています: ${ann.id}`);
          annotationIds.add(ann.id);
          totalAnnotations++;

          if (!Number.isInteger(ann.start) || !Number.isInteger(ann.end) || ann.start < 0 || ann.end <= ann.start || ann.end > s.text.length) {
            errors.push(`注釈範囲 [${ann.start}, ${ann.end}) が原文長 ${s.text.length} の範囲外です (文: ${s.id}, 注釈: ${ann.id})。`);
            continue;
          }
          const extracted = s.text.slice(ann.start, ann.end);
          if (extracted !== ann.surface) {
            errors.push(
              `注釈範囲の文字列不一致 (文: ${s.id}, 注釈: ${ann.id}): [${ann.start}, ${ann.end}) は "${extracted}" ですが surface="${ann.surface}" です。`
            );
          }

          if (ann.kind === 'vocab') {
            if (!ann.vocab?.glossaryId || !glossaryIds.has(ann.vocab.glossaryId)) {
              errors.push(`語彙注釈 "${ann.id}" の glossaryId "${ann.vocab?.glossaryId}" が glossary に存在しません。`);
            }
          } else if (ann.kind === 'grammar') {
            if (!ann.grammar?.title || !ann.grammar?.pattern || !ann.grammar?.roleExplanation) {
              errors.push(`文法注釈 "${ann.id}" に解説情報が不足しています。`);
            }
          } else if (ann.kind === 'expression') {
            if (!ann.expression?.meaningJa || !ann.expression?.nuanceNote) {
              errors.push(`表現注釈 "${ann.id}" に解説情報が不足しています。`);
            }
          } else if (ann.kind === 'background') {
            if (!ann.background?.backgroundNoteId || !bgIds.has(ann.background.backgroundNoteId)) {
              errors.push(`背景注釈 "${ann.id}" の backgroundNoteId "${ann.background?.backgroundNoteId}" が backgroundNotes に存在しません。`);
            }
          } else {
            errors.push(`未知の注釈種別です: ${String(ann.kind)}`);
          }
        }
      }
    }
  });

  if (meta && typeof meta.chapterCount === 'number' && meta.chapterCount !== chapters.length) {
    errors.push(`metadata.chapterCount (${meta.chapterCount}) が chapters.length (${chapters.length}) と一致しません。`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      chapters: chapters.length,
      paragraphs: totalParagraphs,
      sentences: totalSentences,
      annotations: totalAnnotations,
      glossary: glossary.length,
      backgroundNotes: backgroundNotes.length,
      actualCharCount,
    },
  };
}
