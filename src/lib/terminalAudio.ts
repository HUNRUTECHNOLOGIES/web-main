let sharedAudioCtx: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return cachedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.25));
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

export type KeystrokeKind = 'type' | 'enter' | 'nav';

export function playTerminalKeystroke(kind: KeystrokeKind = 'type', enabled = true): void {
  if (!enabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;

    // 1. Subtle transient keycap click via band-passed micro noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(
      (kind === 'enter' ? 1450 : kind === 'nav' ? 1900 : 2200) * jitter,
      now
    );
    filter.Q.setValueAtTime(kind === 'enter' ? 1.8 : 2.6, now);

    const noiseGain = ctx.createGain();
    const peakNoise = kind === 'enter' ? 0.045 : kind === 'nav' ? 0.022 : 0.032;
    noiseGain.gain.setValueAtTime(peakNoise, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'enter' ? 0.03 : 0.018));

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.035);

    // 2. Subtle pitched body tick for tactile mechanical presence
    const osc = ctx.createOscillator();
    osc.type = kind === 'enter' ? 'triangle' : 'sine';
    const startFreq = (kind === 'enter' ? 420 : kind === 'nav' ? 760 : 620) * jitter;
    const endFreq = kind === 'enter' ? 150 : 280;
    const dur = kind === 'enter' ? 0.034 : 0.016;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(kind === 'enter' ? 0.035 : 0.016, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.004);
  } catch {
    // Gracefully ignore audio synthesis failures in restricted contexts
  }
}
