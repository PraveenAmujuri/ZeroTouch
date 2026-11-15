/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3f4fb',
          100: '#ebedf9',
          300: '#b4bcf0',
          400: '#99a1e1',
          500: '#6f7bd4', // Loz periwinkle lavender
          600: '#626fd0',
          900: '#2b3363',
        },
        secondary: {
          400: '#ff9980',
          500: '#ff8066', // Loz coral / salmon
        },
        zinc: {
          800: '#27272a', // Loz border & text
          900: '#18181b', // Loz footer
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Pratico Variable"', 'Inter', 'sans-serif'],
      },
      screens: {
        '3xl': '1680px',
      }
    },
  },
  plugins: [],
}
