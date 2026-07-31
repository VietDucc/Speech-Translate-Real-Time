/**
 * DESIGN TOKENS — Playful Geometric
 * Load after the Tailwind Play CDN script:
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script src="/theme.js"></script>
 *
 * index.html still carries its own inline copy; point it here whenever you
 * want a single source of truth for both pages.
 */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        paper: "#FFFDF5", // warm cream, the "paper" the stickers sit on
        ink: "#1E293B", // slate-800, softer than black
        muted: "#F1F5F9",
        dim: "#64748B",
        line: "#E2E8F0",
        accent: "#8B5CF6", // vivid violet — primary actions, language A
        pink: "#F472B6", // hot pink — language B
        amber: "#FBBF24", // optimism — decoration, hover fills
        mint: "#34D399", // freshness — "live" state
      },
      fontFamily: {
        // Be Vietnam Pro ships the full Vietnamese subset.
        display: ["Be Vietnam Pro", "system-ui", "sans-serif"],
        body: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { sm: "8px", md: "16px", lg: "24px" },
      borderWidth: { DEFAULT: "2px" },
      boxShadow: {
        pop: "4px 4px 0px 0px #1E293B",
        "pop-lg": "6px 6px 0px 0px #1E293B",
        "pop-sm": "2px 2px 0px 0px #1E293B",
        sticker: "8px 8px 0px 0px #E2E8F0",
        "sticker-pink": "8px 8px 0px 0px #F472B6",
        "sticker-violet": "8px 8px 0px 0px #8B5CF6",
        focus: "4px 4px 0px 0px #8B5CF6",
      },
      transitionTimingFunction: { bounce: "cubic-bezier(0.34,1.56,0.64,1)" },
      keyframes: {
        popin: {
          "0%": { opacity: "0", transform: "scale(.86) translateY(8px)" },
          "60%": { opacity: "1", transform: "scale(1.03) translateY(0)" },
          "100%": { transform: "scale(1)" },
        },
        wiggle: {
          "0%,100%": { transform: "rotate(0deg)" },
          "30%": { transform: "rotate(4deg)" },
          "65%": { transform: "rotate(-4deg)" },
        },
        blip: { "50%": { opacity: ".25", transform: "scale(.8)" } },
      },
      animation: {
        popin: "popin .34s cubic-bezier(0.34,1.56,0.64,1) both",
        wiggle: "wiggle .5s ease-in-out",
        blip: "blip 1s ease-in-out infinite",
      },
    },
  },
};
