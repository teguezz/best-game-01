// All of EMBERLIGHT's sound is synthesised with WebAudio — no audio files. Short oscillator
// voices make the effects (a cast's chirp, a pickup's rising ding, the low thud of a hurt
// flame), and a lookahead scheduler walks a slow pentatonic pattern over a soft pad for the
// night music. The context is created only when the player first gestures (unlock), so staged
// screenshot scenes and probes stay silent. M toggles a master mute.

const PENTA = [0, 3, 5, 7, 10, 12, 15];
const BASE_HZ = 196; // G3

export class SoundKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.nextNoteAt = 0;
    this.step = 0;
  }

  /** Create the context on the first user gesture; safe to call again. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** One short voice: an oscillator with an exponential decay envelope. */
  tone({ freq = 440, slide = 0, type = 'sine', dur = 0.15, vol = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A breath of filtered noise, for deaths and big hits. */
  noise({ dur = 0.2, vol = 0.15, delay = 0, freq = 900 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t0);
  }

  shoot() { this.tone({ freq: 720, slide: 260, type: 'triangle', dur: 0.07, vol: 0.05 }); }
  hit() { this.tone({ freq: 300, slide: -80, type: 'square', dur: 0.04, vol: 0.03 }); }
  die() { this.noise({ dur: 0.14, vol: 0.1, freq: 1400 }); this.tone({ freq: 210, slide: -120, type: 'triangle', dur: 0.12, vol: 0.07 }); }
  pickup() { this.tone({ freq: 880, slide: 340, type: 'sine', dur: 0.09, vol: 0.06 }); }
  levelUp() {
    [523, 659, 784, 1046].forEach((freq, i) => this.tone({ freq, type: 'triangle', dur: 0.16, vol: 0.1, delay: i * 0.07 }));
  }
  hurt() { this.tone({ freq: 130, slide: -50, type: 'sawtooth', dur: 0.18, vol: 0.14 }); this.noise({ dur: 0.1, vol: 0.08, freq: 500 }); }
  bossWarn() {
    this.tone({ freq: 98, type: 'sawtooth', dur: 0.5, vol: 0.12 });
    this.tone({ freq: 104, type: 'sawtooth', dur: 0.5, vol: 0.12, delay: 0.05 });
  }
  bossDie() { this.noise({ dur: 0.5, vol: 0.2, freq: 900 }); this.tone({ freq: 160, slide: -100, type: 'triangle', dur: 0.5, vol: 0.14 }); }
  dawn() { [392, 523, 659, 784, 1046].forEach((freq, i) => this.tone({ freq, type: 'sine', dur: 0.3, vol: 0.09, delay: i * 0.11 })); }
  over() { [330, 262, 196, 147].forEach((freq, i) => this.tone({ freq, type: 'triangle', dur: 0.3, vol: 0.1, delay: i * 0.16 })); }
  choose() { this.tone({ freq: 660, slide: 120, type: 'triangle', dur: 0.1, vol: 0.08 }); }
  dash() { this.noise({ dur: 0.16, vol: 0.07, freq: 2400 }); this.tone({ freq: 340, slide: 420, type: 'sine', dur: 0.14, vol: 0.05 }); }
  gust() { this.noise({ dur: 0.7, vol: 0.1, freq: 700 }); this.tone({ freq: 880, slide: -300, type: 'sine', dur: 0.5, vol: 0.04 }); }

  /** Start the gentle night pattern; it schedules itself a few notes ahead. */
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 120);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  scheduleMusic() {
    if (!this.ctx) return;
    while (this.nextNoteAt < this.ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextNoteAt);
      this.nextNoteAt += 0.42;
      this.step += 1;
    }
  }

  playStep(step, at) {
    if (this.muted) return;
    const delay = Math.max(0, at - this.ctx.currentTime);
    // A slow plucked melody that wanders the pentatonic ladder, deterministic per step so the
    // night always hums the same tune.
    const wander = [0, 2, 4, 3, 5, 4, 2, 1, 3, 4, 6, 5, 4, 2, 1, 0][step % 16];
    if (step % 2 === 0) {
      const semis = PENTA[wander % PENTA.length] + 12;
      this.tone({ freq: BASE_HZ * Math.pow(2, semis / 12), type: 'sine', dur: 0.5, vol: 0.045, delay });
    }
    if (step % 16 === 0) {
      // A soft pad chord at the top of each phrase.
      [0, 3, 7].forEach((semi) => {
        this.tone({ freq: BASE_HZ * Math.pow(2, semi / 12), type: 'triangle', dur: 3.2, vol: 0.02, delay });
      });
    }
    if (step % 8 === 4) this.tone({ freq: BASE_HZ / 2, type: 'sine', dur: 1.4, vol: 0.05, delay });
  }
}
