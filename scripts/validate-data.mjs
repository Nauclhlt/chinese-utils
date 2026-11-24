import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'src', 'data');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, relPath), 'utf-8'));
}

function readJsonDir(subDir) {
  const dir = path.join(dataDir, subDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: `${subDir}/${f}`, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) }));
}

const errors = [];
const warnings = [];

const categories = readJson('categories.json');
const lessons = readJson('lessons.json');
const comparisons = readJson('comparisons.json');
const pronunciation = readJson('pronunciation.json');

const grammarFiles = readJsonDir('grammar');
const vocabFiles = readJsonDir('vocab');
const exerciseFiles = readJsonDir('exercises');
const compositionFiles = readJsonDir('compositions');

const grammarPoints = grammarFiles.flatMap((f) => f.data);
const vocab = vocabFiles.flatMap((f) => f.data);
const exercises = exerciseFiles.flatMap((f) => f.data);
const compositions = compositionFiles.flatMap((f) => f.data);

// 1. Unique ID checks
const allIds = new Map();
function registerId(id, kind, file) {
  if (!id || typeof id !== 'string') {
    errors.push(`[${file}] Missing or invalid id in ${kind}`);
    return;
  }
  if (allIds.has(id)) {
    errors.push(`Duplicate ID "${id}" in ${kind} (${file}) and ${allIds.get(id)}`);
  } else {
    allIds.set(id, `${kind}:${file}`);
  }
}

for (const c of categories) registerId(c.id, 'category', 'categories.json');
for (const l of lessons) registerId(l.id, 'lesson', 'lessons.json');
for (const cmp of comparisons) registerId(cmp.id, 'comparison', 'comparisons.json');
for (const gf of grammarFiles) {
  for (const g of gf.data) {
    registerId(g.id, 'grammar', gf.file);
    for (const ex of g.examples || []) {
      registerId(ex.id, 'example', gf.file);
    }
  }
}
for (const vf of vocabFiles) {
  for (const v of vf.data) registerId(v.id, 'vocab', vf.file);
}
for (const ef of exerciseFiles) {
  for (const e of ef.data) registerId(e.id, 'exercise', ef.file);
}
for (const cf of compositionFiles) {
  for (const c of cf.data) registerId(c.id, 'composition', cf.file);
}

const lessonIds = new Set(lessons.map((l) => l.id));
const categoryIds = new Set(categories.map((c) => c.id));
const grammarIds = new Set(grammarPoints.map((g) => g.id));

