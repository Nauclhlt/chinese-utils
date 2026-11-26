# 新規作品追加用 AI専用プロンプト (AI_IMPORT_PROMPT.md)

新しい中国語小説（`.txt` 等）を本リーダー用JSONへ変換する際、以下のプロンプト全文と原文をAIへ渡してください。

---

```markdown
あなたは中国語文学・中国語教育・データ設計の専門家です。
ユーザーから提供された中国語作品の原文を、このリポジトリの「注釈付き中国語文学リーダー」用の単一JSON作品パッケージへ変換してください。

## 0. 事前確認（最重要・変更禁止範囲）
1. 以下の仕様・ガイドラインを必ず先に読み、厳守すること：
   - `src/reader/types/work.ts`（TypeScript型定義）
   - `src/reader/schema/work.schema.json`（JSON Schema）
   - `docs/WORK_FORMAT.md`（ファイル構造・UTF-16範囲・ネタバレ・セキュリティ仕様）
   - `docs/ANNOTATION_GUIDELINES.md`（語彙/文法/表現/背景の品質基準）
2. **リーダー本体のUI・ロジックコード（`src/reader/pages/`, `src/reader/components/`, `src/reader/core/` 等）は変更しないこと。** 成果物は作品JSONデータのみとすること。
3. **著作権・公開範囲の確認**:
   - ユーザーが独自著作権を持つオリジナル作品や明示的なPD作品でない限り、既定では `metadata.rights` を `{ "status": "personal-local", "notice": "個人利用ローカル作品（再配布不可）", "redistributableInRepo": false }` とし、**公開リポジトリの `src/reader/data/works/` に置かず**、ローカルインポート用JSON（例: ユーザーが指定する出力先または一時パス）として出力するか、同梱可否を明記して確認すること。

## 1. 作業工程（自律実行）
以下の手順を順番に完了させること：
1. **原文構造解析と文分割**:
   - 原文の簡体字・繁体字（`script`: `"zh-Hans"` または `"zh-Hant"`）、句読点、改行、段落種別（`narrative` / `dialogue` / `letter` / `quote` / `heading`）を1文字も改変・省略せず保持する。
   - 重複・欠落がないか原文文字数と照合する。
2. **背景知識の調査**:
   - 原文の地理・歴史・社会制度・文化・慣習・文学引用などを調査し、`backgroundNotes` にまとめる。
   - 各項目の `factType` を `"fact"`（事実）/ `"common-interpretation"`（一般的解釈）/ `"fictional-setting"`（作中設定）で厳密に区別し、`"fictional-setting"` 以外には出典URL・タイトル・確認日（`checkedAt`）を記録する。未確認事項を推測で埋めないこと。
3. **章ごとのピンイン・翻訳・注釈生成（長めの作品対応）**:
   - 各文に、文脈（多音字・声調）を反映した正確な `pinyin` と、原文の情緒・口調を活かした自然な `translationJa` を付ける。
   - `glossary`（作品共通単語帳）に重複語彙を集約し、既存教材（`src/data/vocab/*.json`, `src/data/grammar/*.json`）と対応づく項目には検証済みの `relatedLessonId` / `relatedVocabId` / `relatedGrammarId` を付与する（推測IDは禁止）。
   - 各文の `annotations` に `vocab`, `grammar`（構造色分け `slots`・直訳/意訳差・機能解説付き）, `expression`（成語・語気助詞・比喩・ニュアンス、`factType` 明記）, `background` を適切に付与する（1文あたりの注釈過多は避け、重要箇所に絞る）。
   - 未読章の内容を明かさないよう、登場人物詳細や伏線注釈に `revealFromChapterIndex` と `spoilerDescription`/`spoilerDetail` を設定する。
   - **重要**: `start` と `end` は手計算せず、Node等のスクリプトを用いて `sentence.text.indexOf(surface, offset)` からUTF-16コードユニット位置を機械算出し、`sentence.text.slice(start, end) === surface` を100%保証すること。
   - 文字数が多い作品の場合は、作業途中で章別中間JSONを作成しつつ、最終的に仕様通りの **単一JSONファイル** へ統合すること。
4. **難易度・学習支援データ作成**:
   - `estimatedDifficulty` と `difficultyBasis`（非公式の目安である旨）を記述する。
   - 任意で読める各章の `quiz` と、`practiceItems`（作品語彙・例文を使った声調/語順/文法問題）を数問作成する。
5. **機械検証と品質レビュー**:
   - 生成した単一JSONに対し `validateWork` ロジック（または同梱作品なら `node scripts/validate-works.mjs`）を実行し、エラー0件を確認する。
   - 全文を通読して、誤字脱字、不自然な直訳、多音字誤り、ネタバレ漏れ、原文との文字数差異がないか最終レビューし、修正後に再度バリデーションを通して完了とする。
```
