import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gamesDataDir = path.join(root, 'src', 'games', 'data');
const mainDataDir = path.join(root, 'src', 'data');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

const errors = [];
const warnings = [];

// Load valid grammar IDs from main curriculum
const grammarIds = new Set();
for (const f of fs.readdirSync(path.join(mainDataDir, 'grammar')).filter((x) => x.endsWith('.json'))) {
  for (const g of readJson(path.join(mainDataDir, 'grammar', f))) {
    grammarIds.add(g.id);
  }
}

// 1. Validate Visual Novel
const novelDir = path.join(gamesDataDir, 'novel');
const novelMeta = readJson(path.join(novelDir, 'meta.json'));

// Verify referenced image assets exist in public/
function checkAsset(relPath, label) {
  const clean = relPath.replace(/^\.\//, '');
  const full = path.join(root, 'public', clean);
  if (!fs.existsSync(full)) {
    errors.push(`Novel missing asset (${label}): ${full}`);
  }
}
checkAsset(novelMeta.titleImage, 'titleImage');
for (const [k, v] of Object.entries(novelMeta.backgrounds || {})) checkAsset(v, `bg:${k}`);
for (const [ck, exprs] of Object.entries(novelMeta.characters || {})) {
  for (const [ek, ev] of Object.entries(exprs)) checkAsset(ev, `char:${ck}:${ek}`);
}
for (const cg of novelMeta.cgs || []) checkAsset(cg.image, `cg:${cg.id}`);

const chapterFiles = fs
  .readdirSync(novelDir)
  .filter((f) => /^ch\d+\.json$/.test(f))
  .sort();

let totalNovelLines = 0;
const unlockedEndings = new Set();
const unlockedCgs = new Set();

for (const cf of chapterFiles) {
  const ch = readJson(path.join(novelDir, cf));
  const lineMap = new Map((ch.lines || []).map((l) => [l.id, l]));
  totalNovelLines += lineMap.size;

  if (!lineMap.has(ch.startLineId)) {
    errors.push(`Novel ${cf}: startLineId "${ch.startLineId}" not found`);
  }

  for (const ln of ch.lines || []) {
    if (!ln.textZh || !ln.pinyin || !ln.textJa) {
      errors.push(`Novel ${cf} line ${ln.id}: missing textZh/pinyin/textJa`);
    }
    if (!Array.isArray(ln.tokens) || ln.tokens.length === 0) {
      warnings.push(`Novel ${cf} line ${ln.id}: empty tokens`);
    }
    if (ln.background && !novelMeta.backgrounds[ln.background]) {
      errors.push(`Novel ${cf} line ${ln.id}: unknown background "${ln.background}"`);
    }
    if (ln.cg && !novelMeta.cgs.some((c) => c.id === ln.cg)) {
      errors.push(`Novel ${cf} line ${ln.id}: unknown cg "${ln.cg}"`);
    }
    for (const c of ln.characters || []) {
      if (!novelMeta.characters[c.characterId]?.[c.expression]) {
        errors.push(`Novel ${cf} line ${ln.id}: unknown character "${c.characterId}:${c.expression}"`);
      }
    }
    if (ln.nextLineId && !lineMap.has(ln.nextLineId)) {
      errors.push(`Novel ${cf} line ${ln.id}: broken nextLineId "${ln.nextLineId}"`);
    }
    for (const choice of ln.choices || []) {
      if (!lineMap.has(choice.nextLineId)) {
        errors.push(`Novel ${cf} line ${ln.id} choice ${choice.id}: broken nextLineId "${choice.nextLineId}"`);
      }
    }
    if (ln.branchCheck) {
      if (!lineMap.has(ln.branchCheck.trueNextLineId)) {
        errors.push(`Novel ${cf} line ${ln.id}: broken branchCheck trueNextLineId`);
      }
      if (!lineMap.has(ln.branchCheck.falseNextLineId)) {
        errors.push(`Novel ${cf} line ${ln.id}: broken branchCheck falseNextLineId`);
      }
    }
    if (ln.unlockEnding) unlockedEndings.add(ln.unlockEnding);
    if (ln.unlockCg) unlockedCgs.add(ln.unlockCg);
  }

  // BFS reachability check within chapter
  const visited = new Set();
  const queue = [ch.startLineId];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur || visited.has(cur)) continue;
    visited.add(cur);
    const ln = lineMap.get(cur);
    if (!ln) continue;
    if (ln.nextLineId) queue.push(ln.nextLineId);
    for (const choice of ln.choices || []) queue.push(choice.nextLineId);
    if (ln.branchCheck) {
      queue.push(ln.branchCheck.trueNextLineId);
      queue.push(ln.branchCheck.falseNextLineId);
    }
  }
  const unreachable = [...lineMap.keys()].filter((id) => !visited.has(id));
  if (unreachable.length > 0) {
    errors.push(`Novel ${cf}: unreachable lines: ${unreachable.join(', ')}`);
  }
}

