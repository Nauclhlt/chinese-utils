# 中国語文学リーダー 作品データ仕様書 (WORK_FORMAT.md)

`schemaVersion: "1.0.0"` の作品データJSONに関する完全な仕様書です。  
TypeScript型定義は [src/reader/types/work.ts](../src/reader/types/work.ts)、JSON Schemaは [src/reader/schema/work.schema.json](../src/reader/schema/work.schema.json)、静的検証ロジックは [src/reader/core/validateWork.ts](../src/reader/core/validateWork.ts) および [scripts/validate-works.mjs](../scripts/validate-works.mjs) に実装されています。

---

## 1. 設計とファイル構成

数千〜数万字程度の中国語短編小説・散文の読み込みと配布を簡素化するため、以下の原則を採用しています。

- **1作品＝1JSONファイル原則**: 本文、ピンイン、日本語訳、共通語彙集（`glossary`）、インライン注釈（`annotations`）、背景知識（`backgroundNotes`）、登場人物（`characters`）、時系列（`timeline`）、読解・連携演習問題（`quiz` / `practiceItems`）をすべて単一JSONに格納します。
- **サイト同梱作品配置先**: `src/reader/data/works/<work-id>.json`（`import.meta.glob` によりコード変更なしで自動認識・本棚登録されます）。
- **ローカル作品保存先**: ブラウザからUI経由でインポートされた作品は IndexedDB（`kyoto_call_chinese_reader_db_v1`、非対応環境は `localStorage` フォールバック）に端末内保存され、外部サーバーへ送信されません。
- **表紙・音声アセット（任意）**:
  - サイト同梱作品の表紙・音声は `public/assets/reader/` 配下に配置し、`./assets/reader/<filename>` の相対パスで参照します（`vite.config.ts` の `base: './'` と互換）。
  - ローカル作品は外部画像URL（`https://...`）または Data URL（`data:image/...;base64,...`、ファイル全体上限 **10MB** 以内）を使用するか、表紙を省略（自動テキストカバー表示）できます。
  - **暫定アセットについての制約記録**: サンプル作品の表紙生成時、画像生成APIが `HTTP 429 RESOURCE_EXHAUSTED` 上限に到達したため、オリジナルSVG表紙（`public/assets/reader/cover_shanghai_rain.svg`, `cover_suzhou_tea.svg`）を採用しています。将来ラスタ画像へ差し替える場合は `metadata.coverImage` のパスを更新するだけで反映されます。

---

## 2. トップレベル構造

| フィールド | 必須 | 型 | 説明 |
|---|---|---|---|
| `schemaVersion` | 必須 | `"1.0.0"` | 仕様バージョン固定文字列 |
| `metadata` | 必須 | `WorkMetadata` | 作品ID、タイトル、スクリプト、文字数、難易度目安、権利情報など |
| `characters` | 必須 | `WorkCharacter[]` | 登場人物一覧（`[]` 可） |
| `backgroundNotes` | 必須 | `BackgroundNote[]` | 文化的・地理的・歴史的・SF設定などの背景解説（`[]` 可） |
| `timeline` | 任意 | `TimelineEntry[]` | 時系列整理 |
| `glossary` | 必須 | `GlossaryEntry[]` | 作品内で再利用する共通単語帳（1件以上必須） |
| `chapters` | 必須 | `WorkChapter[]` | 章・段落・文・インライン注釈（1章以上必須） |
| `practiceItems` | 任意 | `WorkPracticeItem[]` | 作品連動の任意の声調・語順・文法演習問題 |

---

## 3. 主要オブジェクトの詳細仕様

### 3.1 `metadata` (`WorkMetadata`)

