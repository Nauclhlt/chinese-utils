import React from 'react';
import { Volume2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseSyllable, splitPinyinSyllables } from '../utils/pinyin';
import { speakChinese } from '../utils/speech';

export const ColoredPinyin: React.FC<{ pinyin: string; toneColors?: boolean }> = ({
  pinyin,
  toneColors = true,
}) => {
  if (!toneColors) {
    return <span className="pinyin-text">{pinyin}</span>;
  }
  const tokens = pinyin.split(/(\s+)/);
  return (
    <span className="pinyin-text">
      {tokens.map((tok, idx) => {
        if (/^\s+$/.test(tok)) return <React.Fragment key={idx}>{tok}</React.Fragment>;
        const syls = splitPinyinSyllables(tok);
        if (syls.length <= 1) {
          const parsed = parseSyllable(tok);
          return (
            <span key={idx} className={`tone-${parsed.tone}`}>
              {tok}
            </span>
          );
        }
        return (
          <span key={idx}>
            {syls.map((s, sIdx) => {
              const parsed = parseSyllable(s);
              return (
                <span key={sIdx} className={`tone-${parsed.tone}`}>
                  {s}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
};

interface SpeakButtonProps {
  text: string;
  size?: 'sm' | 'md';
  label?: string;
}

export const SpeakButton: React.FC<SpeakButtonProps> = ({ text, size = 'sm', label }) => {
  const { userState, speechSupport } = useApp();
  const disabled = !speechSupport.supported;

  return (
    <button
      type="button"
      className={`btn ${size === 'sm' ? 'btn-sm' : ''} no-print`}
      disabled={disabled}
      title={disabled ? speechSupport.reason : '中国語音声を読み上げ'}
      aria-label={`${text} を読み上げ`}
      onClick={(e) => {
        e.stopPropagation();
        speakChinese(text, userState.settings.speechRate);
      }}
    >
      <Volume2 size={14} />
      {label && <span>{label}</span>}
    </button>
  );
};

interface ChineseExampleCardProps {
  hanzi: string;
  pinyin: string;
  ja: string;
  note?: string;
  large?: boolean;
}

export const ChineseSentenceBlock: React.FC<ChineseExampleCardProps> = ({
  hanzi,
  pinyin,
  ja,
  note,
  large = false,
}) => {
  const { userState } = useApp();
  const { showPinyin, toneColors } = userState.settings;

  return (
    <div className="stack-sm">
      <div className="row-between">
        <span lang="zh-Hans" className={large ? 'zh-lg' : 'zh-md'}>
          {hanzi}
        </span>
        <SpeakButton text={hanzi} />
      </div>
      {showPinyin && <ColoredPinyin pinyin={pinyin} toneColors={toneColors} />}
      <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>{ja}</div>
      {note && <div style={{ color: 'var(--text-light)', fontSize: '0.82rem' }}>{note}</div>}
    </div>
  );
};
