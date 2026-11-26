import type { RhythmSong } from '../types/rhythm';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type SfxKind =
  | 'click'
  | 'page'
  | 'chime'
  | 'rain-thunder'
  | 'camera'
  | 'perfect'
  | 'great'
  | 'good'
  | 'miss'
  | 'scan'
  | 'fix-ok'
  | 'fix-ng'
  | 'snap'
  | 'clear';

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private bgmTimer: number | null = null;
  private currentBgmKey: string | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private currentAmbientKey: string | null = null;

  private bgmVol = 0.45;
  private sfxVol = 0.65;
  private muted = false;

  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();

      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.ambientGain.connect(this.ctx.destination);
      this.applyVolumes();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  public setVolumes(bgm: number, sfx: number, muted: boolean): void {
    this.bgmVol = Math.max(0, Math.min(1, bgm));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.bgmGain || !this.sfxGain || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    const effectiveBgm = this.muted ? 0 : this.bgmVol;
    const effectiveSfx = this.muted ? 0 : this.sfxVol;
    this.bgmGain.gain.setTargetAtTime(effectiveBgm * 0.35, now, 0.04);
    this.ambientGain.gain.setTargetAtTime(effectiveBgm * 0.28, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(effectiveSfx * 0.5, now, 0.02);
  }

  public playToneAt(
    midi: number,
    startTime: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainLevel = 0.25,
    bus: 'bgm' | 'sfx' = 'bgm'
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain || !this.sfxGain) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(midiToFreq(midi), startTime);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(gainLevel, startTime + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(0.05, durationSec));

    osc.connect(env);
    env.connect(bus === 'bgm' ? this.bgmGain : this.sfxGain);

    osc.start(startTime);
    osc.stop(startTime + Math.max(0.06, durationSec) + 0.02);
  }

  public playKickAt(startTime: number, level = 0.45): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.14);
    env.gain.setValueAtTime(level, startTime);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);
    osc.connect(env);
    env.connect(this.bgmGain);
    osc.start(startTime);
    osc.stop(startTime + 0.18);
  }

  public playHatAt(startTime: number, level = 0.12): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;
    const bufSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(level, startTime);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.bgmGain);
    src.start(startTime);
  }

  public playSfx(kind: SfxKind): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    switch (kind) {
      case 'click':
        this.playToneAt(76, now, 0.06, 'triangle', 0.25, 'sfx');
        break;
      case 'page':
        this.playToneAt(72, now, 0.08, 'sine', 0.18, 'sfx');
        this.playToneAt(79, now + 0.04, 0.1, 'sine', 0.14, 'sfx');
        break;
      case 'chime':
        [72, 76, 79, 84].forEach((n, idx) =>
          this.playToneAt(n, now + idx * 0.07, 0.45, 'sine', 0.2, 'sfx')
        );
        break;
      case 'rain-thunder':
        this.playToneAt(38, now, 0.65, 'triangle', 0.35, 'sfx');
        this.playToneAt(33, now + 0.14, 0.8, 'sine', 0.3, 'sfx');
        break;
      case 'camera':
        this.playToneAt(88, now, 0.04, 'square', 0.15, 'sfx');
        this.playToneAt(64, now + 0.05, 0.06, 'triangle', 0.15, 'sfx');
        break;
      case 'perfect':
        this.playToneAt(84, now, 0.12, 'triangle', 0.3, 'sfx');
        this.playToneAt(91, now + 0.05, 0.16, 'sine', 0.26, 'sfx');
        break;
      case 'great':
        this.playToneAt(79, now, 0.12, 'triangle', 0.26, 'sfx');
        break;
      case 'good':
        this.playToneAt(74, now, 0.1, 'sine', 0.2, 'sfx');
        break;
      case 'miss':
        this.playToneAt(48, now, 0.16, 'sawtooth', 0.2, 'sfx');
        break;
      case 'scan':
        this.playToneAt(70, now, 0.07, 'sine', 0.2, 'sfx');
        this.playToneAt(77, now + 0.05, 0.09, 'sine', 0.2, 'sfx');
        break;
      case 'fix-ok':
        this.playToneAt(72, now, 0.1, 'triangle', 0.25, 'sfx');
        this.playToneAt(79, now + 0.06, 0.18, 'triangle', 0.26, 'sfx');
        break;
      case 'fix-ng':
        this.playToneAt(55, now, 0.12, 'sawtooth', 0.22, 'sfx');
        this.playToneAt(51, now + 0.09, 0.18, 'sawtooth', 0.2, 'sfx');
        break;
      case 'snap':
        this.playToneAt(69, now, 0.06, 'triangle', 0.22, 'sfx');
        break;
      case 'clear':
        [67, 71, 74, 79, 83].forEach((n, i) =>
          this.playToneAt(n, now + i * 0.08, 0.5, 'triangle', 0.24, 'sfx')
        );
        break;
    }
  }

  public startNovelBgm(track: 'title' | 'daily' | 'emotional' | 'ending' | 'none'): void {
    if (track === 'none') {
      this.stopBgm();
      return;
    }
    if (this.currentBgmKey === `novel:${track}`) return;
    this.stopBgm();
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.currentBgmKey = `novel:${track}`;

    const presets: Record<'title' | 'daily' | 'emotional' | 'ending', { tempoMs: number; chords: number[][]; melody: number[] }> = {
      title: {
        tempoMs: 520,
        chords: [[60, 67, 71], [57, 64, 69], [53, 60, 65], [55, 62, 67]],
        melody: [76, 79, 83, 79, 76, 74, 72, 74, 76, 79, 84, 83, 79, 76, 74, 72],
      },
      daily: {
        tempoMs: 420,
        chords: [[62, 69, 74], [59, 66, 71], [55, 62, 67], [57, 64, 69]],
        melody: [74, 78, 81, 78, 74, 76, 78, 81, 83, 81, 78, 76, 74, 73, 74, 76],
      },
      emotional: {
        tempoMs: 620,
        chords: [[57, 64, 69], [53, 60, 65], [60, 67, 72], [55, 62, 67]],
        melody: [72, 76, 79, 76, 74, 72, 69, 72, 74, 76, 81, 79, 76, 74, 72, 71],
      },
      ending: {
        tempoMs: 480,
        chords: [[60, 67, 72], [59, 66, 71], [57, 64, 69], [55, 62, 67]],
        melody: [79, 83, 84, 83, 79, 76, 79, 84, 86, 84, 83, 79, 76, 79, 81, 84],
      },
    };

    const p = presets[track];
    let step = 0;
    const tick = () => {
      if (this.currentBgmKey !== `novel:${track}` || !this.ctx) return;
      const now = this.ctx.currentTime + 0.03;
      const chord = p.chords[Math.floor(step / 4) % p.chords.length];
      if (step % 4 === 0) {
        for (const n of chord) {
          this.playToneAt(n, now, (p.tempoMs * 3.8) / 1000, 'sine', 0.12, 'bgm');
        }
      }
      const mel = p.melody[step % p.melody.length];
      this.playToneAt(mel, now, (p.tempoMs * 1.4) / 1000, 'triangle', 0.14, 'bgm');
      step++;
    };
    tick();
    this.bgmTimer = window.setInterval(tick, p.tempoMs);
  }

  public startAmbient(kind: 'rain' | 'night' | 'none'): void {
    if (kind === 'none') {
      this.stopAmbient();
      return;
    }
    if (this.currentAmbientKey === kind) return;
    this.stopAmbient();
    const ctx = this.ensureContext();
    if (!ctx || !this.ambientGain) return;
    this.currentAmbientKey = kind;

    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = kind === 'rain' ? white * 0.22 + lastOut * 1.5 : lastOut * 1.1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = kind === 'rain' ? 1400 : 420;
    filter.Q.value = kind === 'rain' ? 0.6 : 1.2;

    src.connect(filter);
    filter.connect(this.ambientGain);
    src.start();
    this.ambientSource = src;
  }

  public stopAmbient(): void {
    this.currentAmbientKey = null;
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        // ignore
      }
      this.ambientSource = null;
    }
  }

  /**
   * Schedule an entire rhythm song tightly synced to AudioContext.currentTime.
   * Returns exact audio start time (sec) so Canvas notes align frame-independently.
   */
  public startRhythmSong(song: RhythmSong): number {
    this.stopBgm();
    this.stopAmbient();
    const ctx = this.ensureContext();
    const beatSec = 60 / song.bpm;
    if (!ctx) {
      return performance.now() / 1000 + 0.1;
    }
    const startSec = ctx.currentTime + 0.15;
    this.currentBgmKey = `rhythm:${song.id}`;

    const totalBeats = Math.ceil(song.durationSec / beatSec);
    let scheduledUpTo = 0;

    const scheduleChunk = () => {
      if (this.currentBgmKey !== `rhythm:${song.id}` || !this.ctx) return;
      const horizonSec = this.ctx.currentTime - startSec + 1.5;
      const targetBeat = Math.min(totalBeats, Math.ceil(horizonSec / beatSec));

      while (scheduledUpTo < targetBeat) {
        const b = scheduledUpTo;
        const t = startSec + b * beatSec;
        const barIdx = Math.floor(b / 4) % song.chordProgression.length;
        const chord = song.chordProgression[barIdx];

        if (b % 2 === 0) {
          this.playKickAt(t, 0.35);
          this.playToneAt(chord[0] - 12, t, beatSec * 1.6, 'triangle', 0.22, 'bgm');
        }
        if (b % 2 === 1) {
          this.playHatAt(t, 0.15);
        }
        this.playHatAt(t + beatSec * 0.5, 0.08);

        if (b % 4 === 0) {
          for (const n of chord) {
            this.playToneAt(n, t, beatSec * 3.5, 'sine', 0.11, 'bgm');
          }
        }

        const melNote = song.scaleNotes[(b * 3 + barIdx) % song.scaleNotes.length];
        this.playToneAt(melNote, t, beatSec * 0.85, 'triangle', 0.16, 'bgm');
        if (song.bpm >= 125) {
          const arp = song.scaleNotes[(b * 5 + 2) % song.scaleNotes.length];
          this.playToneAt(arp, t + beatSec * 0.5, beatSec * 0.4, 'sine', 0.1, 'bgm');
        }
        scheduledUpTo++;
      }
    };

    scheduleChunk();
    this.bgmTimer = window.setInterval(scheduleChunk, 250);
    return startSec;
  }

  public stopBgm(): void {
    this.currentBgmKey = null;
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  public stopAll(): void {
    this.stopBgm();
    this.stopAmbient();
  }
}

export const gameAudio = new GameAudioEngine();
