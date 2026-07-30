import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /**
         * Primary foreground — the warm near-black the whole app is drawn in.
         * Previously written as the arbitrary value `[#1a0f00]` in 363 places
         * and defined nowhere, so it could not be changed in one edit and
         * typos failed silently. Opacity modifiers work as usual: `text-ink/60`.
         */
        ink:  "#1a0f00",
        /** Secondary brown, used for supporting copy and borders on cream. */
        clay: "#5c3d1a",
        brand: {
          primary: "#080808",
          accent:  "#1a1a1a",
          bg:      "#f8f4e0",
          dark:    "#080808",
          cream:   "#f8f4e0",
          muted:   "#71717a",
        },
        /**
         * Action palette. Duolingo's structure, not its brand: a single
         * saturated action colour plus a hard-edged darker shade used as the
         * bottom "chunk" on pressables. The chunk is what makes a button read
         * as physically pressable at a glance, which is the whole point on a
         * phone propped across the room.
         */
        duo: {
          green:     "#58CC02",
          greenDark: "#43A302",
          blue:      "#1CB0F6",
          blueDark:  "#1899D6",
          gold:      "#FFC800",
          goldDark:  "#E5A600",
          red:       "#FF4B4B",
          redDark:   "#E23A3A",
          edge:      "#E0DCC8",
        },
        /**
         * The Stage — the second ground.
         *
         * The app has two surfaces, not one. `brand.cream` is *paper*: auth,
         * dashboard, anything you read at arm's length. The practice screen is
         * a *stage*: a live camera feed at full bleed, looked at from ten feet
         * away while dancing.
         *
         * Practice chrome used to be white glass (`bg-white/90`) floating over
         * that feed. Two problems, both only visible on a phone: white glass in
         * a bright room is the brightest thing on screen, so the eye lands on
         * the controls instead of the dancer, and the 10px ink-on-white labels
         * inside it are unreadable at dancing distance. Dark glass inverts
         * both — the video stays the brightest element, and white-on-dark holds
         * contrast against whatever is behind it.
         */
        stage: {
          DEFAULT: "#0B0B0C",
          raised:  "#17171A",
          /** Floating panel fill. Pair with `backdrop-blur-xl`. */
          glass:   "rgba(11,11,12,0.66)",
          /** Same, one step lighter, for a control nested inside glass. */
          inset:   "rgba(255,255,255,0.08)",
          edge:    "#33333A",
          text:    "#F7F5EE",
          muted:   "#A3A099",
        },
        cue: {
          hand:     "#00D4FF",
          foot:     "#34D399",
          head:     "#FBBF24",
          elbow:    "#F97316",
          hip:      "#A78BFA",
          shoulder: "#60A5FA",
          arm:      "#F472B6",
          body:     "#E879F9",
        },
        trace: {
          black: "#080808",
          white: "#f8f4e0",
          gray: {
            50:  "#fafafa",
            100: "#f4f4f5",
            200: "#e4e4e7",
            300: "#d4d4d8",
            400: "#a1a1aa",
            500: "#71717a",
          },
        },
      },
      fontFamily: {
        sans:      ["var(--font-dm-sans)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono:      ["var(--font-mono)", "monospace"],
        logo:      ["var(--font-outfit)", "sans-serif"],
        hero:      ["var(--font-dm-sans)", "sans-serif"],
        noname:    ["var(--font-jakarta)", "sans-serif"],
        helvetica: ["var(--font-raleway)", "sans-serif"],
        calistoga: ["var(--font-calistoga)", "serif"],
      },
      fontSize: {
        hero:    ["4rem",  { lineHeight: "1.1", fontWeight: "800" }],
        display: ["3rem",  { lineHeight: "1.2", fontWeight: "800" }],
        title:   ["2rem",  { lineHeight: "1.3", fontWeight: "700" }],
        /**
         * The legibility floor for anything on the practice stage. The screen
         * is propped several feet away, so 12px bold is the smallest thing that
         * survives the distance — the old chrome ran down to `text-[8px]`.
         * Anything smaller than `hud` on the stage is a bug, not a style.
         */
        hud:      ["0.75rem",  { lineHeight: "1",    fontWeight: "700", letterSpacing: "0.02em" }],
        "hud-lg": ["0.875rem", { lineHeight: "1.15", fontWeight: "700", letterSpacing: "0.01em" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      boxShadow: {
        /**
         * The pressable "chunk". Solid, not blurred — blur reads as soft, and
         * soft is the opposite of the affordance. One named shadow per variant
         * so no component has to inline a hex to colour its own edge.
         */
        "chunk-green": "0 4px 0 0 #43A302",
        "chunk-blue":  "0 4px 0 0 #1899D6",
        "chunk-gold":  "0 4px 0 0 #E5A600",
        "chunk-red":   "0 4px 0 0 #E23A3A",
        "chunk-quiet": "0 4px 0 0 #E0DCC8",
        "chunk-gold-sm": "0 3px 0 0 #E5A600",
        /** Resting card lift on cream. */
        card:          "0 2px 0 0 #E0DCC8",
        /** Chunk variants for pressables that live on the dark stage. */
        "chunk-ink":   "0 4px 0 0 #000000",
        "chunk-stage": "0 4px 0 0 #33333A",
        /**
         * Stage panels do get a blurred shadow, unlike paper cards. On cream a
         * solid chunk reads as a physical edge; over a moving video there is no
         * stable ground to cast onto, so a soft drop is what separates panel
         * from feed.
         */
        stage:         "0 8px 28px -10px rgba(0,0,0,0.75)",
        "stage-sm":    "0 4px 14px -6px rgba(0,0,0,0.7)",
      },
      transitionProperty: {
        /**
         * Everything `transition-all` actually wanted, minus the layout
         * properties. `all` also animates width/height/padding/margin/top, each
         * of which forces layout and paint on every frame; these all composite.
         */
        ui: "background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter",
      },
      transitionTimingFunction: {
        /** Stronger than CSS ease-out, which is too weak to feel intentional. */
        "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      animation: {
        "fade-in":    "fadeIn 0.6s ease-out forwards",
        "slide-up":   "slideUp 0.6s ease-out forwards",
        marquee:      "marquee 30s linear infinite",
        float:        "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-16px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
