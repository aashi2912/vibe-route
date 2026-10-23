/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Direction 1 "Refine" — warm paper neutrals, forest-green DNA kept.
        earth: {
          50: "#fbf8f1",   // paper (day surface)
          100: "#f3eee3",  // raised paper / chips
          200: "#e4ddce",  // hairline / borders
          300: "#cfc5b2",
          400: "#9aa096",  // muted placeholder (slight green bias)
          500: "#6f7a6f",  // secondary text
          600: "#4a5248",
          700: "#374038",
          800: "#1f2a22",  // ink
        },
        vibe: {
          green: "#2f6b4e",
          orange: "#d8772e",
          blue: "#4e63c8",
          purple: "#7c5bd0",
          gold: "#c99a2e", // well-lit
        },
        night: {
          bg: "#141b22",    // deep slate-green, not the old navy
          card: "#1e262d",
          border: "#2b343c",
          text: "#d7ddd6",
          muted: "#7c867f",
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', "Georgia", "serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(31,42,34,0.05)",
        cta: "0 6px 16px rgba(47,107,78,0.20)",
        lift: "0 6px 20px rgba(47,107,78,0.15)",
      },
    },
  },
  plugins: [],
};
