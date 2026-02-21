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

// Combined helpers (haptic + sound together)
export function feedbackClick() { hapticLight(); soundClick(); }
export function feedbackSuccess() { hapticSuccess(); soundSuccess(); }
export function feedbackError() { hapticError(); soundError(); }
export function feedbackToggleOn() { hapticLight(); soundToggleOn(); }
export function feedbackToggleOff() { hapticLight(); soundToggleOff(); }
export function feedbackSheetOpen() { hapticLight(); soundSheetOpen(); }
export function feedbackFriendAdded() { hapticSuccess(); soundFriendAdded(); }
