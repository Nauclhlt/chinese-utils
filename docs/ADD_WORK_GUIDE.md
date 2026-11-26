# 新規作品追加ガイド (ADD_WORK_GUIDE.md)

中国語文学リーダーへ新しい作品（短編小説・散文・簡体字/繁体字テキスト）を追加する手順書です。リーダーのUIやReactソースコードを一切変更せずに作品を追加できます。

---

## 1. 対応する原文テキスト形式と権利確認

- **対応入力**: プレーンテキスト（`.txt`）、Markdown（`.md`）、またはチャプター分けされた文章テキスト（UTF-8推奨）。
- **簡体字・繁体字**: 原文のまま保持されます（`metadata.script` を `"zh-Hans"` または `"zh-Hant"` に設定）。
- **著作権と配布区分（最重要）**:
  - **公開リポジトリへ同梱してよいもの**: 自作オリジナル作品、パブリックドメイン（著作権消滅）確認済み作品、再配布許諾が明示された作品のみ（`rights.redistributableInRepo: true`）。
  - **個人鑑賞・商業作品など公開権限がないもの**: リポジトリ（`src/reader/data/works/`）には絶対にコミットせず、**「ローカル作品（`redistributableInRepo: false`, `status: "personal-local"`）」としてUIからインポート**して利用してください（IndexedDBにのみ保存され外部送信されません）。法令と作品利用条件を必ず遵守してください。

---

## 2. AIによる作品解析・単一JSON制作ワークフロー

1. 原文テキストと [docs/AI_IMPORT_PROMPT.md](./AI_IMPORT_PROMPT.md) をAIへ渡します。
2. AIは [docs/WORK_FORMAT.md](./WORK_FORMAT.md) と [docs/ANNOTATION_GUIDELINES.md](./ANNOTATION_GUIDELINES.md) に従い、以下を実行します：
   - 原文を章・段落・文に分割（原文文字・句読点の改変なし）
   - 語彙リスト（`glossary`）抽出と文脈ピンイン付与（多音字補正）
   - 自然な日本語訳の生成
   - 重なりを活かした4種注釈（語彙・文法・表現・背景）の付与と `[start, end)` 自動計算
   - 背景知識のWeb確認・出典URL/確認日の付与、`factType` 分類
   - ネタバレ防止位置 `revealFromChapterIndex` の設定
   - 単一JSONファイル `<work-id>.json` の生成

### 長めの短編・中編を扱う場合（内部分割→単一JSON統合）

1回のAI出力上限に収まらない文字数（例：1万〜3万字）の場合は、AI側の作業手順として以下のように内部分割処理します：

1. まず共通部分（`metadata`, `characters`, `backgroundNotes`, 初期 `glossary`）と各章のドラフト（`ch01_part.json`, `ch02_part.json` ...）を章単位で順に作成（中断しても未処理章から再開可能）。
2. 各章の注釈 `[start, end)` をプログラムで算出・検証しながら、未登録語彙を共通 `glossary` へマージ。
3. 最終的に全章と共通データを1つの `<work-id>.json` へ統合し、`node scripts/validate-works.mjs`（またはリーダーのインポート検証）で全原文・全注釈を検証します。

---

## 3. リーダーへの追加方法（2通り）

### 方法A：ブラウザUIからローカル作品として追加（推奨・個人用）

1. 本アプリの **「文学で学ぶ → 中国語文学リーダー」**（`#/reader`）を開きます。
2. 画面下部の **「新しい作品JSONをローカルに追加」** エリアへ `<work-id>.json` をドラッグ＆ドロップするか、「JSONファイルを選択」から読み込みます。
3. 自動的にスキーマ・注釈位置・セキュリティ検査が走り、問題がなければプレビューが表示されます（同じIDの既存作品がある場合は「上書き更新」警告が出ます）。
4. **「本棚に追加」** を押すと端末内の IndexedDB に保存され、すぐに読書できます。
5. バックアップを取りたい場合は本棚右上の **「ローカル作品をバックアップ」** からJSONを一括エクスポートできます。削除もカード右下のゴミ箱ボタンから行えます。

### 方法B：サイト同梱作品として追加（コード変更不要）

公開許可のあるオリジナル／パブリックドメイン作品のみに限定してください。

1. `rights.redistributableInRepo` を `true` に設定し、表紙画像を置く場合は `public/assets/reader/` へ配置して `metadata.coverImage: "./assets/reader/<name>"` とします。
2. 作成したJSONを `src/reader/data/works/<work-id>.json` に保存します。
3. `src/reader/data/index.ts` が `./works/*.json` を `import.meta.glob` で自動検出するため、React・ルーティングの編集は一切不要です。
4. 検証とビルドを実行します：
   ```bash
   npm run validate
   npm run check
   ```

---

## 4. よくある検証エラーと対処法

| エラー例 | 原因 | 対処法 |
|---|---|---|
| `注釈範囲の文字列不一致` | 手計算で `start`/`end` を記述し、1文字ズレた | Nodeスクリプトで `sentence.text.indexOf(surface)` を用いて機械計算させる |
| `glossaryId が glossary に存在しません` | 注釈側のIDと `glossary[].id` の綴りが不一致 | `glossary` 配列に該当IDを追加またはID名を揃える |
| `relatedGrammarId unknown` | 既存教材に存在しない文法IDを指定した | `src/data/grammar/*.json` に実在する `G01-01` 等のIDのみ指定し、該当がなければ省略する |
| `安全でないパスが含まれています` | `coverImage`/`audioUrl` に `../` や `javascript:` が含まれる | `./assets/reader/...` または `https://...` / `data:image/...` に直す |
| `metadata.chapterCount does not match` | 章数メタと `chapters.length` が不一致 | `metadata.chapterCount` を実際の章数に合わせる |
