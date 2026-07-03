/* WebAudio-Synth für UI-Sounds — keine Assets, nie funktionskritisch.
   AudioContext lazy (Browser erlaubt Audio erst nach User-Geste). */
const KEY = "pp:muted";
let ctx;

export function isMuted() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function toggleMute() {
  const m = !isMuted();
  try { m ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch { /* egal */ }
  return m;
}

function tone(freq, dur, delay = 0, type = "sine", gain = 0.15) {
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur);
}

export function play(name) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    switch (name) {
      case "click": tone(880, 0.05); break;
      case "ok":    tone(660, 0.08); tone(880, 0.12, 0.07); break;
      case "err":   tone(160, 0.2, 0, "square", 0.12); break;
      case "tick":  tone(1200, 0.03, 0, "sine", 0.08); break;
      case "win":   tone(523, 0.12); tone(659, 0.12, 0.11); tone(784, 0.22, 0.22); break;
      case "lose":  tone(392, 0.15); tone(330, 0.28, 0.14); break;
    }
  } catch { /* Sound nie kritisch */ }
}
