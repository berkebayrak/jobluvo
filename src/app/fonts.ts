import localFont from "next/font/local";

/**
 * Geist, self-hosted through next/font from the `geist` npm package.
 *
 * The design system uses three weights and only three: 400 regular, 500 the
 * single emphasis weight in product UI, 600 for the wordmark and stat values.
 * `geist/font/sans` would declare all nine weights, so the three static files
 * are loaded directly instead.
 */
export const geistSans = localFont({
  src: [
    {
      path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-geist-sans",
  display: "swap",
  fallback: ["-apple-system", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
});
