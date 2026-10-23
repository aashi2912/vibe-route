import { useState, useEffect } from "react";

/**
 * First-run welcome overlay.
 *
 * Shows once (remembered in localStorage) to tell a first-time visitor what
 * Vibe Route is and offer the fastest path to the "aha" — a sample walk —
 * before they commit to typing two addresses. Dismissible; never blocks.
 */
const SEEN_KEY = "vr_seen_welcome_v1";

function hasSeen() {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode — fine */ }
}

export default function WelcomeOverlay({ isNight, onTrySample }) {
  const [open, setOpen] = useState(false);

  useEffect(() => { if (!hasSeen()) setOpen(true); }, []);

  function close() { markSeen(); setOpen(false); }
  function sample() { markSeen(); setOpen(false); onTrySample?.(); }

  if (!open) return null;

  const panel = isNight ? "bg-night-card text-night-text" : "bg-white text-earth-800";
  const sub = isNight ? "text-night-muted" : "text-earth-500";

  const steps = [
    { icon: "📍", t: "Set two points", d: "Where you're starting and where you're headed." },
    { icon: "🌳", t: "Pick what matters", d: "Green, coffee, local character, well-lit — up to three." },
    { icon: "🧭", t: "Compare real routes", d: "Each one scored on your signals, with a short why." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(20,27,34,0.45)", backdropFilter: "blur(2px)" }}
      onClick={close} role="dialog" aria-modal="true" aria-label="Welcome to Vibe Route">
      <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${panel}`} onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🚶</div>
          <h2 className="font-display text-2xl leading-tight">Walk the way that feels right</h2>
          <p className={`text-sm font-body mt-2 ${sub}`}>
            Google Maps gives you the fastest route. Vibe Route compares walks by how they <em>feel</em>.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {steps.map((s) => (
            <div key={s.t} className="flex items-start gap-3">
              <span className={`text-lg w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isNight ? "bg-night-bg" : "bg-earth-100"}`}>{s.icon}</span>
              <div>
                <p className="text-sm font-semibold font-body leading-tight">{s.t}</p>
                <p className={`text-xs font-body mt-0.5 ${sub}`}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={sample}
          className="w-full py-3.5 rounded-xl bg-vibe-green text-white text-[15px] font-bold font-body shadow-cta btn-press">
          ✨ Try a sample walk
        </button>
        <button onClick={close}
          className={`w-full py-3 mt-2 rounded-xl text-sm font-semibold font-body btn-press ${sub}`}>
          I'll plan my own
        </button>

        <p className={`text-[11px] text-center mt-4 font-body ${isNight ? "text-night-muted/60" : "text-earth-300"}`}>
          Nothing to sign up for. Your locations stay in your browser.
        </p>
      </div>
    </div>
  );
}
