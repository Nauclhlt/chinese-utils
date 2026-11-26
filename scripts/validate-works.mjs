import fs from 'node:fs';
import path from 'node:path';

const WORKS_DIR = path.resolve('src/reader/data/works');
const UNSAFE_URL_RE = /^(javascript:|data:text\/html|vbscript:)/i;
const SAFE_PATH_RE = /^(https?:\/\/|\.\/|assets\/|\/assets\/|data:image\/(?:png|jpeg|jpg|webp|svg\+xml);base64,|data:audio\/)/i;
const DANGEROUS_TEXT_RE = /<\s*script\b|onerror\s*=|onload\s*=|<iframe\b/i;

function countChineseChars(text) {
  const m = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g);
  return m ? m.length : 0;
}

function isSafePath(raw) {
  if (!raw || typeof raw !== 'string') return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.includes('..') || trimmed.includes('\\')) return false;
  if (UNSAFE_URL_RE.test(trimmed)) return false;
  return SAFE_PATH_RE.test(trimmed);
}

// Load curriculum IDs to verify cross-references when specified
const curriculumGrammarIds = new Set();
for (const file of fs.readdirSync(path.resolve('src/data/grammar'))) {
  if (!file.endsWith('.json')) continue;
  const list = JSON.parse(fs.readFileSync(path.join(path.resolve('src/data/grammar'), file), 'utf8'));
  for (const item of list) curriculumGrammarIds.add(item.id);
}

const curriculumVocabIds = new Set();
for (const file of fs.readdirSync(path.resolve('src/data/vocab'))) {
  if (!file.endsWith('.json')) continue;
  const list = JSON.parse(fs.readFileSync(path.join(path.resolve('src/data/vocab'), file), 'utf8'));
  for (const item of list) curriculumVocabIds.add(item.id);
}

const workFiles = fs.existsSync(WORKS_DIR)
  ? fs.readdirSync(WORKS_DIR).filter((f) => f.endsWith('.json')).sort()
  : [];

let totalWorks = 0;
let totalChapters = 0;
let totalSentences = 0;
let totalAnnotations = 0;
let totalChineseChars = 0;
let warningCount = 0;
let errorCount = 0;

function err(msg) {
  console.error(`ERROR [works]: ${msg}`);
  errorCount++;
}

function warn(msg) {
  console.warn(`WARN  [works]: ${msg}`);
  warningCount++;
}

const seenWorkIds = new Set();

