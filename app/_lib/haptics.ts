import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// ── Haptics ──────────────────────────────────────────────────

export async function hapticLight() {
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
}

export async function hapticMedium() {
  try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
}

export async function hapticSuccess() {
  try { await Haptics.notification({ type: NotificationType.Success }); } catch {}
}

export async function hapticError() {
  try { await Haptics.notification({ type: NotificationType.Error }); } catch {}
}

// ── Web Audio sound effects ──────────────────────────────────

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gainPeak = 0.18
) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ac.currentTime);
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(gainPeak, ac.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

// Soft UI click
export function soundClick() {
  playTone(600, 0.06, "sine", 0.12);
}

// Positive confirm / success
export function soundSuccess() {
  playTone(523, 0.07, "sine", 0.14);
  setTimeout(() => playTone(784, 0.12, "sine", 0.14), 80);
}

// Error / warning
export function soundError() {
  playTone(220, 0.18, "sawtooth", 0.1);
}

// Soft pop (toggle on)
export function soundToggleOn() {
  playTone(440, 0.05, "sine", 0.1);
  setTimeout(() => playTone(660, 0.08, "sine", 0.1), 50);
}

// Soft pop (toggle off)
export function soundToggleOff() {
  playTone(660, 0.05, "sine", 0.1);
  setTimeout(() => playTone(440, 0.08, "sine", 0.08), 50);
}

// Whoosh for bottom sheet open
export function soundSheetOpen() {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.15);
  gain.gain.setValueAtTime(0.1, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.15);
}

// Friend added / request sent
export function soundFriendAdded() {
  playTone(523, 0.07, "sine", 0.12);
  setTimeout(() => playTone(659, 0.07, "sine", 0.12), 90);
  setTimeout(() => playTone(784, 0.15, "sine", 0.14), 180);
}

// App launch mnemonic — warm 4-note rising chime
export function soundAppLaunch() {
  const ac = getCtx();
  if (!ac) return;

  // Notes: E4 → G4 → B4 → E5 (a warm, friendly E major arpeggio)
  const notes = [329.63, 392.00, 493.88, 659.25];
  const timings = [0, 0.13, 0.26, 0.42];
  const durations = [0.25, 0.25, 0.25, 0.55];
  const gains = [0.13, 0.13, 0.14, 0.18];

  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    // Add a tiny bit of warmth with a second osc an octave up at low volume
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(ac.destination);
    gain2.connect(ac.destination);

    osc.type = "sine";
    osc2.type = "sine";
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    osc2.frequency.setValueAtTime(freq * 2, ac.currentTime);

    const t = ac.currentTime + timings[i];
    const dur = durations[i];

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gains[i], t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(gains[i] * 0.25, t + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.start(t);
    osc.stop(t + dur);
    osc2.start(t);
    osc2.stop(t + dur);
  });
}

// Combined helpers (haptic + sound together)
export function feedbackClick() { hapticLight(); soundClick(); }
export function feedbackSuccess() { hapticSuccess(); soundSuccess(); }
export function feedbackError() { hapticError(); soundError(); }
export function feedbackToggleOn() { hapticLight(); soundToggleOn(); }
export function feedbackToggleOff() { hapticLight(); soundToggleOff(); }
export function feedbackSheetOpen() { hapticLight(); soundSheetOpen(); }
export function feedbackFriendAdded() { hapticSuccess(); soundFriendAdded(); }
