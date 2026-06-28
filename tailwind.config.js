/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EBF4FF',
          100: '#D6E8FF',
          500: '#1C6FE0',
          600: '#1558B8',
          cyan: '#22B8E6',
          navy: '#0D1F3C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
