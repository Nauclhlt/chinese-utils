import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookHeart, Bug, Music, Puzzle } from 'lucide-react';
import { loadGamesState } from '../games/core/gameStorage';
import {
  grammarCorrectionQuestions,
  novelChapters,
  novelMeta,
  wordPuzzleQuestions,
} from '../games/data';
import { RHYTHM_SONGS } from '../games/data/rhythm/songs';

export const GamesHubPage: React.FC = () => {
  const gs = useMemo(() => loadGamesState(), []);
  const clearedGrammarStages = Object.values(gs.grammarGame.stageRecords).filter((r) => r.cleared).length;
  const clearedPuzzleStages = Object.values(gs.wordPuzzle.stageRecords).filter((r) => r.cleared).length;
  const rhythmTopCount = Object.keys(gs.rhythm.highScores).length;

  return (
    <div className="stack-lg">
      <header className="page-header">
        <div>
          <h2 className="page-title">中国語ゲームセンター</h2>
          <p className="page-subtitle">独立したゲーム体験とSRS・学習履歴の連携（全4タイトル・オフライン対応）</p>
        </div>
      </header>

      <div className="grid-2">
        {/* 1. Visual Novel */}
        <article className="game-hub-card game-hub-accent-novel">
          <div className="row-between">
            <span className="badge badge-accent">ノベルゲーム</span>
            <BookHeart size={20} color="#3b82f6" />
          </div>
          <h3 style={{ margin: 0 }}>
            <span lang="zh-Hans">{novelMeta.titleZh}</span> — {novelMeta.titleJa}
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            雨の旧天文台を舞台に、女の子同士の繊細な心の距離を描く青春・静謐SFノベル。自然な現代中国語口語＋任意辞書＆音声補助。
          </p>
          <div className="row-wrap" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            <span>全{novelChapters.length}章</span>
            <span>・</span>
            <span>END達成 {gs.novel.unlockedEndings.length}/{novelMeta.endings.length}</span>
            <span>・</span>
            <span>CG解放 {gs.novel.unlockedCgs.length}/{novelMeta.cgs.length}</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Link to="/games/novel" className="btn btn-primary" data-testid="launch-novel-game">
              物語の世界へ入る
            </Link>
          </div>
        </article>

        {/* 2. Tone Rhythm */}
        <article className="game-hub-card game-hub-accent-rhythm">
          <div className="row-between">
            <span className="badge badge-accent">声調リズムアクション</span>
            <Music size={20} color="#8b5cf6" />
          </div>
          <h3 style={{ margin: 0 }}>
            <span lang="zh-Hans">声律星轨</span> — Tone Beat Orbit
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            オリジナル楽曲のBPMに同期して流れてくる音節の四声・軽声を5つのキー/パッドで叩く本格リズムゲーム（位置・色で答えがバレない設計）。
          </p>
          <div className="row-wrap" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            <span>オリジナル{RHYTHM_SONGS.length}曲 × 3難易度</span>
            <span>・</span>
            <span>6学習モード</span>
            <span>・</span>
            <span>ハイスコア記録 {rhythmTopCount}件</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Link to="/games/rhythm" className="btn btn-primary" data-testid="launch-rhythm-game">
              リズムゲームをプレイ
            </Link>
          </div>
        </article>

        {/* 3. Grammar Correction */}
        <article className="game-hub-card game-hub-accent-grammar">
          <div className="row-between">
            <span className="badge badge-accent">誤文ハンティング</span>
            <Bug size={20} color="#059669" />
          </div>
          <h3 style={{ margin: 0 }}>
            <span lang="zh-Hans">语病猎手</span> — Grammar Hunter
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            誤り発見・置換・削除・挿入・語順・全文書換・正誤判定・複数誤りの全8形式で誤文を訂正するステージ制パズル＆バトル。
          </p>
          <div className="row-wrap" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            <span>全12ステージ ({grammarCorrectionQuestions.length}問)</span>
            <span>・</span>
            <span>クリア済み {clearedGrammarStages}/12</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Link to="/games/grammar-hunter" className="btn btn-primary" data-testid="launch-grammar-game">
              誤文ハンターへ挑む
            </Link>
          </div>
        </article>

        {/* 4. Pinyin Word Puzzle */}
        <article className="game-hub-card game-hub-accent-puzzle">
          <div className="row-between">
            <span className="badge badge-accent">ピンイン漢字変換・語順パズル</span>
            <Puzzle size={20} color="#d97706" />
          </div>
          <h3 style={{ margin: 0 }}>
            <span lang="zh-Hans">字序工坊</span> — Pinyin Word Forge
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            シャッフルされたピンイン語句に簡体字を入力し、D&D・クリック・キーボードで語順を組み立てる大学試験対応パズル（IME確定Enter干渉なし）。
          </p>
          <div className="row-wrap" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
            <span>全12ステージ ({wordPuzzleQuestions.length}問)</span>
            <span>・</span>
            <span>クリア済み {clearedPuzzleStages}/12</span>
            <span>・</span>
            <span>エンドレス最高 {gs.wordPuzzle.bestEndlessScore}点</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Link to="/games/word-puzzle" className="btn btn-primary" data-testid="launch-puzzle-game">
              パズル工房を開く
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
};
