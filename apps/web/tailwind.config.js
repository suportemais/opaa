/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        opiina: {
          cyan: '#1A94FF',
          violet: '#7038F8',
          cta: '#2563EB',
          navy: '#0F172A',
          muted: '#64748B',
          bg: '#F8FAFC',
          border: '#E2E8F0',
        },
      },
    },
  },
  plugins: [],
}
