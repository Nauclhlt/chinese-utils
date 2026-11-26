# デザインガイドライン (DESIGN_GUIDELINES.md)

中国語CALL学習スタジオ全体で一貫性のある、洗練された視覚設計と操作体験を維持するための規約です。

---

## 1. 基本方針

- **情報構造を主役に**: 装飾的な枠線・影・グラデーションで区分するのではなく、余白・文字サイズ・ウェイト・背景色の階調で情報の階層を示します。
- **カード乱用の禁止**: カード（`.card`）は独立した操作単位や視覚的まとまりに限って使用し、統計値・設定項目・一覧行・例文を個別に箱で囲みません。
- **簡潔な操作UI**: 状態がスイッチ位置やスタイルから一目で分かるトグルには「：表示」「：ON」といった重複テキストを付けません（アクセシビリティ用 `aria-label`・`aria-checked` は必ず付与）。
- **ゲーム領域の尊重**: ノベル・リズム・誤文ハンター・語順パズルのプレイ画面は、没入感・ゲーム体験を優先した独自アートディレクションを維持します。ゲーム一覧ハブ（`GamesHubPage`）は全体デザインシステムと調和させます。

---

## 2. デザイントークン ([src/styles/tokens.css](../src/styles/tokens.css))

- **背景の階調**:
  - `--bg-canvas`: アプリ全体のキャンバス（Light `#f7f7f5` / Dark `#0d1117`）
  - `--bg-sidebar`: サイドナビゲーション（Light `#f2f2ef` / Dark `#111620`）
  - `--bg-surface`: 主要コンテンツ面（Light `#ffffff` / Dark `#161d2b`）
  - `--bg-subtle`: 補助トーン面・テーブルホバー・インセット（Light `#f3f3ef` / Dark `#1d2638`）
- **テキスト階調**: `--text-primary`（見出し・本文）、`--text-secondary`（補足・副情報）、`--text-tertiary`（メタデータ・注釈番号）。
- **アクセントカラー**: `--accent`（Light `#2563eb` / Dark `#60a5fa`）は **プライマリ操作・アクティブタブ／ナビ・フォーカスリング** のみに限定し、通常見出しや一般リンク以外の装飾へ乱用しない。
- **ボーダー**:
  - `--border-subtle`: セクション区切り線・テーブル行・ヘアライン枠（`rgba(..., 0.08)`）
  - `--border-control`: 入力欄（`.input`, `.select`, `.textarea`）と選択肢・セカンダリボタンのみ
- **角丸**: `--radius-xs: 4px`（バッジ・タグ）、`--radius-sm: 6px`（ボタン・入力・インセット）、`--radius-md: 10px`（パネル・モーダル・ブックカード）、`--radius-full: 9999px`（Switch・プログレスバー専用）。
- **シャドウ**: `--shadow-popover`・`--shadow-modal`・`--shadow-panel` を浮いているUI（ポップアップ、モーダル、ドロワー）のみに適用し、通常の `.card` には使用しない。

---

## 3. UIプリミティブ ([src/components/ui/index.tsx](../src/components/ui/index.tsx))

- **`Switch`**: `<button role="switch" aria-checked>` によるスライドトグル。視覚的なON/OFF位置と `label` のみで構成する。
- **`Tabs`**: 下線アクティブインジケーター（`.tabs-bar` / `.tab-btn`）によるタブ切り替え。ボタンの枠線乱立を避ける。
- **`ProgressBar`**: 枠線なし 5px 高のミニマルな進捗バー。

---

## 4. ページ類型別レイアウト方針

1. **ダッシュボード (`DashboardPage`)**:
   - ヘッダーは枠なし（`.page-header`）。初期設定バナーは未設定時のみ表示。
   - 指標は4枚カードではなく、1つの **Stat Strip（`.stat-strip`）** に集約し、等幅数字（`tabular-nums`）で比較しやすくする。
   - 次の学習・復習候補は、行全体がリンクとなった **List Group（`.list-group` / `.list-row`）** に統一し、各行でのボタン連打を廃止。
2. **一覧ページ（`LessonsPage`, `GrammarListPage`, `VocabPage`, `ReviewPage`）**:
   - 課一覧や文法一覧はカードグリッドではなく、ヘアライン区切りの `.list-group` に行クリック導線＋最小限の補助操作を配置。
   - 語彙一覧は高密度テーブル＋フラットな絞り込みツールバーで構成。
3. **ドキュメント・解説ページ（`GrammarDetailPage`, `LessonDetailPage`, `ComparisonsPage`）**:
   - 見出し→構文図→使用条件→例文という視線導線を、空白とヘアライン（`.doc-section`）で構成。例文ごとに箱で囲まない。
4. **集中演習ページ（`FlashcardsPage`, `PinyinPracticePage`, `GrammarPracticePage`, `CompositionPracticePage`, `ListeningPage`, `ExamPage`）**:
   - `max-width: 820px〜880px` に幅を制限し、不要な長文説明を省いて入力とフィードバックに集中させる。
5. **設定ページ（`SettingsPage`）**:
   - チェックボックスカードではなく、ヘアライン区切りの `.setting-row` ＋ `Switch` を採用。
6. **中国語文学リーダー（`BookshelfPage`, `LiteratureReaderPage`）**:
   - 本文中心の静かな読書体験を最優先し、文ごとの操作アイコンはホバー/フォーカス時のみ明瞭化する（モバイルでは操作性確保のため視認可能）。
   - ポップアップ（`AnnotationPopup`）と詳細サイドパネル（`AnnotationSidePanel`）のみエレベーションシャドウを適用。

---

## 5. 多言語タイポグラフィとアクセシビリティ

- 中国語簡体字には必ず `lang="zh-Hans"`、繁体字には `lang="zh-Hant"` を付与し、CSS側で適切な中華フォントスタック（`--font-zh-hans`, `--font-zh-hant`, `--font-zh-serif`）が選択されるようにする。
- フォーカス可視化（`:focus-visible`）およびキーボード操作（Esc, Enter, Space）を維持する。
- 状態識別は色だけでなく、スイッチ位置・下線形状（語彙点線・文法実線・表現破線・背景波線）・ラベル・アイコン形状を併用する。
