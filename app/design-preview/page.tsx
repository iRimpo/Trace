"use client";

/**
 * Unauthenticated showcase of the redesign, so it can be seen without a login.
 *
 * Every real surface in this app is behind auth (`/dashboard`, `/practice`) or
 * needs a camera and a reference video, which makes "just look at it" harder
 * than it should be. This page renders the **actual components** wherever they
 * can stand alone, and a faithful composition of the shipped markup where a
 * piece genuinely needs a live video behind it. Anything in that second
 * category is labelled — a preview that quietly fakes things is worse than no
 * preview, because it is the thing you check the real screen against.
 *
 * It is responsive on the app's own rules: the practice sections branch on
 * `useIsPortrait`, so narrowing the window past square changes them exactly the
 * way rotating a phone does.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import Pressable from "@/components/ui/Pressable";
import StatTile from "@/components/ui/StatTile";
import Panel from "@/components/ui/Panel";
import Segmented from "@/components/ui/Segmented";
import TogglePill from "@/components/ui/TogglePill";
import IconButton from "@/components/ui/IconButton";
import Confetti from "@/components/ui/Confetti";
import AppNav from "@/components/nav/AppNav";
import { CelebratingCharacter, ThinkingCharacter } from "@/components/illustrations";
import { useIsPortrait } from "@/components/practice/chrome";
import { SPRING_POP, SEC, staggerDelay } from "@/lib/motion";
import { sfx, unlockAudio, setMuted } from "@/lib/feedback";
import { phaseForPass, repsCompleted, phaseLabel } from "@/lib/drill";

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">{title}</h2>
        <p className="mt-0.5 text-sm font-medium leading-relaxed text-clay/80">{note}</p>
      </div>
      {children}
    </section>
  );
}

/** Real chrome over a placeholder ground — never presented as the real screen. */
function Staged({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-stage-edge bg-stage ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-stage-raised via-stage to-black" />
      {children}
    </div>
  );
}

