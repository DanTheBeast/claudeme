/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        callme: {
          DEFAULT: "#E8845A",
          light: "#F09B77",
          dark: "#D4693E",
          50: "#FDF6F2",
          100: "#FAEAE0",
          200: "#F3CDB8",
          500: "#E8845A",
          600: "#D4693E",
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
