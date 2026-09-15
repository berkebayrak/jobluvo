// Tailwind v3 mapping. Every value points at the CSS variables in ./*.css so
// the theme stays the single source of truth. For Tailwind v4 use tailwind.theme.css.
module.exports = {
  theme: {
    fontFamily: { sans: ["var(--font-sans)"] },
    colors: {
      transparent: "transparent",
      white: "var(--jl-white)",
      grey: {
        50: "var(--jl-grey-50)", 100: "var(--jl-grey-100)", 200: "var(--jl-grey-200)",
        300: "var(--jl-grey-300)", 400: "var(--jl-grey-400)", 500: "var(--jl-grey-500)",
        700: "var(--jl-grey-700)", 800: "var(--jl-grey-800)", 900: "var(--jl-grey-900)",
      },
      red: { DEFAULT: "var(--jl-red)", soft: "var(--jl-red-soft)" },
      surface: { 0: "var(--surface-0)", 1: "var(--surface-1)", 2: "var(--surface-2)", 3: "var(--surface-3)", header: "var(--surface-header)", inverse: "var(--surface-inverse)" },
      fg: { DEFAULT: "var(--fg)", muted: "var(--fg-muted)", subtle: "var(--fg-subtle)", disabled: "var(--fg-disabled)", inverse: "var(--fg-inverse)" },
      border: { DEFAULT: "var(--border)", strong: "var(--border-strong)", focus: "var(--border-focus)" },
      accent: { DEFAULT: "var(--accent)", hover: "var(--accent-hover)" },
      danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
    },
    fontSize: {
      "2xs": ["var(--text-2xs)", "var(--leading-2xs)"],
      xs: ["var(--text-xs)", "var(--leading-xs)"],
      sm: ["var(--text-sm)", "var(--leading-sm)"],
      base: ["var(--text-base)", "var(--leading-base)"],
      md: ["var(--text-md)", "var(--leading-md)"],
      lg: ["var(--text-lg)", "var(--leading-lg)"],
      xl: ["var(--text-xl)", { lineHeight: "var(--leading-xl)", letterSpacing: "var(--tracking-tight)" }],
      "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-2xl)", letterSpacing: "var(--tracking-tight)" }],
      "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-3xl)", letterSpacing: "var(--tracking-tight)" }],
      "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-4xl)", letterSpacing: "-0.03em" }],
    },
    fontWeight: { regular: "400", medium: "500", semibold: "600" },
    letterSpacing: { tight: "var(--tracking-tight)", normal: "0", wide: "var(--tracking-wide)", wordmark: "var(--tracking-wordmark)" },
    spacing: {
      0: "0", 0.5: "var(--space-0-5)", 1: "var(--space-1)", 1.5: "var(--space-1-5)", 2: "var(--space-2)",
      3: "var(--space-3)", 4: "var(--space-4)", 5: "var(--space-5)", 6: "var(--space-6)", 8: "var(--space-8)",
      10: "var(--space-10)", 12: "var(--space-12)", 16: "var(--space-16)",
      "row-compact": "var(--row-compact)", "row-regular": "var(--row-regular)",
      "control-sm": "var(--control-sm)", "control-md": "var(--control-md)", "control-lg": "var(--control-lg)",
      panel: "var(--panel-width)", topnav: "var(--topnav-height)",
    },
    borderRadius: { none: "0", xs: "var(--radius-xs)", sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", full: "var(--radius-full)" },
    borderWidth: { DEFAULT: "1px", 0: "0" },
    boxShadow: { none: "none", focus: "var(--focus-ring)" },
    transitionTimingFunction: { DEFAULT: "var(--ease)" },
    transitionDuration: { fast: "120ms", DEFAULT: "200ms" },
  },
};
