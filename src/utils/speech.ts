/**
 * Web Speech API wrapper for Mandarin Chinese (zh-CN) playback with safe graceful fallback.
 */

export interface SpeechSupportInfo {
  supported: boolean;
  hasChineseVoice: boolean;
  voiceName: string | null;
  reason?: string;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  return window.speechSynthesis;
}

export function getChineseVoices(): SpeechSynthesisVoice[] {
  const synth = getSynth();
  if (!synth) return [];
  const voices = synth.getVoices();
  return voices.filter((v) =>
    /^zh(-|_)?(CN|Hans|SG|TW|HK)?/i.test(v.lang)
  );
}

export function pickPreferredChineseVoice(): SpeechSynthesisVoice | null {
  const voices = getChineseVoices();
  if (voices.length === 0) return null;
  return (
    voices.find((v) => /^zh(-|_)?CN$/i.test(v.lang)) ??
    voices.find((v) => /zh(-|_)?Hans/i.test(v.lang)) ??
    voices[0]
  );
}

export function detectSpeechSupport(): SpeechSupportInfo {
  const synth = getSynth();
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    return {
      supported: false,
      hasChineseVoice: false,
      voiceName: null,
      reason: 'お使いのブラウザは音声合成（Web Speech API）に対応していません。',
    };
  }
  const voices = synth.getVoices();
  const zhVoice = pickPreferredChineseVoice();
  // Note: some browsers load voices asynchronously; if voices.length === 0 we treat Web Speech as potentially available until voiceschanged fires,
  // unless voices ARE loaded and none are Chinese.
  if (voices.length > 0 && !zhVoice) {
    return {
      supported: false,
      hasChineseVoice: false,
      voiceName: null,
      reason: 'お使いの端末に中国語音声（zh-CN）がインストールされていないため、音声再生機能を無効化しています。',
    };
  }
  return {
    supported: true,
    hasChineseVoice: Boolean(zhVoice),
    voiceName: zhVoice?.name ?? null,
  };
}

export function stopSpeaking(): void {
  const synth = getSynth();
  if (synth) {
    synth.cancel();
  }
}

export function speakChinese(
  text: string,
  rate = 0.9,
  onEnd?: () => void,
  onError?: () => void
): boolean {
  const synth = getSynth();
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    onError?.();
    return false;
  }
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = Math.max(0.5, Math.min(1.5, rate));
  const voice = pickPreferredChineseVoice();
  if (voice) {
    utterance.voice = voice;
  }
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = () => onError();
  synth.speak(utterance);
  return true;
}
