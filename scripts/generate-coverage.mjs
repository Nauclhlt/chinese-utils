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
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

const lessons = readJson('lessons.json').sort((a, b) => a.number - b.number);
const grammarPoints = readJsonDir('grammar');
const vocab = readJsonDir('vocab');
const exercises = readJsonDir('exercises');
const compositions = readJsonDir('compositions');

const totalExamples = grammarPoints.reduce((s, g) => s + (g.examples?.length || 0), 0);
const primaryGrammar = grammarPoints.filter((g) => !g.isSupplementary);
const suppGrammar = grammarPoints.filter((g) => g.isSupplementary);
const suppVocab = vocab.filter((v) => v.source === 'supplement');

const lines = [];
lines.push('# 教材対応・網羅性レポート (COVERAGE.md)\n');
lines.push('> 本レポートは `scripts/generate-coverage.mjs` により学習データJSONから自動生成されています。\n');
lines.push('## 全体サマリー\n');
lines.push(`- **対応課数**: ${lessons.length} 課（第1課〜第22課）`);
lines.push(`- **主要文法事項数**: ${primaryGrammar.length} 項目（補足・基礎発音項目: ${suppGrammar.length} 項目、合計 ${grammarPoints.length} 項目）`);
lines.push(`- **独自例文数**: ${totalExamples} 件`);
lines.push(`- **語彙データ数**: ${vocab.length} 語（教材範囲: ${vocab.length - suppVocab.length} 語 / 独自補足語彙: ${suppVocab.length} 語）`);
lines.push(`- **練習問題数**: ${exercises.length} 問`);
lines.push(`- **中国語作文問題数**: ${compositions.length} 問\n`);

lines.push('## 課別対応状況\n');
lines.push('| 課 | テーマ | 調査状況 | 文法解説数 | 語彙数 | 例文数 | 練習問題数 (うち総合) | 作文問題数 | 検証状況 | 未対応事項 |');
lines.push('|:---:|---|:---:|---:|---:|---:|---:|---:|:---:|---|');

for (const l of lessons) {
  const gs = grammarPoints.filter((g) => g.lessonId === l.id);
  const vs = vocab.filter((v) => v.lessonId === l.id);
  const exSents = gs.reduce((s, g) => s + (g.examples?.length || 0), 0);
  const exs = exercises.filter((e) => e.lessonId === l.id);
  const compExs = exs.filter((e) => e.isLessonComprehensive);
  const cmps = compositions.filter((c) => c.lessonId === l.id);

  const ok =
    gs.length > 0 &&
    gs.every((g) => g.isSupplementary || (g.examples?.length || 0) >= 5) &&
    compExs.length >= 10;
  const status = ok ? '合格' : '要確認';
  const missing = ok ? 'なし' : '件数基準確認中';

  lines.push(
    `| ${l.id} | ${l.topic} | 調査済み | ${gs.length} | ${vs.length} | ${exSents} | ${exs.length} (${compExs.length}) | ${cmps.length} | ${status} | ${missing} |`
  );
}

lines.push('\n## 文法事項別対応状況\n');
lines.push('| ID | 課 | 文法事項名 | 区分 | 文法解説 | 例文数 | 練習問題数 | 作文問題数 | 検証状況 | 未対応事項 |');
lines.push('|:---:|:---:|---|:---:|:---:|---:|---:|---:|:---:|---|');

for (const g of grammarPoints) {
  const exCnt = exercises.filter((e) => e.grammarIds.includes(g.id)).length;
  const cmpCnt = compositions.filter((c) => c.grammarIds.includes(g.id)).length;
  const sentCnt = g.examples?.length || 0;
  const kind = g.isSupplementary ? '補足/発展' : '教材主要';
  const ok = g.isSupplementary ? sentCnt >= 3 : sentCnt >= 5 && exCnt >= 10 && cmpCnt >= 5;
  const status = ok ? '合格' : '要確認';
  const gaps = [];
  if (!g.isSupplementary) {
    if (sentCnt < 5) gaps.push(`例文${sentCnt}/5`);
    if (exCnt < 10) gaps.push(`練習${exCnt}/10`);
    if (cmpCnt < 5) gaps.push(`作文${cmpCnt}/5`);
  }
  lines.push(
    `| ${g.id} | ${g.lessonId} | ${g.title} | ${kind} | あり | ${sentCnt} | ${exCnt} | ${cmpCnt} | ${status} | ${gaps.length ? gaps.join(', ') : 'なし'} |`
  );
}

fs.writeFileSync(path.join(root, 'COVERAGE.md'), lines.join('\n') + '\n', 'utf-8');
console.log('Generated COVERAGE.md successfully.');
