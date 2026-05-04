import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0a0b0f',
        surface:  '#111318',
        accent:   '#ff4d00',
        accent2:  '#00e5ff',
        text:     '#e8e8e8',
        muted:    '#5a5f6e',
        border:   '#1e2130',
      },
      fontFamily: {
        mono:    ['"Space Mono"', 'monospace'],
        heading: ['"Syne"', 'sans-serif'],
        body:    ['"Space Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'accent-glow': '0 0 20px rgba(255, 77, 0, 0.3)',
        'cyan-glow':   '0 0 20px rgba(0, 229, 255, 0.3)',
        'panel':       '0 4px 24px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
