// Audio synthesizer using Web Audio API for tactical military audio effects

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private ambientWindSource: AudioBufferSourceNode | null = null;
  private heartbeatInterval: number | null = null;

  // Volume levels (0 to 1)
  private masterVol: number = 0.8;
  private sfxVol: number = 0.85;
  private ambientVol: number = 0.7;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  public initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVol;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.ambientVol;
      this.ambientGain.connect(this.masterGain);

      this.startAmbientCompoundWind();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(master: number, sfx: number, ambient: number) {
    this.masterVol = Math.max(0, Math.min(1, master / 100));
    this.sfxVol = Math.max(0, Math.min(1, sfx / 100));
    this.ambientVol = Math.max(0, Math.min(1, ambient / 100));

    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVol;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVol;
    }
    if (this.ambientGain) {
      this.ambientGain.gain.value = this.ambientVol;
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVol;
    }
    return this.isMuted;
  }

  public getIsMuted() {
    return this.isMuted;
  }

  // --- AMBIENT SOUNDS ---

  private startAmbientCompoundWind() {
    if (!this.ctx || !this.ambientGain || this.ambientWindSource) return;

    // Synthesize looping wind noise
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    // Pink / brown filtered noise for distant wind
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const wind = this.ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;

    wind.connect(filter);
    filter.connect(this.ambientGain);
    wind.start();
    this.ambientWindSource = wind;
  }

  // --- WEAPON SOUNDS ---

  public playAk74mShot() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    // 1. Heavy low punch transient
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

    oscGain.gain.setValueAtTime(1.0, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.16);

    // 2. High-energy explosion noise
    const bufferSize = this.ctx.sampleRate * 0.25;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3500, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(800, t + 0.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.25);

    // 3. Ejected shell casing bounce
    setTimeout(() => this.playCasingTinkle(), 180);
  }

  public playSilencedShot() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.08;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.08);

    setTimeout(() => this.playCasingTinkle(), 150);
  }

  public playSniperShot() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.25);

    oscGain.gain.setValueAtTime(1.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.36);

    const bufferSize = this.ctx.sampleRate * 0.6;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(5000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.5);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.6);

    setTimeout(() => this.playCasingTinkle(), 240);
  }

  public playKnifeSlash() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.12);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playCasingTinkle() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200 + Math.random() * 800, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.05);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  public playReload() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    this.playClick(t, 600, 0.05, 0.3);
    this.playClick(t + 0.8, 450, 0.06, 0.4);
    this.playClick(t + 1.4, 800, 0.08, 0.5);
  }

  public playDryFire() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playClick(this.ctx.currentTime, 1200, 0.03, 0.4);
  }

  private playClick(time: number, freq: number, duration: number, vol: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, time + duration);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(time);
    osc.stop(time + duration);
  }

  // --- IMPACT & VFX SOUNDS ---

  public playHitMarker() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.setValueAtTime(1600, t + 0.03);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playFleshHit() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  public playMetalRicochet() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400 + Math.random() * 800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.18);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playExplosion() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.6);

    gain.gain.setValueAtTime(1.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  // --- FOOTSTEPS & MOVEMENT ---

  public playFootstep(isSprinting: boolean = false, isCrouching: boolean = false) {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    if (isCrouching) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isSprinting ? 800 : 500, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isSprinting ? 0.35 : 0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.05);
  }

  // --- BASE ALARM & SIREN ---

  public startBaseSiren() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.sirenOsc || this.isMuted) return;

    const t = this.ctx.currentTime;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();

    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.setValueAtTime(450, t);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(0.7, t);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(250, t);

    lfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);

    this.sirenGain.gain.setValueAtTime(0.2, t);

    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxGain);

    this.sirenOsc.start(t);
    lfo.start(t);
  }

  public stopBaseSiren() {
    if (this.sirenGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.sirenGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      setTimeout(() => {
        if (this.sirenOsc) {
          try { this.sirenOsc.stop(); } catch { /* ignore */ }
          this.sirenOsc = null;
        }
      }, 550);
    }
  }

  // --- TACTICAL GEAR SOUNDS ---

  public playNightVisionToggle(enabled: boolean) {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(enabled ? 1600 : 3200, t);
    osc.frequency.exponentialRampToValueAtTime(enabled ? 3200 : 1600, t + 0.12);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playBinocularsZoom() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playClick(this.ctx.currentTime, 1800, 0.04, 0.2);
  }

  public playKeycardAccepted() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    this.playClick(t, 800, 0.05, 0.3);
    this.playClick(t + 0.1, 1200, 0.08, 0.4);
  }

  public playGuardVoice(type: 'spotted' | 'investigate' | 'death') {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    this.playClick(t, 2200, 0.04, 0.15);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    if (type === 'spotted') {
      osc.frequency.setValueAtTime(320, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.25);
      gain.gain.setValueAtTime(0.35, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    } else if (type === 'investigate') {
      osc.frequency.setValueAtTime(280, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.2);
      gain.gain.setValueAtTime(0.25, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    } else {
      osc.frequency.setValueAtTime(220, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.3);
      gain.gain.setValueAtTime(0.4, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    }

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1100;
    bandpass.Q.value = 4.0;

    osc.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t + 0.05);
    osc.stop(t + 0.36);
  }

  public playPickup() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587, t);
    osc.frequency.setValueAtTime(880, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  public playObjectiveCompleted() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);

      gain.gain.setValueAtTime(0.25, t + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.42);
    });
  }

  public playHackSound() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      this.playClick(t + i * 0.09, 1400 + Math.random() * 600, 0.04, 0.2);
    }
  }

  public playUiClick() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    this.playClick(t, 1800, 0.015, 0.15);
  }

  public playMissionSelect() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    this.playClick(t, 900, 0.02, 0.25);
    this.playClick(t + 0.04, 1300, 0.03, 0.2);
  }

  public playGeneratorSabotage() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    // Low frequency electrical shutdown hum
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.85);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.9);
  }

  public playHelicopterExtraction() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 12; i++) {
      this.playClick(t + i * 0.1, 140 + Math.sin(i) * 20, 0.06, 0.35);
    }
  }

  public updateLowHealthHeartbeat(isLow: boolean) {
    if (isLow && !this.heartbeatInterval) {
      this.heartbeatInterval = window.setInterval(() => {
        this.playHeartbeat();
      }, 900);
    } else if (!isLow && this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private playHeartbeat() {
    this.initCtx();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

export const soundManager = new SoundManager();
