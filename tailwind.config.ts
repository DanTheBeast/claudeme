/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        callme: {
          DEFAULT: "#D46B50",
          light: "#DE7F65",
          dark: "#C05840",
          50: "#FBF4F1",
          100: "#F5E4DC",
          200: "#EBC5B5",
          500: "#D46B50",
          600: "#C05840",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
