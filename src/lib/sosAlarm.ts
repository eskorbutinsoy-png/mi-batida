let lastSosAlarmAt = 0;
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

export async function unlockSosAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'running') return;
  try {
    await ctx.resume();
  } catch {
    /* ignore */
  }
}

export function playSosAlarm() {
  const now = Date.now();
  // Evita solapados si llegan multiples SOS casi a la vez.
  if (now - lastSosAlarmAt < 2500) return;
  lastSosAlarmAt = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) {
      if (navigator.vibrate) navigator.vibrate([180, 120, 180, 120, 180, 120, 180]);
      return;
    }

    void ctx.resume().catch(() => undefined);
    const startAt = ctx.currentTime + 0.02;
    const totalDuration = 3.0;

    // Patron de triplete: bep-bep-bep, pequena pausa, y repetir hasta 3s.
    const shortBeep = 0.09;
    const intraGap = 0.07;
    const groupPause = 0.28;
    const groupDuration = (shortBeep * 3) + (intraGap * 2) + groupPause;
    const stopAt = startAt + totalDuration;

    for (let groupStart = startAt; groupStart < stopAt; groupStart += groupDuration) {

      for (let j = 0; j < 3; j += 1) {
        const t0 = groupStart + (j * (shortBeep + intraGap));
        if (t0 >= stopAt) break;
        const effectiveBeep = Math.min(shortBeep, stopAt - t0);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(j === 1 ? 920 : 1040, t0);

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + effectiveBeep);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + effectiveBeep + 0.01);
      }
    }

    // Refuerzo haptico en moviles compatibles.
    if (navigator.vibrate) navigator.vibrate([90, 70, 90, 70, 90, 280, 90, 70, 90, 70, 90, 280, 90, 70, 90, 70, 90]);
  } catch {
    if (navigator.vibrate) navigator.vibrate([90, 70, 90, 70, 90, 280, 90, 70, 90, 70, 90, 280, 90, 70, 90, 70, 90]);
  }
}
