import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4ff",
          100: "#dde6ff",
          200: "#c3d0ff",
          300: "#9ab0ff",
          400: "#6b85ff",
          500: "#4458ff",
          600: "#2937f5",
          700: "#1e28e0",
          800: "#1a22b5",
          900: "#1c228f",
          950: "#0f1354",
        },
        brand: {
          navy: "#0f1c40",
          blue: "#2563eb",
          "blue-light": "#3b82f6",
          "blue-pale": "#dbeafe",
          "cream": "#f8f7f4",
          "warm-white": "#fafaf8",
          "stone": "#f4f3f0",
          charcoal: "#1e293b",
          "mid-gray": "#64748b",
          "light-gray": "#e2e8f0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 16px rgba(0,0,0,0.06)",
        card: "0 4px 24px rgba(0,0,0,0.08)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
