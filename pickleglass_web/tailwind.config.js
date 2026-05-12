/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#F97316',
        secondary: '#8A857E',
        accent: '#5294CC',
        'accent-green': '#4EA870',
        'surface-0': '#070707',
        'surface-1': '#0D0D0D',
        'surface-2': '#121212',
        'surface-3': '#171717',
        'surface-4': '#1C1C1C',
        'surface-5': '#222222',
        'border-1': '#1A1A1A',
        'text-1': '#E8E3DC',
        'text-2': '#8A857E',
        'text-3': '#484540',
        'text-4': '#2A2825',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
