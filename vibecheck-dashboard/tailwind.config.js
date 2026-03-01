/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FCFCFD",
        primary: "#09090B",
        accent: "#2563EB",
        danger: "#EF4444",
        success: "#10B981"
      }
    },
  },
  plugins: [],
}
