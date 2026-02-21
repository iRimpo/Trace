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
          primary: "#1447E6",   // vibrant electric blue
          accent:  "#FF2D55",   // vibrant red
          bg:      "#f8f9ff",   // cool-white tinted blue
          purple:  "#b1abf4",
          green:   "#a3de9b",
          dark:    "#0f0f14",   // near-black with blue undertone
          cream:   "#faf9f6",
        },
        trace: {
          black: "#1A1A1A",
          white: "#FFFFFF",
          gray: {
            50: "#F9FAFB",
            100: "#F3F4F6",
            200: "#E5E7EB",
            300: "#D1D5DB",
            400: "#9CA3AF",
            500: "#6B7280",
          },
          blue: "#3B82F6",
          red: "#EF4444",
          yellow: "#FBBF24",
          green: "#10B981",
        },
      },
      fontFamily: {
        sans:      ["var(--font-inter)", "system-ui", "sans-serif"],
        mono:      ["var(--font-mono)", "monospace"],
        logo:      ["var(--font-outfit)", "sans-serif"],
        hero:      ["var(--font-dm-sans)", "sans-serif"],
        noname:    ["var(--font-jakarta)", "sans-serif"],
        helvetica: ["var(--font-raleway)", "sans-serif"],
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
        "fade-in":  "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        marquee:    "marquee 30s linear infinite",
        float:      "float 6s ease-in-out infinite",
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
