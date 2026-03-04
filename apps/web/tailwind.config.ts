import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#020617",
          card: "#0f172a",
          border: "#1e293b",
          cyan: "#06b6d4",
          blue: "#3b82f6"
        }
      }
    }
  },
  plugins: []
};

export default config;