for (const e of novelMeta.endings || []) {
  if (!unlockedEndings.has(e.id)) {
    errors.push(`Novel ending "${e.id}" is never unlocked in any chapter`);
  }
}

// 2. Validate Grammar Correction Game
const gcDir = path.join(gamesDataDir, 'grammar-correction');
const gcStages = readJson(path.join(gcDir, 'stages.json'));
const gcStageIds = new Set(gcStages.map((s) => s.id));
const gcIds = new Set();
let gcCount = 0;

for (const f of fs.readdirSync(gcDir).filter((x) => /^stage\d+\.json$/.test(x)).sort()) {
  const list = readJson(path.join(gcDir, f));
  for (const q of list) {
    gcCount++;
    if (gcIds.has(q.id)) errors.push(`Duplicate GrammarGame ID: ${q.id}`);
    gcIds.add(q.id);
    if (!gcStageIds.has(q.stageId)) errors.push(`${q.id}: invalid stageId ${q.stageId}`);
    for (const gid of q.grammarIds || []) {
      if (!grammarIds.has(gid)) errors.push(`${q.id}: invalid grammarId ${gid}`);
    }
    for (const ei of q.errorIndices || []) {
      if (ei < 0 || ei >= (q.tokens || []).length) {
        errors.push(`${q.id}: errorIndex ${ei} out of tokens bounds`);
      }
    }
    if (!q.correctedSentence || !q.explanation || !q.pinyin) {
      errors.push(`${q.id}: missing correctedSentence/explanation/pinyin`);
    }
  }
}
if (gcCount < 300) {
  errors.push(`GrammarCorrection count ${gcCount} is below 300 minimum`);
}

// 3. Validate Word Puzzle Game
const wpDir = path.join(gamesDataDir, 'word-puzzle');
const wpStages = readJson(path.join(wpDir, 'stages.json'));
const wpStageIds = new Set(wpStages.map((s) => s.id));
const wpIds = new Set();
let wpCount = 0;
const normZh = (s) => s.replace(/[\s，,。．.！!？?、；;：:""“”''（）()]/g, '');

for (const f of fs.readdirSync(wpDir).filter((x) => /^stage\d+\.json$/.test(x)).sort()) {
  const list = readJson(path.join(wpDir, f));
  for (const q of list) {
    wpCount++;
    if (wpIds.has(q.id)) errors.push(`Duplicate WordPuzzle ID: ${q.id}`);
    wpIds.add(q.id);
    if (!wpStageIds.has(q.stageId)) errors.push(`${q.id}: invalid stageId ${q.stageId}`);
    for (const gid of q.grammarIds || []) {
      if (!grammarIds.has(gid)) errors.push(`${q.id}: invalid grammarId ${gid}`);
    }
    const chunkMap = new Map((q.chunks || []).map((c) => [c.id, c]));
    const nonDistractors = (q.chunks || []).filter((c) => !c.isDistractor).map((c) => c.id);
    if (nonDistractors.length !== (q.correctOrderIds || []).length) {
      errors.push(`${q.id}: correctOrderIds length mismatch with non-distractor chunks`);
    }
    for (const cid of q.correctOrderIds || []) {
      const ch = chunkMap.get(cid);
      if (!ch) errors.push(`${q.id}: correctOrderIds references missing chunk ${cid}`);
      else if (ch.isDistractor) errors.push(`${q.id}: correctOrderIds includes distractor ${cid}`);
    }
    const assembled = (q.correctOrderIds || []).map((cid) => chunkMap.get(cid)?.hanzi ?? '').join('');
    if (normZh(assembled) !== normZh(q.modelAnswer || '')) {
      errors.push(`${q.id}: assembled "${assembled}" != modelAnswer "${q.modelAnswer}"`);
    }
  }
}
if (wpCount < 300) {
  errors.push(`WordPuzzle count ${wpCount} is below 300 minimum`);
}

console.log('=== Games Data Validation Summary ===');
console.log(`Novel chapters: ${chapterFiles.length}, total lines: ${totalNovelLines}, endings unlocked: ${unlockedEndings.size}, CGs unlocked: ${unlockedCgs.size}`);
console.log(`Grammar Correction questions: ${gcCount}`);
console.log(`Word Puzzle questions: ${wpCount}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Errors: ${errors.length}`);
for (const err of errors.slice(0, 40)) console.error('  ERROR:', err);

if (errors.length > 0) process.exit(1);
