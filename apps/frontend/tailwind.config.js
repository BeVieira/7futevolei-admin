/** @type {import('tailwindcss').Config} */
// Uma cor só: o teal do logo (#17A1A3). Cheio só em marcas pequenas (botão
// principal, ícone ativo, barra de lotação); os tons claros dele fazem as
// áreas (aba ativa, quadra, avisos). O resto é neutro.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Fundo da página, um passo na direção do teal mais claro.
        background: "#F4F8F8",
        card: "#FFFFFF",
        raised: "#EEF3F3",
        line: "#E2E8E8",
        rule: "#EEF2F2",
        control: "#CBD4D4",
        ink: "#111827",
        muted: "#5B6470",
        accent: {
          // Preenchimento com texto branco (4.8:1).
          DEFAULT: "#117F81",
          hover: "#0C6A6C",
          // A cor do logo, para marcas sem texto em cima.
          mark: "#17A1A3",
          light: "#A9D8D9",
          soft: "#EAF6F6",
          track: "#CFE9E9",
          ink: "#0A4F51",
        },
        positive: { DEFAULT: "#247B50", bg: "#DCFCE7", ink: "#14532D" },
        negative: { DEFAULT: "#C4242A", bg: "#FFEDEA", ink: "#831C1E" },
        warning: { bg: "#FFFBEB", border: "#FDE68A", ink: "#92400E" },
      },
    },
  },
  plugins: [],
};
