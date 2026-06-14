/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../engine/plugins/**/*.{js,ts,jsx,tsx}",
    "../../engine/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        primary: {
          DEFAULT: '#0080BE',
          dark: '#006A9E',
          light: '#E6F3FA',
          50: '#F0F8FC',
          100: '#E6F3FA',
          200: '#B3DAF0',
          300: '#66B5DE',
          400: '#3399CC',
          500: '#0080BE',
          600: '#006A9E',
          700: '#00537D',
          800: '#003D5C',
          900: '#00263B',
        },
        // Teal accent
        teal: {
          DEFAULT: '#00A896',
          dark: '#008A7B',
          light: '#E8F5F2',
          50: '#F0FAF8',
          100: '#E8F5F2',
          200: '#B3E5DB',
          300: '#66CCBB',
          400: '#33B9A8',
          500: '#00A896',
          600: '#008A7B',
          700: '#006B60',
          800: '#004D45',
          900: '#002E2A',
        },
        // Neutrals
        bg: {
          primary: '#FFFFFF',
          secondary: '#F7FAFA',
          tertiary: '#EFF3F3',
        },
        text: {
          dark: '#1A2332',
          body: '#4A5568',
          muted: '#6B7B8D',
        },
        border: {
          DEFAULT: '#E0EBE8',
          light: '#F0F5F3',
          dark: '#C8D8D2',
        },
        // Chart colors
        chart: {
          primary: '#0080BE',
          secondary: '#00A896',
          tertiary: '#4ECDC4',
          accent: '#E76F51',
          warning: '#F4A261',
          positive: '#2A9D8F',
        },
      },
      fontFamily: {
        heading: ['"BPG Nino Mtavruli Bold"', '"BPG Arial"', 'system-ui', 'sans-serif'],
        body: ['"BPG Arial"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 12px rgba(0, 128, 190, 0.12)',
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
