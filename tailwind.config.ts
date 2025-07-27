import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: '#000000',
        light: '#ffffff',
        subtle: 'rgba(255,255,255,0.1)',
        nvidia: '#76b900',
        'nvidia-dark': '#5a8f00',
        waymo: '#4285F4',
        zoox: '#00A86B',
        cruise: '#FF6F00',
        emergency: '#FF0000',
        coordination: '#FFD700',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(118, 185, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(118, 185, 0, 0.03) 1px, transparent 1px)',
        'grain-pattern': 'radial-gradient(circle at 1px 1px, rgba(118, 185, 0, 0.1) 1px, transparent 0)',
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-in-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(118, 185, 0, 0.7)' },
          '70%': { boxShadow: '0 0 0 10px rgba(118, 185, 0, 0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
