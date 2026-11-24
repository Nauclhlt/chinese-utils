import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'src', 'data');

function readJsonDir(subDir) {
  const dir = path.join(dataDir, subDir);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

const grammar = readJsonDir('grammar');
const vocab = readJsonDir('vocab');
const exercises = readJsonDir('exercises');
const compositions = readJsonDir('compositions');

const issues = [];

// 1. Check pinyin diacritic tone consistency vs vocab.tones
const TONE_MAP = {
  'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
  'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
  'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
  'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
  'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
  'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4,
};

for (const v of vocab) {
  const tokens = v.pinyin.trim().split(/\s+/);
  // Note: some multi-syllable words are written joined like "nǐhǎo" or "yīqǐ"
  const toneMarks = [...v.pinyin.toLowerCase()].filter((c) => TONE_MAP[c]).map((c) => TONE_MAP[c]);
  const hanziClean = v.hanzi.replace(/儿$/g, '').replace(/[，。！？\s]/g, '');
  if (v.tones.length !== hanziClean.length && v.tones.length !== [...v.hanzi].length) {
    issues.push(`Vocab ${v.id} (${v.hanzi}): tones length ${v.tones.length} vs hanzi length ${hanziClean.length}`);
  }
  // Every non-5 tone in v.tones should appear in toneMarks
  const nonNeutral = v.tones.filter((t) => t !== 5);
  if (toneMarks.length !== nonNeutral.length) {
    issues.push(`Vocab ${v.id} (${v.hanzi} / ${v.pinyin}): toneMarks=${JSON.stringify(toneMarks)} vs nonNeutral=${JSON.stringify(nonNeutral)}`);
  }
}

// 2. Check word-order exercises aren't already in sorted answer order
let unshuffled = 0;
for (const e of exercises) {
  if (e.type === 'word-order' && Array.isArray(e.tokens)) {
    const ans = Array.isArray(e.answer) ? e.answer.join('') : String(e.answer);
    const norm = (s) => s.replace(/[\s，。？！,.?!]/g, '');
    if (norm(e.tokens.join('')) === norm(ans)) {
      unshuffled++;
    }
  }
}

// 3. Check exercises type distribution
const typeDist = {};
for (const e of exercises) {
  typeDist[e.type] = (typeDist[e.type] || 0) + 1;
}

// 4. Check compositions have acceptableAnswers >= 1 and commonMistakes >= 1
let missingAlt = 0;
for (const c of compositions) {
  if (!Array.isArray(c.acceptableAnswers) || c.acceptableAnswers.length === 0) missingAlt++;
  if (!Array.isArray(c.commonMistakes) || c.commonMistakes.length === 0) {
    issues.push(`Composition ${c.id} missing commonMistakes`);
  }
}

// 5. Check no copyright-copied textbook paragraphs from .cache if cache exists
let cacheHits = 0;
const cachePath = path.join(root, '.cache', 'textbook_research.json');
if (fs.existsSync(cachePath)) {
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  const textbookSnippets = new Set();
  for (const p of cache.pages || []) {
    for (const s of p.list_items_sample || []) {
      if (s.length >= 12) textbookSnippets.add(s);
    }
  }
  for (const g of grammar) {
    for (const ex of g.examples || []) {
      if (textbookSnippets.has(ex.hanzi)) {
        cacheHits++;
        issues.push(`Example ${ex.id} matches textbook snippet: ${ex.hanzi}`);
      }
    }
  }
}

console.log('=== Linguistic & Quality Review ===');
console.log('Exercise type distribution:', typeDist);
console.log('Word-order tokens initially equal to answer (UI deterministically shuffles anyway):', unshuffled);
console.log('Compositions missing acceptableAnswers:', missingAlt);
console.log('Textbook snippet exact overlap:', cacheHits);
console.log('Issues found:', issues.length);
for (const i of issues.slice(0, 30)) console.log('  ISSUE:', i);
