/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Archivo"', 'sans-serif'],
        serif: ['"Bodoni Moda"', 'serif'],
        mono: ['"Space Grotesk"', 'monospace'],
        display: ['"Bodoni Moda"', 'serif'],
      },
      colors: {
        'lumina': {
          'bg': '#050505',
          'surface': '#0a0a0a',
          'surface-elevated': '#121212',
          'border': 'rgba(255, 255, 255, 0.08)',
          'border-subtle': 'rgba(255, 255, 255, 0.04)',
          'text': '#fafafa',
          'text-secondary': '#a1a1aa',
          'muted': '#52525b',
          'accent': '#D4AF37',
          'accent-muted': 'rgba(212, 175, 55, 0.15)',
          'accent-glow': 'rgba(212, 175, 55, 0.25)',
        },
      },
    }
  },
  plugins: [],
}
