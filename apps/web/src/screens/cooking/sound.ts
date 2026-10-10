/** Beeps of a finished timer: three short tones, generated (no audio file in the bundle). */
const BEEPS = 3;
const BEEP_SECONDS = 0.25;
const BEEP_GAP_SECONDS = 0.15;
const BEEP_HZ = 880;

let context: AudioContext | undefined;

/**
 * Creates or resumes the audio context. Call it from a tap (starting a timer): iOS and Chrome
 * only let a page play sound after a user gesture unlocked the context.
 */
export function primeSound(): void {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = undefined;
  }
}

/** Plays the timer signal; silent if the browser has no Web Audio. */
export function playAlarm(): void {
  primeSound();
  if (!context) return;
  const start = context.currentTime;
  for (let index = 0; index < BEEPS; index += 1) {
    const at = start + index * (BEEP_SECONDS + BEEP_GAP_SECONDS);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = BEEP_HZ;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + BEEP_SECONDS);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + BEEP_SECONDS);
  }
}
