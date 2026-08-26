/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Outfit", "Plus Jakarta Sans", "sans-serif"],
        body: ["Plus Jakarta Sans", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          light: "#EFF6FF",
          dark: "#1D4ED8",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F8FAFC",
        },
        ink: "#0F172A",
        muted: "#64748B",
        danger: "#EF4444",
      },
      borderRadius: {
        card: "2rem",
        control: "1.25rem",
      },
      boxShadow: {
        soft: "0 20px 40px -15px rgba(15, 23, 42, 0.07)",
        control: "0 10px 25px -5px rgba(37, 99, 235, 0.25)",
      },
    },
  },
  plugins: [],
};
