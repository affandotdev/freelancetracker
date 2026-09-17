import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      colors: {
        ink: "#1a1d23",
        surface: "#f7f8fa",
        border: "#e2e5ea",
        accent: "#2563eb",
        "signal-red": "#dc2626",
        "signal-green": "#16a34a",
        "signal-amber": "#d97706",
      },
    },
  },
  plugins: [],
};

export default config;
