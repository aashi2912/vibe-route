/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        earth: {
          50: "#faf7f2",
          100: "#f0ebe2",
          200: "#e8e0d4",
          300: "#d4c5b0",
          400: "#b5a48a",
          500: "#8b7d6b",
          600: "#5c4a32",
          700: "#4a3f30",
          800: "#2c2418",
        },
        vibe: {
          green: "#2d6a4f",
          orange: "#e07a2f",
          blue: "#5a67d8",
          purple: "#7c3aed",
        },
        night: {
          bg: "#1a1a2e",
          card: "#25254a",
          border: "#2d2d4e",
          text: "#c8c9e0",
          muted: "#6b6d88",
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', "serif"],
        body: ['"DM Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
