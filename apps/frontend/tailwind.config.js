/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#FBF6EA",
        card: "#FFFDF7",
        accent: {
          DEFAULT: "#D86E00",
          hover: "#B85D00",
          light: "#F0B573",
        },
      },
    },
  },
  plugins: [],
};