function lessonNum(lid) {
  if (!lid) return 1;
  const m = String(lid).match(/L(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// 2. Lesson validation
if (lessons.length !== 22) {
  errors.push(`Expected 22 lessons, found ${lessons.length}`);
}
for (const l of lessons) {
  for (const gid of l.grammarIds || []) {
    if (!grammarIds.has(gid)) {
      errors.push(`Lesson ${l.id} references missing grammarId ${gid}`);
    }
  }
}

// 3. Grammar validation
for (const g of grammarPoints) {
  if (!categoryIds.has(g.categoryId)) {
    errors.push(`Grammar ${g.id} references invalid categoryId "${g.categoryId}"`);
  }
  if (g.lessonId !== 'P00' && !lessonIds.has(g.lessonId)) {
    errors.push(`Grammar ${g.id} references invalid lessonId "${g.lessonId}"`);
  }
  for (const pid of g.prerequisites || []) {
    if (!grammarIds.has(pid)) {
      errors.push(`Grammar ${g.id} references missing prerequisite "${pid}"`);
    }
  }
  for (const rid of g.relatedIds || []) {
    if (!grammarIds.has(rid)) {
      errors.push(`Grammar ${g.id} references missing relatedId "${rid}"`);
    }
  }
  const exCount = (g.examples || []).length;
  if (!g.isSupplementary && exCount < 5) {
    errors.push(`Grammar ${g.id} (${g.title}) has only ${exCount} examples (minimum 5 required)`);
  }
  if (!g.meaning || !g.pattern || !g.wordOrderNote || !g.referenceUrl) {
    errors.push(`Grammar ${g.id} missing required explanation/pattern/referenceUrl fields`);
  }
  for (const ex of g.examples || []) {
    if (!ex.hanzi || !ex.pinyin || !ex.ja) {
      errors.push(`Example ${ex.id} in ${g.id} missing hanzi/pinyin/ja`);
    }
  }
}

// 4. Vocab validation
for (const v of vocab) {
  if (v.lessonId !== null && !lessonIds.has(v.lessonId)) {
    errors.push(`Vocab ${v.id} has invalid lessonId "${v.lessonId}"`);
  }
  if (v.lessonId === null && v.source !== 'supplement') {
    errors.push(`Vocab ${v.id} has null lessonId but source is not "supplement"`);
  }
  for (const gid of v.grammarIds || []) {
    if (!grammarIds.has(gid)) {
      errors.push(`Vocab ${v.id} references missing grammarId "${gid}"`);
    }
  }
  if (!v.hanzi || !v.pinyin || !v.meaningJa || !Array.isArray(v.tones) || v.tones.length === 0) {
    errors.push(`Vocab ${v.id} missing required fields or empty tones`);
  }
  if (!v.example || !v.example.hanzi || !v.example.pinyin || !v.example.ja) {
    errors.push(`Vocab ${v.id} missing complete example`);
  }
}

// 5. Exercise validation
const promptSeen = new Map();
for (const e of exercises) {
  if (!lessonIds.has(e.lessonId)) {
    errors.push(`Exercise ${e.id} references invalid lessonId "${e.lessonId}"`);
  }
  const ln = lessonNum(e.lessonId);
  if (typeof e.minLesson !== 'number' || e.minLesson < 1 || e.minLesson > ln) {
    errors.push(`Exercise ${e.id} has invalid minLesson ${e.minLesson} for lesson ${e.lessonId}`);
  }
  if (!Array.isArray(e.grammarIds) || e.grammarIds.length === 0) {
    errors.push(`Exercise ${e.id} has empty grammarIds`);
  } else {
    for (const gid of e.grammarIds) {
      if (!grammarIds.has(gid)) {
        errors.push(`Exercise ${e.id} references missing grammarId "${gid}"`);
      } else {
        const gp = grammarPoints.find((x) => x.id === gid);
        if (gp && gp.lessonId !== 'P00' && lessonNum(gp.lessonId) > ln) {
          errors.push(`Exercise ${e.id} (${e.lessonId}) uses future grammar ${gid} (${gp.lessonId})`);
        }
      }
    }
  }

  // Answer consistency
  if (['multiple-choice', 'true-false', 'distinction', 'error-correction', 'combined'].includes(e.type)) {
    if (Array.isArray(e.choices) && e.choices.length > 0) {
      const ans = Array.isArray(e.answer) ? e.answer[0] : e.answer;
      if (!e.choices.includes(ans)) {
        errors.push(`Exercise ${e.id} answer "${ans}" not found in choices ${JSON.stringify(e.choices)}`);
      }
    }
  }
  if (e.type === 'word-order') {
    if (!Array.isArray(e.tokens) || e.tokens.length < 2) {
      errors.push(`Exercise ${e.id} (word-order) missing tokens`);
    } else {
      const ansStr = Array.isArray(e.answer) ? e.answer.join('') : String(e.answer);
      const tokJoined = e.tokens.join('');
      const norm = (s) => s.replace(/[\s，。？！,.?!]/g, '');
      if (norm(ansStr) !== norm(tokJoined) && [...norm(ansStr)].sort().join('') !== [...norm(tokJoined)].sort().join('')) {
        errors.push(`Exercise ${e.id} (word-order) tokens "${tokJoined}" do not match characters of answer "${ansStr}"`);
      }
    }
  }
  if (!e.explanation || !e.grammarRuleNote) {
    errors.push(`Exercise ${e.id} missing explanation or grammarRuleNote`);
  }
  const dupKey = `${e.type}::${e.prompt}::${JSON.stringify(e.answer)}`;
  if (promptSeen.has(dupKey)) {
    warnings.push(`Duplicate exercise prompt detected: ${e.id} and ${promptSeen.get(dupKey)}`);
  } else {
    promptSeen.set(dupKey, e.id);
  }
}

// 6. Composition validation
const compPromptSeen = new Map();
for (const c of compositions) {
  if (!lessonIds.has(c.lessonId)) {
    errors.push(`Composition ${c.id} references invalid lessonId "${c.lessonId}"`);
  }
  const ln = lessonNum(c.lessonId);
  if (typeof c.minLesson !== 'number' || c.minLesson < 1 || c.minLesson > ln) {
    errors.push(`Composition ${c.id} has invalid minLesson ${c.minLesson} for lesson ${c.lessonId}`);
  }
  for (const gid of c.grammarIds || []) {
    if (!grammarIds.has(gid)) {
      errors.push(`Composition ${c.id} references missing grammarId "${gid}"`);
    } else {
      const gp = grammarPoints.find((x) => x.id === gid);
      if (gp && gp.lessonId !== 'P00' && lessonNum(gp.lessonId) > ln) {
        errors.push(`Composition ${c.id} (${c.lessonId}) uses future grammar ${gid} (${gp.lessonId})`);
      }
    }
  }
  if (!c.japanesePrompt || !c.modelAnswer || !c.pinyin || !c.explanation) {
    errors.push(`Composition ${c.id} missing core fields`);
  }
  if (!Array.isArray(c.hints) || c.hints.length < 2) {
    errors.push(`Composition ${c.id} needs at least 2 hints`);
  }
  if (compPromptSeen.has(c.japanesePrompt)) {
    warnings.push(`Duplicate composition prompt: ${c.id} and ${compPromptSeen.get(c.japanesePrompt)}`);
  } else {
    compPromptSeen.set(c.japanesePrompt, c.id);
  }
}

// 7. Coverage thresholds per major grammar & per lesson
const primaryGrammar = grammarPoints.filter((g) => !g.isSupplementary);
for (const g of primaryGrammar) {
  const exCnt = exercises.filter((e) => e.grammarIds.includes(g.id)).length;
  const cmpCnt = compositions.filter((c) => c.grammarIds.includes(g.id)).length;
  if (exCnt < 10) {
    errors.push(`Grammar ${g.id} (${g.title}) has only ${exCnt} exercises (minimum 10 required)`);
  }
  if (cmpCnt < 5) {
    errors.push(`Grammar ${g.id} (${g.title}) has only ${cmpCnt} compositions (minimum 5 required)`);
  }
}
for (const l of lessons) {
  const lesExCnt = exercises.filter((e) => e.lessonId === l.id).length;
  const lesCompCnt = exercises.filter((e) => e.lessonId === l.id && e.isLessonComprehensive).length;
  const lesVocabCnt = vocab.filter((v) => v.lessonId === l.id).length;
  if (lesExCnt < 10) {
    errors.push(`Lesson ${l.id} has only ${lesExCnt} exercises (minimum 10 required)`);
  }
  if (lesCompCnt < 10) {
    errors.push(`Lesson ${l.id} has only ${lesCompCnt} comprehensive exercises (minimum 10 required)`);
  }
  if (lesVocabCnt < 5) {
    errors.push(`Lesson ${l.id} has only ${lesVocabCnt} vocab items`);
  }
}

// Check pronunciation & comparisons references
for (const cmp of comparisons) {
  for (const gid of cmp.grammarIds || []) {
    if (!grammarIds.has(gid)) errors.push(`Comparison ${cmp.id} references missing grammar ${gid}`);
  }
}
for (const p of pronunciation.pairDrills || []) {
  if (!lessonIds.has(p.lessonId)) errors.push(`Pronunciation drill ${p.id} invalid lessonId`);
}

console.log('=== Data Validation Summary ===');
console.log(`Lessons: ${lessons.length}`);
console.log(`Categories: ${categories.length}`);
console.log(`Grammar Points: ${grammarPoints.length} (Primary: ${primaryGrammar.length}, Supplementary: ${grammarPoints.length - primaryGrammar.length})`);
console.log(`Examples: ${grammarPoints.reduce((s, g) => s + (g.examples || []).length, 0)}`);
console.log(`Vocabulary: ${vocab.length}`);
console.log(`Exercises: ${exercises.length}`);
console.log(`Compositions: ${compositions.length}`);
console.log(`Comparisons: ${comparisons.length}`);
console.log(`Warnings: ${warnings.length}`);
for (const w of warnings.slice(0, 20)) console.log('  WARN:', w);
console.log(`Errors: ${errors.length}`);
for (const err of errors.slice(0, 50)) console.error('  ERROR:', err);

if (errors.length > 0) {
  process.exit(1);
}