- `id` (必須): `/^[a-z0-9][a-z0-9-_]{1,64}$/`。重複不可。
- `titleZh` / `titlePinyin` / `titleJa` (必須): 原題・ピンイン・日本語タイトル。`subtitle` は任意。
- `author` (必須): 著者名。`authorNote` は任意。
- `script` (必須): `"zh-Hans"`（簡体字）または `"zh-Hant"`（繁体字）。リーダーは本文要素に `lang={work.metadata.script}` を付与し、原文文字種を無断変換せず保持します。
- `genres` (必須): 1つ以上のジャンル文字列配列。
- `synopsis` (必須): ネタバレを含まないあらすじ。
- `coverImage` / `coverAlt` (任意): 表紙画像パス・代替テキスト。
- `estimatedDifficulty` / `difficultyBasis` (必須): 読解難易度の目安（例：「中級前後・HSK4〜5級相当の表現を含む目安」）と、その根拠・非公式目安である旨の説明。
- `charCount` (必須): 本文の漢字文字数目安（CJC漢字数）。`chapterCount` (必須): `chapters.length` と一致必須。
- `rights` (必須):
  - `status`: `"original" | "public-domain" | "licensed" | "personal-local"`
  - `notice`: 権利・利用条件の説明。
  - `redistributableInRepo`: **サイト同梱作品 (`src/reader/data/works/*.json`) は `true` 必須**。個人利用限定作品を同梱してはなりません。

### 3.2 `glossary` (`GlossaryEntry[]`) — 共通語彙による容量最適化

同じ単語が何度も登場しても説明を重複させず、`glossary` に基本情報を置き、各文の `vocab` 注釈には `glossaryId` と「その文脈固有の意味・読み」だけを保持します。

- `id`, `headword`, `pinyin`, `tones` (`{ syllable, tone: 1|2|3|4|5 }[]`), `pos`, `generalMeaningJa`: 必須。
- `wordStructure`, `usageNote`, `synonymDiff`, `examples`: 任意（学習価値の高い語彙に付与）。
- `relatedLessonId`, `relatedVocabId`: 既存CALL教材（`src/data/vocab/*.json` の `V01-001` 等）と対応する場合のみ実在IDを指定。

### 3.3 `chapters` / `paragraphs` / `sentences` / 文字範囲仕様

- `chapters[i].index` は配列インデックス `i`（0始まり）、`number` は表示用章番号（1始まり）。
- `paragraphs[p].kind`: `"narrative" | "dialogue" | "letter" | "quote" | "heading"`。原文の段落分け・手紙引用・会話文を保持します。
- `sentences[s]`:
  - `id`: 作品内で一意。
  - `text`: 原文1文（または改行を保持したフレーズ）。中国語の句読点（`，。！？；：“”……` 等）や空白・漢字変換（簡/繁）は原文のまま一切変更しません。
  - `pinyin`: 文全体の文脈対応ピンイン（多音字反映済み）。
  - `translationJa`: 文全体の自然な日本語訳。
  - `audioUrl` (任意): 事前生成音声がある場合のみ安全パスを指定（未指定・再生失敗時はWeb Speech APIにフォールバック）。

#### UTF-16文字範囲 `[start, end)` と `surface` の厳密仕様

中国語は分かち書きされないため、注釈範囲は **JavaScript/UTF-16コードユニットのインデックス `[start, end)`（`start` 含む、`end` 含まない）** と、検証用文字列 `surface` の組で管理します。

- 検証式: `0 <= start < end <= sentence.text.length` かつ `sentence.text.slice(start, end) === annotation.surface`
- **重複注釈の扱い**: 同一文中で複数の注釈範囲が重なること（例：12文字の `grammar` 注釈範囲の内側に2文字の `vocab` 注釈や `expression` 注釈が含まれる）を許容します。UI側は [annotationSegments.ts](../src/reader/core/annotationSegments.ts) により最小の重ならない原子スパンへ分割し、クリック/タップ時に重なったすべての注釈をポップアップおよび詳細パネルへ階層表示します。
- **同一語句の複数回出現**: `text.indexOf(surface, fromIndex)` で出現位置ごとに正確な `[start, end)` を算出し、初出や多音字の切り替わりなど学習価値の高い箇所のみに付与します。
- **サロゲートペア・BMP外文字**: UTF-16コードユニット単位で `String.prototype.slice` と一致させるため、プログラムで `text.indexOf` / 位置計算を行うことを推奨します（手計算禁止）。

