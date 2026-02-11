/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        'pro-black': '#0a0a0a',
        'pro-gray': '#1a1a1a',
        'pro-light': '#e5e5e5',
        'accent': '#d4af37',
      }
    }
  },
  plugins: [],
}