export default function PreviewPage() {
  const isPortrait = useIsPortrait();

  const [blend, setBlend]         = useState("screen");
  const [compare, setCompare]     = useState("stacked");
  const [mirror, setMirror]       = useState(true);
  const [cues, setCues]           = useState(true);
  const [counts, setCounts]       = useState(true);
  const [loop, setLoop]           = useState(false);
  const [drillPass, setDrillPass] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [muted, setMutedLocal]    = useState(false);
  const [activeCount, setActive]  = useState(1);

  const drillPhase = phaseForPass(drillPass);
  const reps = repsCompleted(drillPass);

  const regions = [
    { label: "Left leg",  score: 61 },
    { label: "Right arm", score: 74 },
    { label: "Core",      score: 88 },
  ];

  const account = (
    <div className="flex items-center gap-1.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white">R</div>
      <IconButton aria-label="Log out" visual="md" round={false}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </IconButton>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-brand-cream"
      style={isPortrait ? { paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" } : { paddingLeft: "6rem" }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8 sm:px-6">

        <header>
          <p className="text-hud font-extrabold uppercase tracking-[0.2em] text-duo-blue">
            {isPortrait ? "Portrait — phone layout" : "Landscape — desktop layout"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-ink">Trace — the redesign</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-clay">
            Narrow the window past square and every practice section below re-lays itself. That is
            <code className="mx-1 rounded bg-ink/[0.07] px-1">useIsPortrait</code>— the same hook the
            real screens use. Orientation, never a width breakpoint.
          </p>
        </header>

        <Section
          title="Chunk buttons, and the one green"
          note="Press one — the chunk collapses and the face lands where the chunk was, so there is no net layout shift. Green means go, and only go."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Pressable variant="primary" size="lg" onClick={() => { unlockAudio(); sfx("commit"); }}>Start practice →</Pressable>
            <Pressable variant="secondary" size="md">New session</Pressable>
            <Pressable variant="quiet" size="md">Skip</Pressable>
            <Pressable variant="danger" size="md">Delete</Pressable>
            <Pressable variant="primary" size="md" disabled>Disabled</Pressable>
          </div>
        </Section>

        <Section
          title="Stat tiles, in the display face"
          note="Nunito on headings and big numbers; DM Sans everywhere else, and never on the stage HUD where its tighter forms hold up better at ten feet."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile accent="ink"   label="Sessions" value={12} />
            <StatTile accent="blue"  label="Avg"      value="78%" />
            <StatTile accent="green" label="Best"     value="94%" />
            <StatTile accent="gold"  label="Days"     value={9} />
          </div>
        </Section>

        <Section
          title="Accents mean one thing each"
          note="Blue = view/framing · teal = the cue system · violet = counts and tempo · gold = looping. Cues used to be duo-green, the colour that means act — that is what duo-teal exists to fix. On = filled, because a tint does not survive distance."
        >
          <div className="flex flex-wrap gap-2 rounded-2xl bg-stage p-3">
            <TogglePill active={mirror} onClick={() => setMirror(v => !v)} accent="blue"    tone="stage">Mirror {mirror ? "on" : "off"}</TogglePill>
            <TogglePill active={cues}   onClick={() => setCues(v => !v)}   accent="emerald" tone="stage">Cues {cues ? "on" : "off"}</TogglePill>
            <TogglePill active={counts} onClick={() => setCounts(v => !v)} accent="violet"  tone="stage">Counts {counts ? "on" : "off"}</TogglePill>
            <TogglePill active={loop}   onClick={() => setLoop(v => !v)}   accent="amber"   tone="stage">Loop {loop ? "on" : "off"}</TogglePill>
          </div>
        </Section>

        <Section
          title="The ghost — blend, not alpha"
          note="Fading two full video frames together averages two backgrounds, which is why no opacity value ever worked. A blend mode drops the reference's background out instead. Both polarities, because a K-pop practice video is usually a bright studio — the case screen alone blows out to white."
        >
          <div className="flex flex-col gap-3 rounded-2xl bg-stage p-3">
            <Segmented
              tone="stage" label="Ghost blend mode" value={blend} onChange={setBlend}
              options={[
                { value: "normal",     label: "Solid" },
                { value: "screen",     label: "Dark bg" },
                { value: "multiply",   label: "Light bg" },
                { value: "difference", label: "Diff" },
              ]}
            />
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-hud font-bold text-stage-text/70">Ghost</span>
              <input type="range" min={10} max={90} defaultValue={50} aria-label="Ghost opacity" className="slider slider-stage min-w-0 flex-1" />
              <span className="w-9 shrink-0 text-right text-hud tabular-nums text-stage-text/70">50%</span>
            </div>
          </div>
        </Section>

        <Section
          title="Drill mode"
          note="Watch a pass, dance a pass, repeat — hands-free. Tap to advance. WATCH and DANCE differ by fill and by word, not by hue: at eight feet a blue pill and a green pill are the same grey pill."
        >
          <Staged className="h-44">
            <div className="absolute left-3 top-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-stage-glass px-3 py-1.5 backdrop-blur-xl">
                <span className="text-hud font-extrabold tracking-widest text-stage-text/80">TRACE</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-duo-gold px-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-ink" />
                <span className="text-hud font-extrabold tabular-nums text-ink">1:04 → 1:12</span>
              </div>
              <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 shadow-stage ${drillPhase === "watch" ? "bg-duo-blue" : "bg-duo-green"}`}>
                <span className="text-hud-lg font-black uppercase tracking-[0.18em] text-white">{phaseLabel(drillPhase)}</span>
                <span className="text-hud font-extrabold tabular-nums text-white/75">rep {reps + (drillPhase === "dance" ? 1 : 0)}</span>
              </div>
            </div>
            <button
              onClick={() => { unlockAudio(); setDrillPass(n => n + 1); sfx(phaseForPass(drillPass + 1) === "dance" ? "countInGo" : "countIn"); }}
              className="absolute bottom-3 right-3 rounded-xl border border-white/10 bg-stage-glass px-3 py-2 text-hud font-extrabold text-stage-text backdrop-blur-xl"
            >
              Next pass →
            </button>
          </Staged>
        </Section>

        <Section
          title="The count strip, on its own row"
          note="The TRACE badge and the utility cluster used to paint over this — the badge covered counts 1–2, the buttons covered 6–8, so the downbeat sat under the wordmark. Two rows now. Tap a cell."
        >
          <Staged className="h-36">
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-stage-glass px-3 py-1.5 backdrop-blur-xl">
              <span className="text-hud font-extrabold tracking-widest text-stage-text/80">TRACE</span>
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
              {["?", "⤢"].map(g => (
                <span key={g} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-stage-glass text-xs font-bold text-stage-text backdrop-blur-xl">{g}</span>
              ))}
            </div>
            <div className="absolute inset-x-0 top-[3.75rem] flex justify-center px-3">
              <div className="flex w-full max-w-sm gap-1 rounded-2xl border border-white/10 bg-stage-glass p-1.5 shadow-stage backdrop-blur-xl">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => { unlockAudio(); setActive(n); sfx(n === 1 ? "countInGo" : "tick"); }}
                    className={`group relative flex h-12 flex-1 flex-col items-center justify-center rounded-xl transition-ui duration-100 ease-out-strong ${activeCount === n ? "bg-stage-text shadow-stage-sm" : "bg-white/[0.06]"}`}
                  >
                    {(n === 1 || n === 5) && (
                      <span className={`absolute inset-x-2 top-1.5 h-[3px] rounded-full ${activeCount === n ? "bg-cue-hip" : "bg-cue-hip/70"}`} />
                    )}
                    <span className={`text-2xl font-extrabold leading-none tabular-nums transition-transform duration-100 ease-out-strong ${activeCount === n ? "scale-100 text-stage" : "scale-[0.6] text-stage-text/45"}`}>{n}</span>
                  </button>
                ))}
              </div>
            </div>
          </Staged>
        </Section>

        <Section
          title="Comparison — orientation, not width"
          note="Rows in portrait with YOU on top, columns in landscape. This was an unconditional grid-cols-2, which on a 393px phone gave each pane 196px and letterboxed a 16:9 clip into a 110px strip."
        >
          <Segmented
            tone="paper" label="Comparison view" value={compare} onChange={setCompare}
            options={[{ value: "overlay", label: "Overlay" }, { value: "stacked", label: "Side by side" }]}
          />
          <Staged className="h-64">
            {compare === "stacked" ? (
              <div className={`absolute inset-0 grid ${isPortrait ? "grid-rows-2" : "grid-cols-2"}`}>
                <div className={`relative border-white/10 ${isPortrait ? "order-1 border-b" : "order-2 border-l"}`}>
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
                    <div className="h-1.5 w-1.5 rounded-full bg-identity-you" />
                    <span className="text-hud font-extrabold tracking-widest text-white">YOU</span>
                  </div>
                </div>
                <div className={`relative ${isPortrait ? "order-2" : "order-1"}`}>
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
                    <div className="h-1.5 w-1.5 rounded-full bg-identity-reference" />
                    <span className="text-hud font-extrabold tracking-widest text-white">REFERENCE</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <p className="text-hud font-bold text-stage-text/50">Reference composited over you — blend “{blend}”</p>
              </div>
            )}
          </Staged>
        </Section>

        <Section
          title="The celebration moment"
          note="The number counts up alone, then region bars fill worst-first, then the character, then confetti, then the buttons last — a button that arrives before you have read the result invites a tap that skips it."
        >
          <Pressable variant="primary" size="md" onClick={() => { unlockAudio(); setCelebrate(true); sfx("success"); setTimeout(() => setCelebrate(false), 2600); }}>
            Play celebration
          </Pressable>
          <div className="relative overflow-hidden rounded-2xl bg-stage p-5">
            <Confetti active={celebrate} />
            <p className="text-center text-hud font-extrabold uppercase tracking-[0.2em] text-stage-text/60">Strong run</p>
            <motion.div
              key={celebrate ? "on" : "off"}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING_POP}
              className="mt-1 flex items-end justify-center gap-1"
            >
              <span className="font-display text-[5.5rem] font-black leading-[0.85] tabular-nums text-duo-green">86</span>
              <span className="pb-2 text-hud-lg font-extrabold text-stage-text/45">/100</span>
            </motion.div>
            <div className="mt-5 flex flex-col gap-2 rounded-2xl bg-white/[0.07] p-3">
              {regions.map((r, i) => (
                <motion.div
                  key={r.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: SEC.ENTER, delay: staggerDelay(i, regions.length) }}
                  className="flex items-center gap-2"
                >
                  <span className="w-20 shrink-0 text-hud font-bold text-stage-text/70">{r.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span className={`block h-full rounded-full ${r.score >= 80 ? "bg-duo-green" : r.score >= 65 ? "bg-duo-gold" : "bg-duo-red"}`} style={{ width: `${r.score}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-hud font-bold tabular-nums text-stage-text/80">{r.score}</span>
                </motion.div>
              ))}
            </div>
            <div className="pointer-events-none mt-4 flex justify-center">
              <CelebratingCharacter size="sm" tone="stage" />
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Pressable block variant="primary" size="lg">Save this run</Pressable>
              <div className="flex gap-2">
                <Pressable block variant="stage" size="md">Watch it back</Pressable>
                <Pressable block variant="stage" size="md">Practise again</Pressable>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card">
            <ThinkingCharacter size="sm" />
            <p className="text-sm font-medium leading-relaxed text-clay">
              Below 80 the card shows <strong className="text-ink">Thinking</strong> instead, and no
              confetti. A grinning mascot over a 40 reads as sarcasm.
            </p>
          </div>
        </Section>

        <Section
          title="Sound and haptics"
          note="Synthesised, so there are no audio assets and nothing to precache. Tap a cue — audio unlocks on the first gesture, exactly as on the practice route."
        >
          <div className="flex flex-wrap gap-2">
            {(["tick", "countIn", "countInGo", "commit", "success", "almost", "recordStart", "recordStop"] as const).map(name => (
              <Pressable key={name} variant="quiet" size="sm" onClick={() => { unlockAudio(); sfx(name); }}>{name}</Pressable>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Pressable variant={muted ? "danger" : "secondary"} size="sm" onClick={() => { const n = !muted; setMuted(n); setMutedLocal(n); }}>
              {muted ? "Muted" : "Sound on"}
            </Pressable>
            <p className="text-sm text-clay/70">Global, and it persists across reloads.</p>
          </div>
        </Section>

        <Section
          title="Resume the section"
          note="Loop points used to live in component state and die with the tab, so the returning dancer re-marked the same eight bars every session. They persist now, and the tile says what you get back."
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {([["Golden — bars 17–24", "1:04 → 1:12"], ["Dynamite", null]] as const).map(([name, section]) => (
              <Panel key={name} tone="paper" radius="xl" className="w-44 shrink-0 overflow-hidden">
                <div className="flex h-24 items-center justify-center bg-ink">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5a1 1 0 0 1 1.53-.848l11 7.5a1 1 0 0 1 0 1.696l-11 7.5A1 1 0 0 1 7 19.5v-15Z" /></svg>
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-extrabold tracking-tight text-ink">{name}</p>
                  {section ? (
                    <p className="mt-0.5 flex items-center gap-1 text-hud font-bold text-duo-blue">
                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7z" /></svg>
                      Resume {section}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-hud text-clay/60">84 MB</p>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </Section>

        <Section
          title="Streak, and nothing else"
          note="Milestones at 3 / 7 / 30 pop on arrival; ordinary days do not. No XP, no hearts, no gems, no leagues — the reward is the score the app already computes."
        >
          <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-card">
            <p className="font-display text-2xl font-bold tracking-tight text-ink">Hi, Richard</p>
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={SPRING_POP}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-duo-gold px-3 py-2 shadow-chunk-gold"
            >
              <span className="text-base leading-none">🔥</span>
              <span className="text-lg font-extrabold leading-none tabular-nums text-ink">7</span>
              <span className="text-hud uppercase tracking-[0.18em] text-ink/70">days</span>
            </motion.div>
          </div>
        </Section>

        <p className="rounded-2xl border-2 border-duo-edge bg-white/60 p-4 text-sm leading-relaxed text-clay">
          <strong className="text-ink">What this page is not.</strong> The dark blocks above are the
          real chrome over a placeholder gradient rather than a live camera feed. The geometry, type
          and colour are the shipped values, but the ghost blend and the calibration overlays can only
          be judged on the real screens, on a phone, from where you actually stand.
        </p>
      </div>

      {/* The real nav component: bottom bar in portrait, left rail otherwise. */}
      <AppNav account={account} />
    </div>
  );
}
