# 進捗記録 (PROGRESS.md)

| 工程 | 内容 | 状態 | 備考 |
|---|---|---|---|
| 1 | 参考教材の網羅的な調査 | 完了 | 全228ページ取得・HTTP 200確認（失敗0件）、`RESEARCH.md` に全URL・全課記録済み |
| 2 | 教材内容の分類・構造化 | 完了 | 19文法分類・全22課・主要91文法＋基礎補足2項目・10比較テーマを体系化 |
| 3 | 学習機能とデータ構造の設計 | 完了 | `src/types/curriculum.ts` / `user.ts`、ピンイン正規化・差分比較・SRS・範囲制御・ストレージ実装 |
| 4 | 学習用データの作成 | 完了 | 独自例文466件、語彙519語、練習問題1,130問、作文問題455問を作成（転載なし） |
| 5 | Webアプリケーションの実装 | 完了 | 全必須機能・追加機能（比較・学習マップ・印刷・CSV/TSV出力・ダークモード等）実装完了 |
| 6 | データの正確性・網羅性の検証 | 完了 | `npm run validate`（Errors: 0, Warnings: 0）、`quality-review.mjs`（Issues: 0）、`COVERAGE.md` 生成 |
| 7 | アプリケーションの動作テスト | 完了 | `npx tsc --noEmit` 合格、Vitest 6ファイル20テスト合格、Playwright E2E（Edge・サブパス・モバイル）2テスト合格 |
| 8 | 発見した問題の修正 | 完了 | `pinyin.ts` 連結分割、L17作文 `lessonId` 型、L05/L15語彙ピンイン声調整合、E2Eサーバー非同期化・ロケータ修正 |
| 9 | GitHub Pagesへのデプロイ準備 | 完了 | `.github/workflows/deploy.yml`、`vite.config.ts` (`base: './'`)、`HashRouter` 整備済み |
| 10 | ドキュメントの作成 | 完了 | `README.md`, `PLAN.md`, `PROGRESS.md`, `RESEARCH.md`, `DATA_SCHEMA.md`, `COVERAGE.md`, `AGENTS.md` |

## 検証・確認事項の記録
- `npm run validate`: 22課、19分類、93文法事項（主要91＋基礎補足2）、466例文、519語彙、1,130練習問題、455作文問題、10比較ガイドについてID重複0・参照不整合0・件数基準未達0。
- `node scripts/quality-review.mjs`: 教材サイト固有例文との完全一致0件、語彙の声調記号数と `tones` 配列一致確認済み（Issues: 0）。
- 未確認・環境依存事項: WindowsのWeb Speech API（中国語 `zh-CN` 音声合成）は利用者端末のOS音声パック有無に依存するため、非対応環境では自動検知して音声機能のみを無効化し案内を表示する設計・実装とした。また、GitHubへの実際のpushおよびPages公開設定はリポジトリ権限外のためローカル準備まで完了している。
