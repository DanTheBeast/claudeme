/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        callme: {
          DEFAULT: "#FF6B35",
          light: "#FF8A5B",
          dark: "#E55A25",
          50: "#FFF8F3",
          100: "#FFF0E8",
          200: "#FFD4C0",
          500: "#FF6B35",
          600: "#E55A25",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