### 3.4 ネタバレ制御 (`revealFromChapterIndex`)

- `characters`, `backgroundNotes`, `timeline`, および `InlineAnnotation` に `revealFromChapterIndex`（0始まり章インデックス）を設定できます。
- 読者の到達章（`maxReachedChapterIndex`）が `revealFromChapterIndex` 未満かつ「ネタバレ全表示」がOFFのとき、リーダーは該当注釈・登場人物設定（`spoilerDescription`）・背景詳細（`spoilerDetail`）を自動的に隠し、「明示的に開く」ボタン操作時のみ開示します。

### 3.5 セキュリティ制約

- JSONファイル全体サイズ上限: **10MB**。
- `text` / `translationJa` 内への `<script`, `onerror=`, `onload=`, `<iframe` 等の混入を拒否します。
- `coverImage` / `audioUrl` 内の `..`, `\`, `javascript:`, `data:text/html`, `vbscript:` を拒否します（ReactもHTMLエスケープ描画を徹底し、任意コードは実行しません）。

---

## 4. 最小サンプルデータ

```json
{
  "schemaVersion": "1.0.0",
  "metadata": {
    "id": "minimal-sample-zh-hant",
    "titleZh": "雨夜茶館",
    "titlePinyin": "Yǔyè Cháguǎn",
    "titleJa": "雨夜の茶館",
    "author": "サンプル著者",
    "script": "zh-Hant",
    "genres": ["日常"],
    "synopsis": "雨の夜、古い茶館でお茶を待つ静かな情景。",
    "estimatedDifficulty": "初級後半（目安）",
    "difficultyBasis": "基本的な日常表現中心の短い散文としての編集上の目安",
    "charCount": 14,
    "chapterCount": 1,
    "rights": {
      "status": "personal-local",
      "notice": "個人検証用サンプル",
      "redistributableInRepo": false
    },
    "createdAt": "2026-11-26",
    "updatedAt": "2026-11-26"
  },
  "characters": [],
  "backgroundNotes": [],
  "glossary": [
    {
      "id": "g_cha",
      "headword": "茶館",
      "pinyin": "cháguǎn",
      "tones": [
        { "syllable": "chá", "tone": 2 },
        { "syllable": "guǎn", "tone": 3 }
      ],
      "pos": "名詞",
      "generalMeaningJa": "茶館・喫茶店",
      "examples": []
    }
  ],
  "chapters": [
    {
      "id": "ch1",
      "index": 0,
      "number": 1,
      "titleZh": "窗外",
      "titlePinyin": "Chuāngwài",
      "titleJa": "窓の外",
      "summaryNoSpoiler": "雨の茶館で一息つく。",
      "paragraphs": [
        {
          "id": "p1",
          "kind": "narrative",
          "sentences": [
            {
              "id": "s1",
              "text": "雨聲落在老茶館的屋簷上。",
              "pinyin": "Yǔshēng luò zài lǎo cháguǎn de wūyán shàng.",
              "translationJa": "雨音が古い茶館の軒先に落ちていた。",
              "annotations": [
                {
                  "id": "a1",
                  "kind": "vocab",
                  "start": 5,
                  "end": 7,
                  "surface": "茶館",
                  "vocab": {
                    "glossaryId": "g_cha",
                    "surface": "茶館",
                    "contextualPinyin": "cháguǎn",
                    "contextualMeaningJa": "昔ながらの茶館"
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 5. バリデーション方法

```bash
# 同梱作品の全件スキーマ・範囲一致・参照整合性・セキュリティ検証
node scripts/validate-works.mjs

# 既存教材＋ゲーム＋文学作品の総合検証
npm run validate
```
