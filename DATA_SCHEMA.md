# データ構造・作成規則 (DATA_SCHEMA.md)

## 1. ID命名規則
- **課 (`Lesson`)**: `L01` 〜 `L22`（2桁ゼロ埋め）
- **文法分類 (`GrammarCategory`)**: `cat-*`（例: `cat-basic`, `cat-question`, `cat-negation`, `cat-aspect`, `cat-modal`, `cat-preposition`, `cat-particle`, `cat-modifier`, `cat-result-comp`, `cat-dir-comp`, `cat-potential-comp`, `cat-degree-comp`, `cat-comparison`, `cat-ba-bei`, `cat-existential`, `cat-complex`, `cat-quantity`, `cat-adverb`, `cat-pronunciation`）
- **文法事項 (`GrammarPoint`)**: `G01-01` 〜 `G22-03`（課番号-課内連番）。発展・基礎補足モジュールは `GP-01` 等（`isSupplementary: true`）
- **例文 (`ExampleSentence`)**: `EX-<GrammarId>-<1..N>`（例: `EX-G01-01-1`）
- **単語 (`VocabularyItem`)**: `V01-001` 〜 `V22-0XX`。登場課が教材で確認できない補足語彙は `VS-001` 〜（`lessonId: null`, `source: "supplement"`）
- **練習問題 (`ExerciseItem`)**: `Q-<GrammarId>-<01..NN>` または課総合問題 `Q-L<NN>-C<01..NN>`
- **作文問題 (`CompositionItem`)**: `C-<GrammarId>-<01..NN>`
- **文法比較 (`ComparisonGuide`)**: `CMP-01` 〜 `CMP-NN`

## 2. 主要エンティティ構造

### Lesson (`src/data/lessons.json`)
- `id`: `"L01"` .. `"L22"`
- `number`: `1` .. `22`
- `title`: 日本語課名（例: `"第1課"`）
- `topic`: 課のテーマ概要（日本語で独自記述）
- `objectives`: string[]（学習目標）
- `grammarIds`: string[]（対応文法ID一覧）
- `referenceUrl`: string（公式TOPページURL）
- `referenceTocUrl`: string（公式目次URL）

### GrammarPoint (`src/data/grammar/L01.json` .. `L22.json`, `P00.json`)
- `id`, `title`, `categoryId`, `lessonId`, `difficulty` (`1 | 2 | 3`)
- `isSupplementary?`: boolean（教材外の発展・基礎補足の場合 `true`）
- `prerequisites`: string[]（前提となる文法ID）
- `relatedIds`: string[]（関連文法ID）
- `meaning`: string
- `pattern`: string
- `structureSlots`: `{ role: SlotRole, label: string, text: string, pinyin?: string }[]`
- `wordOrderNote`: string
- `usageConditions`: string
- `distinctionNotes`: string
- `forms?`: `{ affirmative?: string, negative?: string, interrogative?: string }`
- `japaneseLearnerPitfalls`: string[]
- `similarDifferences`: `{ targetId?: string, targetName: string, difference: string }[]`
- `examples`: `ExampleSentence[]`（主要文法は最低5件）
- `referenceUrl`: string
- `referenceTitle`: string

### VocabularyItem (`src/data/vocab/L01.json` .. `L22.json`, `supplement.json`)
- `id`, `hanzi`, `pinyin`, `tones`: number[]（軽声は `5`）
- `meaningJa`, `pos`, `usage`
- `example`: `{ hanzi: string, pinyin: string, ja: string }`
- `lessonId`: string | null
- `minLesson`: number（`supplement` の場合も適切な目安課または `1`）
- `source`: `"textbook-scope" | "supplement"`
- `grammarIds`: string[]
- `synonyms?`: string[], `antonyms?`: string[], `related?`: string[], `measureWord?`: string

### ExerciseItem (`src/data/exercises/L01.json` .. `L22.json`)
- `id`, `lessonId`, `minLesson`: number, `grammarIds`: string[]
- `type`: `"fill-blank" | "multiple-choice" | "word-order" | "error-correction" | "true-false" | "distinction" | "combined"`
- `difficulty`: `1 | 2 | 3`
- `prompt`, `promptPinyin?`, `promptJa?`
- `choices?`: string[]（選択系では必須、正解が含まれること）
- `tokens?`: string[]（`word-order` では必須、並べて正解文字列を構成できること）
- `answer`: string | string[]
- `acceptableAnswers?`: string[]
- `explanation`: string（不正解時にも理由・規則を詳述）
- `grammarRuleNote`: string
- `isLessonComprehensive?`: boolean

### CompositionItem (`src/data/compositions/L01.json` .. `L22.json`)
- `id`, `lessonId`, `minLesson`: number, `grammarIds`: string[], `difficulty`: `1 | 2 | 3`
- `japanesePrompt`: string
- `targetGrammarHint`: string
- `hints`: `[string, string, string]`（段階的ヒント3つ）
- `modelAnswer`: string
- `acceptableAnswers`: string[]
- `pinyin`: string
- `structureBreakdown`: `{ text: string, role: SlotRole, label: string }[]`
- `explanation`: string
- `commonMistakes`: `{ wrong: string, reason: string }[]`

## 3. 品質・整合性ルール
1. すべてのIDは全データ集合を通じて一意とする。
2. すべての参照ID（`lessonId`, `categoryId`, `grammarIds`, `prerequisites`, `relatedIds`）は実在するIDを指すこと。
3. 学習範囲整合性: 課 `Lxx` の練習・作文問題では `minLesson <= xx` とし、その課で初出の文法・語彙を超えた未習事項を混ぜないこと。
4. ピンインはすべて声調付き正規表記とし、音節数と `tones` 配列を一致させること。
