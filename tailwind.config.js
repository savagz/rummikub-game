/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Russo One', 'sans-serif'],
        body: ['Chakra Petch', 'sans-serif'],
      },
      colors: {
        tile: {
          red: '#EF4444',
          blue: '#3B82F6',
          black: '#1F2937',
          orange: '#F97316',
        }
      },
      backgroundImage: {
        'game-bg': 'radial-gradient(ellipse at top, #1e1b4b 0%, #0F0F23 60%)',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(124, 58, 237, 0.5)',
        'tile': '0 4px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(124,58,237,0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(124,58,237,0.8)' },
        }
      }
    },
  },
  plugins: [],
}