for (const file of workFiles) {
  const fullPath = path.join(WORKS_DIR, file);
  let work;
  try {
    work = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    err(`${file}: JSON parse error - ${e.message}`);
    continue;
  }

  totalWorks++;
  if (work.schemaVersion !== '1.0.0') {
    err(`${file}: schemaVersion must be "1.0.0"`);
  }
  const meta = work.metadata;
  if (!meta?.id || !meta.titleZh || !meta.titlePinyin || !meta.titleJa || !meta.author) {
    err(`${file}: missing required metadata fields`);
  }
  if (seenWorkIds.has(meta?.id)) {
    err(`${file}: duplicate metadata.id "${meta.id}"`);
  }
  seenWorkIds.add(meta?.id);

  if (meta?.rights && !meta.rights.redistributableInRepo) {
    err(`${file}: bundled work must have rights.redistributableInRepo = true`);
  }
  if (!isSafePath(meta?.coverImage)) {
    err(`${file}: unsafe coverImage path "${meta?.coverImage}"`);
  }
  if (meta?.coverImage && meta.coverImage.startsWith('./assets/')) {
    const assetDiskPath = path.resolve('public', meta.coverImage.slice(2));
    if (!fs.existsSync(assetDiskPath)) {
      err(`${file}: referenced coverImage missing on disk: ${assetDiskPath}`);
    }
  }

  const glossaryIds = new Set();
  for (const g of work.glossary ?? []) {
    if (!g.id || !g.headword || !g.pinyin || !g.generalMeaningJa) {
      err(`${file}: invalid glossary entry ${g?.id}`);
    }
    if (glossaryIds.has(g.id)) err(`${file}: duplicate glossary id ${g.id}`);
    glossaryIds.add(g.id);
    if (g.relatedVocabId && !curriculumVocabIds.has(g.relatedVocabId)) {
      err(`${file}: glossary ${g.id} references unknown relatedVocabId "${g.relatedVocabId}"`);
    }
  }

  const bgIds = new Set();
  for (const bg of work.backgroundNotes ?? []) {
    if (!bg.id || !bg.title || !bg.summary || !bg.detail) {
      err(`${file}: invalid backgroundNote ${bg?.id}`);
    }
    if (bgIds.has(bg.id)) err(`${file}: duplicate backgroundNote id ${bg.id}`);
    bgIds.add(bg.id);
    if (bg.factType !== 'fictional-setting' && (!Array.isArray(bg.sources) || bg.sources.length === 0)) {
      warn(`${file}: backgroundNote ${bg.id} has no sources`);
    }
  }

  const sentenceIds = new Set();
  const annIds = new Set();
  let workChars = 0;

  const chapters = work.chapters ?? [];
  if (meta?.chapterCount !== chapters.length) {
    err(`${file}: metadata.chapterCount=${meta?.chapterCount} does not match chapters.length=${chapters.length}`);
  }

  chapters.forEach((ch, idx) => {
    totalChapters++;
    if (ch.index !== idx) err(`${file}: chapter ${ch.id} index=${ch.index} expected ${idx}`);
    for (const p of ch.paragraphs ?? []) {
      for (const s of p.sentences ?? []) {
        totalSentences++;
        if (sentenceIds.has(s.id)) err(`${file}: duplicate sentence id ${s.id}`);
        sentenceIds.add(s.id);
        workChars += countChineseChars(s.text);
        if (DANGEROUS_TEXT_RE.test(s.text) || DANGEROUS_TEXT_RE.test(s.translationJa)) {
          err(`${file}: unsafe HTML/script in ${s.id}`);
        }
        if (!isSafePath(s.audioUrl)) {
          err(`${file}: unsafe audioUrl in ${s.id}: ${s.audioUrl}`);
        }
        for (const ann of s.annotations ?? []) {
          totalAnnotations++;
          if (annIds.has(ann.id)) err(`${file}: duplicate annotation id ${ann.id}`);
          annIds.add(ann.id);
          if (
            !Number.isInteger(ann.start) ||
            !Number.isInteger(ann.end) ||
            ann.start < 0 ||
            ann.end <= ann.start ||
            ann.end > s.text.length
          ) {
            err(`${file}: annotation ${ann.id} in ${s.id} has out-of-range [${ann.start}, ${ann.end}) for len ${s.text.length}`);
            continue;
          }
          const slice = s.text.slice(ann.start, ann.end);
          if (slice !== ann.surface) {
            err(`${file}: annotation ${ann.id} in ${s.id} slice="${slice}" !== surface="${ann.surface}"`);
          }
          if (ann.kind === 'vocab') {
            if (!ann.vocab?.glossaryId || !glossaryIds.has(ann.vocab.glossaryId)) {
              err(`${file}: annotation ${ann.id} missing/unknown glossaryId ${ann.vocab?.glossaryId}`);
            }
          } else if (ann.kind === 'background') {
            if (!ann.background?.backgroundNoteId || !bgIds.has(ann.background.backgroundNoteId)) {
              err(`${file}: annotation ${ann.id} missing/unknown backgroundNoteId ${ann.background?.backgroundNoteId}`);
            }
          } else if (ann.kind === 'grammar') {
            if (ann.grammar?.relatedGrammarId && !curriculumGrammarIds.has(ann.grammar.relatedGrammarId)) {
              err(`${file}: annotation ${ann.id} unknown relatedGrammarId "${ann.grammar.relatedGrammarId}"`);
            }
          }
        }
      }
    }
  });

  if (Math.abs((meta?.charCount ?? 0) - workChars) > 50) {
    warn(`${file}: metadata.charCount=${meta?.charCount} differs from counted CJK chars=${workChars}`);
  }
  totalChineseChars += workChars;
}

if (totalWorks === 0) {
  err('No bundled works found in src/reader/data/works/');
}

console.log('=== Literature Works Validation Summary ===');
console.log(`Bundled works: ${totalWorks}`);
console.log(`Total chapters: ${totalChapters}`);
console.log(`Total sentences: ${totalSentences}`);
console.log(`Total CJK characters: ${totalChineseChars}`);
console.log(`Total annotations: ${totalAnnotations}`);
console.log(`Warnings: ${warningCount}`);
console.log(`Errors: ${errorCount}`);

if (errorCount > 0) {
  process.exit(1);
}
