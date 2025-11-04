/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/frontend/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebefff',
          200: '#d6dffe',
          300: '#b3bffd',
          400: '#8c9ffb',
          500: '#667eea',
          600: '#5568d3',
          700: '#4553b8',
          800: '#3a4494',
          900: '#323a78',
        }
      }
    },
  },
  plugins: [],
}
