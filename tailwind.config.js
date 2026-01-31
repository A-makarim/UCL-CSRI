/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-black': '#000000',
        'neon-cyan': '#00F3FF',
        'neon-amber': '#FFB800',
        'blood-red': '#FF003C',
        'glass-white': '#ffffff20'
      },
      backdropBlur: {
        xs: '2px'
      }
    },
  },
  plugins: [],
}
