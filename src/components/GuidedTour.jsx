import { useState, useEffect, useLayoutEffect, useCallback } from "react";

/**
 * GuidedTour — a real show-don't-tell walkthrough.
 *
 * Spotlights each actual UI element in turn (by its data-tour attribute),
 * dims the rest, and anchors a coach-mark bubble beside it. This replaces the
 * single "here's what this is" dialog: the user sees WHERE each control is and
 * what it does, stepping through the real screen.
 *
 * Remembered in localStorage so it runs once. Fully dismissible.
 */
const SEEN_KEY = "vr_seen_tour_v1";

const STEPS = [
  { sel: '[data-tour="origin"]', title: "Start here", body: "Type where your walk begins — or tap 📍 Me to use your location.", place: "below" },
  { sel: '[data-tour="destination"]', title: "…and where you're headed", body: "Your destination. We'll compare real walking routes between the two.", place: "below" },
  { sel: '[data-tour="vibes"]', title: "Pick what matters", body: "Choose up to 3 signals. Each route gets scored on these, so a 'green' walk really is the greener one.", place: "below" },
  { sel: '[data-tour="nl"]', title: "Or just describe it", body: 'Prefer words? Type something like "a quiet walk with a coffee stop" and the AI picks the signals for you.', place: "above" },
  { sel: '[data-tour="find"]', title: "See your routes", body: "Hit this to compare routes, ranked by your vibes — each with a short why.", place: "above" },
];

function markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode */ } }
export function hasSeenTour() { try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } }

export default function GuidedTour({ isNight, open, onClose, onFinishSample }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  const step = STEPS[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.sel);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => { if (open) measure(); }, [open, i, measure]);
  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [open, measure]);

  if (!open) return null;

  function finish(sample) { markSeen(); onClose?.(); if (sample) onFinishSample?.(); }
  const last = i === STEPS.length - 1;

  const pad = 8;
  const hole = rect ? {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  } : null;

  // Bubble position: below or above the highlighted element.
  const bubbleStyle = (() => {
    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    const vw = window.innerWidth;
    const belowTop = rect.top + rect.height + pad + 12;
    const aboveTop = rect.top - pad - 12;
    const left = Math.min(Math.max(16, rect.left), vw - 16 - 300);
    if (step.place === "above") return { top: aboveTop, left, transform: "translateY(-100%)" };
    return { top: belowTop, left };
  })();

  const panel = isNight ? "bg-night-card text-night-text" : "bg-white text-earth-800";
  const sub = isNight ? "text-night-muted" : "text-earth-500";

  return (
    <div className="fixed inset-0 z-50" aria-label="Guided tour" role="dialog">
      {/* Dim with a spotlight hole via 4 panels around the target (keeps the real element visible + bright) */}
      {hole ? (
        <>
          <div className="fixed left-0 right-0" style={{ top: 0, height: Math.max(0, hole.top), background: "rgba(20,27,34,0.62)" }} onClick={() => finish(false)} />
          <div className="fixed left-0" style={{ top: hole.top, height: hole.height, width: Math.max(0, hole.left), background: "rgba(20,27,34,0.62)" }} onClick={() => finish(false)} />
          <div className="fixed right-0" style={{ top: hole.top, height: hole.height, left: hole.left + hole.width, background: "rgba(20,27,34,0.62)" }} onClick={() => finish(false)} />
          <div className="fixed left-0 right-0 bottom-0" style={{ top: hole.top + hole.height, background: "rgba(20,27,34,0.62)" }} onClick={() => finish(false)} />
          {/* ring around the spotlighted element */}
          <div className="fixed pointer-events-none rounded-2xl" style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height, boxShadow: "0 0 0 2px #2f6b4e, 0 0 0 9999px rgba(0,0,0,0)" }} />
        </>
      ) : (
        <div className="fixed inset-0" style={{ background: "rgba(20,27,34,0.62)" }} onClick={() => finish(false)} />
      )}

      {/* Coach-mark bubble */}
      <div className={`fixed w-[300px] max-w-[calc(100vw-32px)] rounded-2xl p-4 shadow-2xl ${panel}`} style={bubbleStyle}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[11px] font-body ${sub}`}>Step {i + 1} of {STEPS.length}</span>
          <button onClick={() => finish(false)} className={`text-[12px] font-body ${sub}`}>Skip</button>
        </div>
        <p className="font-display text-lg leading-tight mb-1">{step.title}</p>
        <p className={`text-[13px] font-body leading-snug ${sub}`}>{step.body}</p>
        <div className="flex items-center justify-between mt-3.5">
          <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}
            className={`text-sm font-semibold font-body px-3 py-1.5 rounded-lg disabled:opacity-40 ${sub}`}>Back</button>
          {last ? (
            <div className="flex gap-2">
              <button onClick={() => finish(false)} className={`text-sm font-semibold font-body px-3 py-2 rounded-lg ${sub}`}>Got it</button>
              <button onClick={() => finish(true)} className="text-sm font-bold font-body px-4 py-2 rounded-lg bg-vibe-green text-white btn-press">✨ Try a sample</button>
            </div>
          ) : (
            <button onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))}
              className="text-sm font-bold font-body px-4 py-2 rounded-lg bg-vibe-green text-white btn-press">Next</button>
          )}
        </div>
      </div>
    </div>
  );
}
