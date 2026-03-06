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
        brand: {
          primary: "#080808",
          accent:  "#1a1a1a",
          bg:      "#f8f4e0",
          dark:    "#080808",
          cream:   "#f8f4e0",
          muted:   "#71717a",
        },
        cue: {
          hand:     "#00D4FF",
          foot:     "#34D399",
          head:     "#FBBF24",
          elbow:    "#F97316",
          hip:      "#A78BFA",
          shoulder: "#60A5FA",
          arm:      "#F472B6",
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
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
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
