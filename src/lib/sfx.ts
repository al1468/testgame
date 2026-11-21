import { storage } from './storage';

/** 외부 음원 없이 WebAudio로 합성하는 효과음 */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = storage.isMuted();

  /** 사용자 입력 직후 호출해야 브라우저가 소리를 허용한다 */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    storage.setMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, from: number, to: number, q = 1) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  telegraph() {
    this.tone(880, 0.08, 'square', 0.12);
  }
  whoosh() {
    this.noise(0.25, 0.6, 2400, 500, 0.8);
  }
  perfect() {
    this.whoosh();
    this.tone(1320, 0.35, 'sine', 0.25);
    this.tone(1980, 0.4, 'sine', 0.15, undefined, 0.05);
  }
  hit() {
    this.tone(160, 0.25, 'square', 0.35, 50);
    this.noise(0.15, 0.6, 900, 200, 0.6);
  }
  whiff() {
    this.tone(220, 0.12, 'triangle', 0.2, 140);
  }
  charge() {
    this.tone(220, 0.7, 'sawtooth', 0.12, 880);
    this.tone(440, 0.7, 'sine', 0.15, 1760);
  }
  counter() {
    this.tone(90, 0.5, 'square', 0.45, 30);
    this.noise(0.4, 0.8, 1500, 100, 0.5);
  }
  defeat() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, undefined, i * 0.09));
  }
  blast() {
    this.tone(600, 0.3, 'sawtooth', 0.12, 1200);
  }
  click() {
    this.tone(660, 0.05, 'square', 0.1);
  }
}

export const sfx = new Sfx();
