/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38a8f8',
          500: '#0e8ce9',
          600: '#026fc7',
          700: '#0358a1',
          800: '#074b84',
          900: '#0c3f6e',
          950: '#082849',
        },
        fest: {
          orange: '#FF5722',
          purple: '#7C3AED',
          pink: '#EC4899',
          emerald: '#10B981',
          amber: '#F59E0B'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(14, 140, 233, 0.4)',
        'glow-purple': '0 0 25px -5px rgba(124, 58, 237, 0.4)',
      }
    },
  },
  plugins: [],
}
