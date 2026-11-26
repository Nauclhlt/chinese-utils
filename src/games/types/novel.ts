export interface NovelTokenInfo {
  word: string;
  pinyin: string;
  pos: string;
  meaningJa: string;
  contextualNote: string;
  source: 'textbook-scope' | 'novel-extra';
  lessonId?: string;
}

export interface NovelGrammarNote {
  pattern: string;
  title: string;
  explanation: string;
  isColloquial?: boolean;
}

export interface NovelChoice {
  id: string;
  labelZh: string;
  labelJa: string;
  nextLineId: string;
  setFlags?: Record<string, string | number | boolean>;
  addNumbers?: Record<string, number>;
}

export interface NovelCharacterPlacement {
  characterId: 'wanxing' | 'zhixia' | 'cheng';
  expression: string;
  position: 'left' | 'center' | 'right';
}

export interface NovelLine {
  id: string;
  chapterId: string;
  speaker: string; // "" for narration
  speakerId?: 'wanxing' | 'zhixia' | 'cheng' | 'narrator';
  textZh: string;
  pinyin: string;
  textJa: string;
  background?: string;
  cg?: string | null;
  characters?: NovelCharacterPlacement[];
  bgm?: 'title' | 'daily' | 'emotional' | 'ending' | 'none';
  ambient?: 'rain' | 'night' | 'none';
  sfx?: 'chime' | 'page' | 'rain-thunder' | 'camera' | 'none';
  transition?: 'fade' | 'flash' | 'none';
  tokens: NovelTokenInfo[];
  grammarNotes?: NovelGrammarNote[];
  choices?: NovelChoice[];
  nextLineId?: string | null;
  branchCheck?: {
    flag: string;
    gte?: number;
    eq?: string | number | boolean;
    trueNextLineId: string;
    falseNextLineId: string;
  };
  unlockCg?: string;
  unlockEnding?: string;
}

export interface NovelChapterQuizItem {
  id: string;
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
}

export interface NovelChapterData {
  id: string;
  number: number;
  titleZh: string;
  titleJa: string;
  synopsis: string;
  startLineId: string;
  lines: NovelLine[];
  reviewQuiz: NovelChapterQuizItem[];
}

export interface NovelMeta {
  titleZh: string;
  titleJa: string;
  subtitle: string;
  titleImage: string;
  backgrounds: Record<string, string>;
  characters: Record<string, Record<string, string>>;
  cgs: {
    id: string;
    title: string;
    image: string;
    description: string;
  }[];
  endings: {
    id: string;
    titleZh: string;
    titleJa: string;
    description: string;
  }[];
}
